import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { type Server, request } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, expect, test } from "vitest";
import { serveFolder, servedPath } from "./serve.ts";

let root: string;
let server: Server;
let port: number;

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "gesso-serve-"));
  await mkdir(join(root, "game", "src"), { recursive: true });
  await mkdir(join(root, "game", ".git"), { recursive: true });
  await writeFile(join(root, "game", "index.html"), "<h1>game</h1>");
  await writeFile(join(root, "game", "src", "main.js"), "go()");
  await writeFile(join(root, "game", "src", "font.woff2"), "font");
  await writeFile(join(root, "game", ".git", "config"), "[core]");
  await writeFile(join(root, "game", ".env"), "SECRET=1");
  await writeFile(join(root, "secret.txt"), "outside");
  await symlink(join(root, "secret.txt"), join(root, "game", "link.txt"));
  await mkdir(join(root, "elsewhere"));
  await writeFile(join(root, "elsewhere", "x.js"), "outside()");
  await symlink(join(root, "elsewhere"), join(root, "game", "assets"));
  server = await serveFolder(join(root, "game"), 0);
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("not listening on a port");
  ({ port } = address);
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
  await rm(root, { recursive: true, force: true });
});

/** Sends a request as it is, path and `Host` untouched (`fetch` would tidy both). */
function send(
  path: string,
  { method = "GET", host = `127.0.0.1:${port}` } = {},
): Promise<{
  status: number;
  type: string | undefined;
  location: string | undefined;
  body: string;
}> {
  return new Promise((resolve, reject) => {
    const outgoing = request(
      { host: "127.0.0.1", port, path, method, headers: { host } },
      (res) => {
        let body = "";
        res.on("data", (chunk: Buffer) => {
          body += chunk.toString();
        });
        res.on("end", () =>
          resolve({
            status: res.statusCode ?? 0,
            type: res.headers["content-type"],
            location: res.headers.location,
            body,
          }),
        );
      },
    );
    outgoing.on("error", reject);
    outgoing.end();
  });
}

test("the folder is served under a path of its own, as gesso plays a version", async () => {
  expect(await send("/")).toMatchObject({ status: 308, location: servedPath });
  expect(await send(servedPath)).toMatchObject({
    status: 200,
    type: "text/html; charset=utf-8",
    body: "<h1>game</h1>",
  });
  expect(await send(`${servedPath}src/main.js?seed=1`)).toMatchObject({
    type: "text/javascript; charset=utf-8",
    body: "go()",
  });
  expect(await send(`${servedPath}src/font.woff2`)).toMatchObject({ type: "font/woff2" });
});

test.each([
  ["outside the folder", "..%2f..%2fsecret.txt"],
  ["that is a link", "link.txt"],
  ["in a linked folder", "assets/x.js"],
  ["of git", ".git/config"],
  ["starting with a dot", ".env"],
  ["missing", "nothing.js"],
])("a file %s is not found, as no version holds it", async (_, path) => {
  expect((await send(`${servedPath}${path}`)).status).toBe(404);
});

test("only this machine's names are answered, and only reading", async () => {
  expect((await send(servedPath, { host: "attacker.example:80" })).status).toBe(403);
  expect((await send(servedPath, { host: `localhost:${port}` })).status).toBe(200);
  expect((await send(servedPath, { method: "POST" })).status).toBe(405);
});
