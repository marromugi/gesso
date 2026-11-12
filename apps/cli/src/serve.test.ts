import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, expect, test } from "vitest";
import { serveFolder } from "./serve.ts";

let root: string;
let server: Server;
let origin: string;

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "gesso-serve-"));
  await mkdir(join(root, "game", "src"), { recursive: true });
  await writeFile(join(root, "game", "index.html"), "<h1>game</h1>");
  await writeFile(join(root, "game", "src", "main.js"), "go()");
  await writeFile(join(root, "secret.txt"), "outside");
  await symlink(join(root, "secret.txt"), join(root, "game", "link.txt"));
  server = await serveFolder(join(root, "game"), 0);
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("not listening on a port");
  origin = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
  await rm(root, { recursive: true, force: true });
});

test("the folder's files are served as a browser runs them, with index.html for /", async () => {
  const page = await fetch(`${origin}/`);
  expect(page.headers.get("content-type")).toBe("text/html; charset=utf-8");
  expect(await page.text()).toBe("<h1>game</h1>");

  const script = await fetch(`${origin}/src/main.js?seed=1`);
  expect(script.headers.get("content-type")).toBe("text/javascript; charset=utf-8");
  expect(await script.text()).toBe("go()");
});

test.each([
  ["outside the folder", "/%2e%2e/secret.txt"],
  ["through a link", "/link.txt"],
  ["missing", "/nothing.js"],
])("a file %s is not found", async (_, path) => {
  expect((await fetch(`${origin}${path}`)).status).toBe(404);
});
