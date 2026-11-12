import { and, eq, gt, lt } from "drizzle-orm";
import { type Db, tables } from "../db/index.ts";
import { contentKey } from "./versionStore.ts";

const { prototype, prototypePlayToken, prototypeVersion, prototypeVersionFile } = tables;

/** How long a play token lets its version be played. */
export const playTokenLifetimeMs = 12 * 60 * 60 * 1000;

/** Random bytes in a play token. */
const playTokenBytes = 32;

export type PlayToken = { token: string; expiresAt: string };

/** A file of the version a play token is for. */
export type PlayFile = { body: ReadableStream; size: number };

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
 * isn't one, or the version has no such file.
 */
export async function readPlayFile(
  db: Db,
  bucket: R2Bucket,
  token: string,
  path: string,
  now: Date,
): Promise<PlayFile | null> {
  const [file] = await db
    .select({ prototypeId: prototypeVersion.prototypeId, hash: prototypeVersionFile.hash })
    .from(prototypePlayToken)
    .innerJoin(prototypeVersion, eq(prototypeVersion.id, prototypePlayToken.versionId))
    .innerJoin(prototypeVersionFile, eq(prototypeVersionFile.versionId, prototypeVersion.id))
    .where(
      and(
        eq(prototypePlayToken.token, token),
        gt(prototypePlayToken.expiresAt, now.toISOString()),
        eq(prototypeVersionFile.path, path),
      ),
    );
  if (!file) return null;
  const content = await bucket.get(contentKey(file.prototypeId, file.hash));
  if (!content) {
    throw new Error(
      `R2 has no content for ${file.hash}, though a version of ${file.prototypeId} lists it`,
    );
  }
  return { body: content.body, size: content.size };
}

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(playTokenBytes));
  return Buffer.from(bytes).toString("base64url");
}
