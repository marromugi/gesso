import { createReadStream } from "node:fs";
import { lstat, realpath } from "node:fs/promises";
import { type Server, createServer } from "node:http";
import { extname, join, sep } from "node:path";

/** Content types by extension, for what a browser game loads (as the play Worker sends them). */
const contentTypes: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".wasm": "application/wasm",
  ".glb": "model/gltf-binary",
  ".gltf": "model/gltf+json",
};

/**
 * Serves the files of `dir` on this machine only (127.0.0.1), as the play Worker serves a
 * version: a path ending in `/` is its `index.html`, nothing outside `dir`, and no caching.
 * Resolves once it listens.
 */
export async function serveFolder(dir: string, port: number): Promise<Server> {
  const root = await realpath(dir);
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    let path: string;
    try {
      path = decodeURIComponent(url.pathname);
    } catch {
      path = "";
    }
    if (path.endsWith("/")) path += "index.html";
    const file = join(root, path);
    const found =
      file.startsWith(`${root}${sep}`) && (await lstat(file).catch(() => null))?.isFile();
    if (!found || (await realpath(file)) !== file) {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }
    response.writeHead(200, {
      "content-type": contentTypes[extname(file).toLowerCase()] ?? "application/octet-stream",
      "cache-control": "no-store",
    });
    createReadStream(file).pipe(response);
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  return server;
}
