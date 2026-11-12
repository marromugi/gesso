import { afterAll, beforeAll, expect, test } from "vitest";
import { app } from "../app.ts";
import { servePlay } from "../play/servePlay.ts";
import {
  type LocalPlatform,
  addPrototype,
  addUser,
  allowedGitHubId,
  signIn,
  startLocalPlatform,
} from "../testing/localPlatform.ts";
import { hashContent } from "./versionFiles.ts";

let platform: LocalPlatform;
let cookie: string;

beforeAll(async () => {
  platform = await startLocalPlatform();
  await addUser(platform.env, "owner", allowedGitHubId);
  await addUser(platform.env, "other", allowedGitHubId);
  await addPrototype(platform.env, "mine", "owner");
  await addPrototype(platform.env, "theirs", "other");
  cookie = await signIn(platform.env, "owner");
});

afterAll(async () => {
  await platform.dispose();
});

function request(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (!headers.has("cookie")) headers.set("cookie", cookie);
  // Node's Request leaves it out for a string body; a browser or the CLI sends it.
  if (typeof init.body === "string") {
    headers.set("content-length", String(new TextEncoder().encode(init.body).byteLength));
  }
  return Promise.resolve(app.request(path, { ...init, headers }, platform.env));
}

async function upload(
  prototypeId: string,
  text: string,
): Promise<{ hash: string; response: Response }> {
  const hash = await hashContent(await new Blob([text]).arrayBuffer());
  const response = await request(`/prototypes/${prototypeId}/files/${hash}`, {
    method: "PUT",
    headers: { "content-type": "application/octet-stream" },
    body: text,
  });
  return { hash, response };
}

function postVersion(prototypeId: string, files: { path: string; hash: string }[]) {
  return request(`/prototypes/${prototypeId}/versions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ files }),
  });
}

async function versionNumbers(prototypeId: string): Promise<number[]> {
  const response = await request(`/prototypes/${prototypeId}/versions`);
  const body: { versions: { number: number }[] } = await response.json();
  return body.versions.map((version) => version.number);
}

test("the session in the tests is a signed-in user", async () => {
  expect(await (await request("/me")).json()).toMatchObject({ user: { id: "owner" } });
});

test("uploaded files make a version, and its content downloads but never runs here", async () => {
  const page = await upload("mine", "<h1>v1</h1>");
  expect(page.response.status).toBe(204);

  const created = await postVersion("mine", [{ path: "index.html", hash: page.hash }]);
  expect(created.status).toBe(201);
  expect(await created.json()).toMatchObject({
    number: 1,
    files: [{ path: "index.html", hash: page.hash, size: 11 }],
  });

  const download = await request(`/prototypes/mine/files/${page.hash}`);
  expect(download.status).toBe(200);
  expect(download.headers.get("content-type")).toBe("application/octet-stream");
  expect(download.headers.get("content-disposition")).toBe("attachment");
  expect(download.headers.get("x-content-type-options")).toBe("nosniff");
  expect(await download.text()).toBe("<h1>v1</h1>");
});

test("without a session nothing is reachable", async () => {
  const response = await request("/prototypes/mine/versions", { headers: { cookie: "" } });
  expect(response.status).toBe(401);
});

test("content that isn't what its hash says is refused", async () => {
  const response = await request(`/prototypes/mine/files/${"0".repeat(64)}`, {
    method: "PUT",
    headers: { "content-type": "application/octet-stream" },
    body: "real",
  });
  expect(response.status).toBe(422);
  expect(await response.json()).toEqual({
    error: "hash_mismatch",
    actual: await hashContent(await new Blob(["real"]).arrayBuffer()),
  });
});

test("a version with content not uploaded yet names it and makes nothing", async () => {
  const before = await versionNumbers("mine");
  const page = await upload("mine", "<h1>missing</h1>");
  const missing = "f".repeat(64);

  const response = await postVersion("mine", [
    { path: "index.html", hash: page.hash },
    { path: "game.js", hash: missing },
  ]);

  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({ error: "missing_content", hashes: [missing] });
  expect(await versionNumbers("mine")).toEqual(before);
});

test.each([
  ["a path outside the version", [{ path: "index.html" }, { path: "../game.js" }]],
  ["a file that is also a directory", [{ path: "index.html" }, { path: "index.html/x.js" }]],
  ["paths that differ only in case", [{ path: "index.html" }, { path: "Index.html" }]],
  ["no index.html at the root", [{ path: "src/index.html" }]],
])("a version with %s is refused and makes nothing", async (_, paths) => {
  const before = await versionNumbers("mine");
  const page = await upload("mine", "<h1>paths</h1>");

  const response = await postVersion(
    "mine",
    paths.map(({ path }) => ({ path, hash: page.hash })),
  );

  expect(response.status).toBe(400);
  expect(await versionNumbers("mine")).toEqual(before);
});

test("someone else's prototype is not found, even for content they saved", async () => {
  const otherCookie = await signIn(platform.env, "other");
  const hash = await hashContent(await new Blob(["theirs"]).arrayBuffer());
  const saved = await request(`/prototypes/theirs/files/${hash}`, {
    method: "PUT",
    headers: { "content-type": "application/octet-stream", cookie: otherCookie },
    body: "theirs",
  });
  expect(saved.status).toBe(204);

  expect((await request(`/prototypes/theirs/files/${hash}`)).status).toBe(404);
  expect((await request("/prototypes/theirs/versions")).status).toBe(404);
  expect((await upload("theirs", "mine")).response.status).toBe(404);
  expect((await postVersion("theirs", [{ path: "index.html", hash }])).status).toBe(404);
});

test("a play URL opens the version on the play Worker, only for its owner", async () => {
  const page = await upload("mine", "<h1>play</h1>");
  const created = await postVersion("mine", [{ path: "index.html", hash: page.hash }]);
  const { number }: { number: number } = await created.json();

  const response = await request(`/prototypes/mine/versions/${number}/play`, { method: "POST" });
  expect(response.status).toBe(201);
  const { url }: { url: string } = await response.json();
  expect(url.startsWith(`${platform.env.PLAY_ORIGIN}/`)).toBe(true);
  expect(await (await servePlay(new Request(url), platform.env)).text()).toBe("<h1>play</h1>");

  const missing = await request("/prototypes/mine/versions/999/play", { method: "POST" });
  expect(missing.status).toBe(404);
  const theirs = await request("/prototypes/theirs/versions/1/play", { method: "POST" });
  expect(theirs.status).toBe(404);
});

test("a prototype is read by its owner alone", async () => {
  const mine = await request("/prototypes/mine");
  expect(await mine.json()).toMatchObject({ id: "mine", name: "mine" });
  expect((await request("/prototypes/theirs")).status).toBe(404);
});
