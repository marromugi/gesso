import { afterAll, beforeAll, expect, test } from "vitest";
import { type Db, getDb } from "../db/index.ts";
import { issuePlayToken } from "../prototypes/playStore.ts";
import { hashContent } from "../prototypes/versionFiles.ts";
import { createVersion, saveFileContent } from "../prototypes/versionStore.ts";
import {
  type LocalPlatform,
  addPrototype,
  addUser,
  allowedGitHubId,
  startLocalPlatform,
} from "../testing/localPlatform.ts";
import { servePlay } from "./servePlay.ts";

const owner = "owner";
const playOrigin = "http://play.test";

let platform: LocalPlatform;
let db: Db;
/** A token for version 1, which has `index.html` and `src/game.js`. */
let token: string;

beforeAll(async () => {
  platform = await startLocalPlatform();
  db = getDb(platform.env.DB);
  await addUser(platform.env, owner, allowedGitHubId);
  await addPrototype(platform.env, "game", owner);
  await makeVersion({
    "index.html": "<script type=module src=src/game.js></script>",
    "src/game.js": "jump()",
  });
  await makeVersion({
    "index.html": "<h1>v2</h1>",
    "levels/index.html": "<h1>levels</h1>",
    "levels/one.tmx": "<map/>",
  });
  token = await tokenFor(1, new Date());
});

afterAll(async () => {
  await platform.dispose();
});

async function makeVersion(files: Record<string, string>): Promise<void> {
  const entries = [];
  for (const [path, text] of Object.entries(files)) {
    const content = await new Blob([text]).arrayBuffer();
    const hash = await hashContent(content);
    const now = new Date();
    await saveFileContent(db, platform.env.PROTOTYPE_FILES, owner, "game", hash, content, now);
    entries.push({ path, hash });
  }
  await createVersion(db, owner, "game", entries, new Date());
}

async function tokenFor(number: number, now: Date): Promise<string> {
  const play = await issuePlayToken(db, owner, "game", number, now);
  if (!play) throw new Error(`version ${number} should exist`);
  return play.token;
}

function get(path: string, init: RequestInit = {}): Promise<Response> {
  return servePlay(new Request(`${playOrigin}${path}`, init), platform.env);
}

test("a token plays its version's files, each with the type a browser runs it as", async () => {
  const page = await get(`/${token}/`);
  expect(page.status).toBe(200);
  expect(page.headers.get("content-type")).toBe("text/html; charset=utf-8");
  expect(page.headers.get("x-content-type-options")).toBe("nosniff");
  expect(page.headers.get("referrer-policy")).toBe("no-referrer");
  expect(await page.text()).toBe("<script type=module src=src/game.js></script>");

  const script = await get(`/${token}/src/game.js`);
  expect(script.status).toBe(200);
  expect(script.headers.get("content-type")).toBe("text/javascript; charset=utf-8");
  expect(await script.text()).toBe("jump()");
});

test("a directory plays its index.html, and a file of an unknown kind is plain bytes", async () => {
  const second = await tokenFor(2, new Date());
  expect(await (await get(`/${second}/levels/`)).text()).toBe("<h1>levels</h1>");
  const map = await get(`/${second}/levels/one.tmx`);
  expect(map.headers.get("content-type")).toBe("application/octet-stream");
});

test("the token alone is sent to its page, so relative URLs stay inside the version", async () => {
  const response = await get(`/${token}`);
  expect(response.status).toBe(308);
  expect(response.headers.get("location")).toBe(`/${token}/`);
});

test("a token reaches only its own version's files", async () => {
  expect((await get(`/${token}/levels/index.html`)).status).toBe(404);
  const second = await tokenFor(2, new Date());
  expect(await (await get(`/${second}/levels/one.tmx`)).text()).toBe("<map/>");
  expect((await get(`/${second}/src/game.js`)).status).toBe(404);
});

test("a token plays for 12 hours from when it is made", async () => {
  const play = await issuePlayToken(db, owner, "game", 1, new Date("2026-11-12T00:00:00.000Z"));
  expect(play?.expiresAt).toBe("2026-11-12T12:00:00.000Z");
});

test("an expired or unknown token plays nothing", async () => {
  const expired = await tokenFor(1, new Date("2026-01-01T00:00:00.000Z"));
  expect((await get(`/${expired}/`)).status).toBe(404);
  expect((await get("/not-a-token/")).status).toBe(404);
});

test("expired tokens are deleted when a new one is made", async () => {
  const expired = await tokenFor(1, new Date("2026-01-01T00:00:00.000Z"));
  await tokenFor(1, new Date());
  const row = await platform.env.DB.prepare(`select token from prototypePlayToken where token = ?`)
    .bind(expired)
    .first();
  expect(row).toBeNull();
});

test.each([
  ["a broken escape", "/%E0%A4%A/index.html"],
  ["nothing but the origin", ""],
])("%s is not found", async (_, rest) => {
  expect((await get(rest === "" ? "/" : `/${token}${rest}`)).status).toBe(404);
});

test.each([
  ["bytes=1-3", "ump", "bytes 1-3/6"],
  ["bytes=4-", "()", "bytes 4-5/6"],
  ["bytes=-2", "()", "bytes 4-5/6"],
  ["bytes=2-99", "mp()", "bytes 2-5/6"],
])("a range %s gets just those bytes, as audio and video ask for", async (range, body, sent) => {
  const response = await get(`/${token}/src/game.js`, { headers: { range } });
  expect(response.status).toBe(206);
  expect(response.headers.get("content-range")).toBe(sent);
  expect(response.headers.get("content-length")).toBe(String(body.length));
  expect(await response.text()).toBe(body);
});

test.each(["bytes=6-", "bytes=0-1,3-4", "items=0-1"])(
  "a range %s that can't be served gets the whole file",
  async (range) => {
    const response = await get(`/${token}/src/game.js`, { headers: { range } });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("jump()");
  },
);

test("only reading is allowed", async () => {
  expect((await get(`/${token}/`, { method: "POST" })).status).toBe(405);
  const head = await get(`/${token}/src/game.js`, { method: "HEAD" });
  expect(head.status).toBe(200);
  expect(head.headers.get("content-length")).toBe("6");
});
