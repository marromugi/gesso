import { and, eq, gt, lt } from "drizzle-orm";
import { type Db, tables } from "../db/index.ts";
import { contentKey } from "./versionStore.ts";

const {
  prototype,
  prototypeFileContent,
  prototypePlayToken,
  prototypeVersion,
  prototypeVersionFile,
} = tables;

/** How long a play token lets its version be played. */
export const playTokenLifetimeMs = 12 * 60 * 60 * 1000;

/** Random bytes in a play token. */
const playTokenBytes = 32;

export type PlayToken = { token: string; expiresAt: string };

/**
 * A file of the version a play token is for: all of it, or only `range` of it when one was asked
 * for and fits in the file. `size` is the whole file's.
 */
export type PlayFile = { body: ReadableStream; size: number; range: R2Range | null };

/**
 * Makes a token that lets the owner's prototype's version `number` be played until
 * `playTokenLifetimeMs` from `now`, or `null` when there is no such version of theirs. Tokens
 * that have expired are deleted on the way.
 */
export async function issuePlayToken(
  db: Db,
  ownerId: string,
  prototypeId: string,
  number: number,
  now: Date,
): Promise<PlayToken | null> {
  const [version] = await db
    .select({ id: prototypeVersion.id })
    .from(prototypeVersion)
    .innerJoin(prototype, eq(prototype.id, prototypeVersion.prototypeId))
    .where(
      and(
        eq(prototypeVersion.prototypeId, prototypeId),
        eq(prototypeVersion.number, number),
        eq(prototype.ownerId, ownerId),
      ),
    );
  if (!version) return null;
  const token = randomToken();
  const at = now.toISOString();
  const expiresAt = new Date(now.getTime() + playTokenLifetimeMs).toISOString();
  await db.batch([
    db.delete(prototypePlayToken).where(lt(prototypePlayToken.expiresAt, at)),
    db
      .insert(prototypePlayToken)
      .values({ token, versionId: version.id, expiresAt, createdAt: at }),
  ]);
  return { token, expiresAt };
}

/**
 * The file at `path` in the version `token` is for, or `null` when the token has expired or
 * isn't one, or the version has no such file. With `range`, only that part is read, unless it
 * starts past the end of the file.
 */
export async function readPlayFile(
  db: Db,
  bucket: R2Bucket,
  token: string,
  path: string,
  range: R2Range | null,
  now: Date,
): Promise<PlayFile | null> {
  const [file] = await db
    .select({
      prototypeId: prototypeVersion.prototypeId,
      hash: prototypeVersionFile.hash,
      size: prototypeFileContent.size,
    })
    .from(prototypePlayToken)
    .innerJoin(prototypeVersion, eq(prototypeVersion.id, prototypePlayToken.versionId))
    .innerJoin(prototypeVersionFile, eq(prototypeVersionFile.versionId, prototypeVersion.id))
    .innerJoin(
      prototypeFileContent,
      and(
        eq(prototypeFileContent.prototypeId, prototypeVersion.prototypeId),
        eq(prototypeFileContent.hash, prototypeVersionFile.hash),
      ),
    )
    .where(
      and(
        eq(prototypePlayToken.token, token),
        gt(prototypePlayToken.expiresAt, now.toISOString()),
        eq(prototypeVersionFile.path, path),
      ),
    );
  if (!file) return null;
  const fits = range !== null && fitsIn(range, file.size);
  const content = await bucket.get(
    contentKey(file.prototypeId, file.hash),
    fits ? { range } : undefined,
  );
  if (!content) {
    throw new Error(
      `R2 has no content for ${file.hash}, though a version of ${file.prototypeId} lists it`,
    );
  }
  return { body: content.body, size: file.size, range: fits ? range : null };
}

/** Whether `range` has at least one byte of a file of `size` bytes. */
function fitsIn(range: R2Range, size: number): boolean {
  if ("suffix" in range) return size > 0;
  return (range.offset ?? 0) < size;
}

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(playTokenBytes));
  return Buffer.from(bytes).toString("base64url");
}
