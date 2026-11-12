import { getDb } from "../db/index.ts";
import { readPlayFile } from "../prototypes/playStore.ts";
import { parseByteRange, rangeBounds } from "./byteRange.ts";
import { contentTypeOf } from "./contentType.ts";
import { parsePlayRequest } from "./playRequest.ts";

/** What the play Worker is bound to (`wrangler.play.jsonc`). */
export type PlayEnv = Pick<Env, "DB" | "PROTOTYPE_FILES">;

/**
 * Answers a request to the play Worker: `/<token>/<path>` gets that file of the version the
 * token is for, as it was uploaded. Anything else, or a token that has expired, is 404.
 */
export async function servePlay(request: Request, env: PlayEnv): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response(null, { status: 405, headers: { allow: "GET, HEAD" } });
  }
  const parsed = parsePlayRequest(new URL(request.url).pathname);
  if (parsed.kind === "invalid") return notFound();
  if (parsed.kind === "addSlash") {
    return new Response(null, { status: 308, headers: { location: parsed.location } });
  }
  const file = await readPlayFile(
    getDb(env.DB),
    env.PROTOTYPE_FILES,
    parsed.token,
    parsed.path,
    // Safari plays audio and video only from a server that answers ranges.
    parseByteRange(request.headers.get("range")),
    new Date(),
  );
  if (!file) return notFound();
  if (request.method === "HEAD") await file.body.cancel();
  const headers = new Headers({
    "content-type": contentTypeOf(parsed.path),
    "content-length": String(file.size),
    "accept-ranges": "bytes",
    "x-content-type-options": "nosniff",
    // The token is in every URL; a page the prototype links to must not learn it.
    "referrer-policy": "no-referrer",
    "cache-control": "private, no-cache",
  });
  let status = 200;
  if (file.range !== null) {
    const { start, end } = rangeBounds(file.range, file.size);
    status = 206;
    headers.set("content-range", `bytes ${start}-${end}/${file.size}`);
    headers.set("content-length", String(end - start + 1));
  }
  return new Response(request.method === "HEAD" ? null : file.body, { status, headers });
}

function notFound(): Response {
  return new Response("Not found", { status: 404, headers: { "referrer-policy": "no-referrer" } });
}
