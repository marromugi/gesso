import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { type Db, tables } from "../db/index.ts";
import { type VersionFile, hashContent } from "./versionFiles.ts";

const { prototype, prototypeFileContent, prototypeVersion, prototypeVersionFile } = tables;

/** D1 binds at most 100 parameters to one statement. */
const hashesPerQuery = 90;
const filesPerInsert = 30;

/** A snapshot of a prototype's files, by its number within the prototype. */
export type PrototypeVersion = { number: number; createdAt: string };

export type VersionFileEntry = VersionFile & { size: number };

export type PrototypeVersionDetail = PrototypeVersion & { files: VersionFileEntry[] };

export type SaveContentResult =
  | { kind: "saved" }
  | { kind: "notFound" }
  | { kind: "hashMismatch"; actual: string };

export type CreateVersionResult =
  | { kind: "created"; version: PrototypeVersionDetail }
  | { kind: "notFound" }
  | { kind: "missingContent"; hashes: string[] };

/** Where R2 keeps a prototype's file content. */
function contentKey(prototypeId: string, hash: string): string {
  return `prototypes/${prototypeId}/${hash}`;
}

/**
 * Keeps `content` for the owner's prototype under `hash`, which must be its SHA-256. Saving the
 * same content again writes nothing.
 */
export async function saveFileContent(
  db: Db,
  bucket: R2Bucket,
  ownerId: string,
  prototypeId: string,
  hash: string,
  content: ArrayBuffer,
  now: Date,
): Promise<SaveContentResult> {
  if (!(await ownsPrototype(db, ownerId, prototypeId))) return { kind: "notFound" };
  const actual = await hashContent(content);
  if (actual !== hash) return { kind: "hashMismatch", actual };
  // Each R2 write is billed, and a client may send everything again on every push.
  if ((await contentSizes(db, prototypeId, [hash])).has(hash)) return { kind: "saved" };
  // R2 first: a row in D1 always means the content is there.
  await bucket.put(contentKey(prototypeId, hash), content);
  await db
    .insert(prototypeFileContent)
    .values({ prototypeId, hash, size: content.byteLength, createdAt: now.toISOString() })
    .onConflictDoNothing();
  return { kind: "saved" };
}

/**
 * Makes the owner's prototype's next version from `files`, whose content must have been saved
 * with `saveFileContent` first; otherwise nothing is made and the missing hashes come back.
 * `files` is assumed to have passed `versionFilesProblem`.
 */
export async function createVersion(
  db: Db,
  ownerId: string,
  prototypeId: string,
  files: readonly VersionFile[],
  now: Date,
): Promise<CreateVersionResult> {
  if (!(await ownsPrototype(db, ownerId, prototypeId))) return { kind: "notFound" };
  const hashes = [...new Set(files.map((file) => file.hash))];
  const sizes = await contentSizes(db, prototypeId, hashes);
  const missing = hashes.filter((hash) => !sizes.has(hash));
  if (missing.length > 0) return { kind: "missingContent", hashes: missing };

  const id = crypto.randomUUID();
  const at = now.toISOString();
  // One D1 batch is one transaction, and the next number is read inside the insert itself.
  const [inserted] = await db.batch([
    db
      .insert(prototypeVersion)
      .values({
        id,
        prototypeId,
        number: sql`(select coalesce(max(${prototypeVersion.number}), 0) + 1 from ${prototypeVersion} where ${prototypeVersion.prototypeId} = ${prototypeId})`,
        createdAt: at,
      })
      .returning({ number: prototypeVersion.number, createdAt: prototypeVersion.createdAt }),
    ...chunks(files, filesPerInsert).map((chunk) =>
      db.insert(prototypeVersionFile).values(chunk.map((file) => ({ versionId: id, ...file }))),
    ),
    db.update(prototype).set({ updatedAt: at }).where(eq(prototype.id, prototypeId)),
  ]);
  const [version] = inserted;
  if (!version) throw new Error("D1 returned no row for the version just inserted");
  const entries = files
    .map((file) => ({ path: file.path, hash: file.hash, size: sizes.get(file.hash) ?? 0 }))
    .toSorted((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return { kind: "created", version: { ...version, files: entries } };
}

/** The owner's prototype's versions, newest first, or `null` when it isn't theirs. */
export async function listVersions(
  db: Db,
  ownerId: string,
  prototypeId: string,
): Promise<PrototypeVersion[] | null> {
  if (!(await ownsPrototype(db, ownerId, prototypeId))) return null;
  return db
    .select({ number: prototypeVersion.number, createdAt: prototypeVersion.createdAt })
    .from(prototypeVersion)
    .where(eq(prototypeVersion.prototypeId, prototypeId))
    .orderBy(desc(prototypeVersion.number));
}

/** One version with its files sorted by path, or `null` when there is no such version of theirs. */
export async function getVersion(
  db: Db,
  ownerId: string,
  prototypeId: string,
  number: number,
): Promise<PrototypeVersionDetail | null> {
  if (!(await ownsPrototype(db, ownerId, prototypeId))) return null;
  const [version] = await db
    .select({
      id: prototypeVersion.id,
      number: prototypeVersion.number,
      createdAt: prototypeVersion.createdAt,
    })
    .from(prototypeVersion)
    .where(and(eq(prototypeVersion.prototypeId, prototypeId), eq(prototypeVersion.number, number)));
  if (!version) return null;
  const files = await db
    .select({
      path: prototypeVersionFile.path,
      hash: prototypeVersionFile.hash,
      size: prototypeFileContent.size,
    })
    .from(prototypeVersionFile)
    .innerJoin(
      prototypeFileContent,
      and(
        eq(prototypeFileContent.prototypeId, prototypeId),
        eq(prototypeFileContent.hash, prototypeVersionFile.hash),
      ),
    )
    .where(eq(prototypeVersionFile.versionId, version.id))
    .orderBy(asc(prototypeVersionFile.path));
  return { number: version.number, createdAt: version.createdAt, files };
}

/** Saved content of the owner's prototype, or `null` when there is none under `hash`. */
export async function readFileContent(
  db: Db,
  bucket: R2Bucket,
  ownerId: string,
  prototypeId: string,
  hash: string,
): Promise<R2ObjectBody | null> {
  if (!(await ownsPrototype(db, ownerId, prototypeId))) return null;
  return bucket.get(contentKey(prototypeId, hash));
}

async function ownsPrototype(db: Db, ownerId: string, prototypeId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: prototype.id })
    .from(prototype)
    .where(and(eq(prototype.id, prototypeId), eq(prototype.ownerId, ownerId)));
  return row !== undefined;
}

async function contentSizes(
  db: Db,
  prototypeId: string,
  hashes: readonly string[],
): Promise<Map<string, number>> {
  const sizes = new Map<string, number>();
  for (const chunk of chunks(hashes, hashesPerQuery)) {
    const rows = await db
      .select({ hash: prototypeFileContent.hash, size: prototypeFileContent.size })
      .from(prototypeFileContent)
      .where(
        and(
          eq(prototypeFileContent.prototypeId, prototypeId),
          inArray(prototypeFileContent.hash, chunk),
        ),
      );
    for (const row of rows) sizes.set(row.hash, row.size);
  }
  return sizes;
}

function chunks<T>(items: readonly T[], size: number): T[][] {
  const result: T[][] = [];
  for (let start = 0; start < items.length; start += size) {
    result.push(items.slice(start, start + size));
  }
  return result;
}
