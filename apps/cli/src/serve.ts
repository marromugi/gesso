import { createReadStream } from "node:fs";
import { lstat, realpath, stat } from "node:fs/promises";
import { type IncomingMessage, type Server, type ServerResponse, createServer } from "node:http";
import { join, sep } from "node:path";
import { contentTypeOf } from "@gesso/api/contentType";
import { CliError } from "./cliError.ts";
import { isVersionPath } from "./workspace.ts";

/**
 * Where the folder is served, under a path of its own as the play Worker serves a version under
 * `/<token>/`: a page that reaches for `/src/main.js` breaks here as it would on gesso.
 */
export const servedPath = "/play/";

/** Hosts a request may name: this machine only, so another site can't read through a rebound name. */
const localHosts: ReadonlySet<string> = new Set(["localhost", "127.0.0.1"]);

/**
 * Serves the files of `dir` on this machine only (127.0.0.1) as the play Worker serves a version:
 * under `servedPath`, `index.html` for a path ending in `/`, with the same content types, and
 * only files a version holds (nothing outside `dir`, no dot files, no `node_modules`, no links).
 * Resolves once it listens; throws `CliError` when `dir` isn't a folder.
 */
export async function serveFolder(dir: string, port: number): Promise<Server> {
  const found = await stat(dir).catch(() => null);
  if (!found?.isDirectory()) throw new CliError(`${dir} はフォルダーではありません。`);
  const root = await realpath(dir);
  const server = createServer((request, response) => {
    answer(root, request, response).catch((error: unknown) => {
      console.error(error);
      if (!response.headersSent) response.writeHead(500);
      response.end();
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  return server;
}

async function answer(root: string, request: IncomingMessage, response: ServerResponse) {
  const host = URL.parse(`http://${request.headers.host ?? ""}`)?.hostname ?? "";
  if (!localHosts.has(host)) return notFound(response, 403);
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { allow: "GET, HEAD" });
    response.end();
    return;
  }
  const url = new URL(request.url ?? "/", "http://localhost");
  if (!url.pathname.startsWith(servedPath)) {
    response.writeHead(308, { location: servedPath });
    response.end();
    return;
  }
  let path: string;
  try {
    path = decodeURIComponent(url.pathname.slice(servedPath.length));
  } catch {
    return notFound(response);
  }
  if (path === "" || path.endsWith("/")) path += "index.html";
  if (!isVersionPath(path)) return notFound(response);
  const file = join(root, path);
  const isFile = (await lstat(file).catch(() => null))?.isFile() ?? false;
  // A link anywhere on the way makes the real path differ; a version never holds one.
  if (!file.startsWith(`${root}${sep}`) || !isFile || (await realpath(file)) !== file) {
    return notFound(response);
  }
  response.writeHead(200, {
    "content-type": contentTypeOf(path),
    "x-content-type-options": "nosniff",
    "cache-control": "no-store",
  });
  const stream = createReadStream(file);
  stream.on("error", () => response.destroy());
  stream.pipe(response);
}

function notFound(response: ServerResponse, status = 404) {
  response.writeHead(status, { "content-type": "text/plain; charset=utf-8" });
  response.end(status === 404 ? "Not found" : "Forbidden");
}
