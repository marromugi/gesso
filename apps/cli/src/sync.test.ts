import { mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, test } from "vitest";
import type { ApiClient, VersionFile } from "./api.ts";
import { pull, push } from "./sync.ts";
import { hashContent, writeLocalFile } from "./workspace.ts";

const prototypeId = "p1";

/**
 * Stands in for the API: one prototype, its versions, and the content uploaded for it.
 * `uploads` counts the content sent.
 */
function fakeApi() {
  const contents = new Map<string, Uint8Array>();
  const versions: VersionFile[][] = [];
  const state = { uploads: 0 };
  const client: ApiClient = {
    me: async () => ({ name: "owner" }),
    endSession: async () => {},
    listPrototypes: async () => [{ id: prototypeId, name: "jump" }],
    listVersions: async () =>
      versions.map((_, index) => ({ number: index + 1, createdAt: "" })).toReversed(),
    versionFiles: async (_, number) => versions[number - 1] ?? [],
    readContent: async (_, hash) => contents.get(hash) ?? new Uint8Array(),
    saveContent: async (_, hash, content) => {
      state.uploads += 1;
      contents.set(hash, content);
    },
    createVersion: async (_, files) => {
      const missing = files.map((file) => file.hash).filter((hash) => !contents.has(hash));
      if (missing.length > 0) return { kind: "missingContent", hashes: [...new Set(missing)] };
      versions.push(files);
      return { kind: "created", number: versions.length };
    },
  };
  /** Makes a version straight in the fake, as another machine's push would. */
  function addVersion(files: Record<string, string>) {
    const entries = Object.entries(files).map(([path, text]) => {
      const content = new TextEncoder().encode(text);
      contents.set(hashContent(content), content);
      return { path, hash: hashContent(content) };
    });
    versions.push(entries);
  }
  return { client, state, addVersion };
}

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "gesso-cli-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function read(path: string): Promise<string> {
  return readFile(join(dir, path), "utf8");
}

async function write(path: string, text: string): Promise<void> {
  await writeLocalFile(dir, path, new TextEncoder().encode(text));
}

test("pull puts the newest version in an empty folder, and push sends the change back", async () => {
  const api = fakeApi();
  api.addVersion({ "index.html": "<h1>1</h1>", "src/game.js": "jump()" });

  expect(await pull(api.client, prototypeId, dir)).toEqual({
    version: 1,
    written: 2,
    deleted: 0,
  });
  expect(await read("src/game.js")).toBe("jump()");

  await write("src/game.js", "jump(2)");
  await write("src/enemy.js", "walk()");
  const pushed = await push(api.client, dir);

  // Only the two new contents are uploaded; index.html is already there.
  expect(pushed).toEqual({ kind: "created", version: 2, uploaded: 2, files: 3 });
  expect(api.state.uploads).toBe(2);
  expect((await api.client.versionFiles(prototypeId, 2)).map((file) => file.path)).toEqual([
    "index.html",
    "src/enemy.js",
    "src/game.js",
  ]);
});

test("pull makes a folder that isn't there yet", async () => {
  const api = fakeApi();
  api.addVersion({ "index.html": "<h1>1</h1>" });
  const folder = join(dir, "new");

  await pull(api.client, prototypeId, folder);

  expect(await readFile(join(folder, "index.html"), "utf8")).toBe("<h1>1</h1>");
});

test("push with nothing changed makes no version", async () => {
  const api = fakeApi();
  api.addVersion({ "index.html": "<h1>1</h1>" });
  await pull(api.client, prototypeId, dir);

  expect(await push(api.client, dir)).toEqual({ kind: "unchanged", version: 1 });
  expect(await api.client.listVersions(prototypeId)).toHaveLength(1);
});

test("push leaves out dot files and node_modules", async () => {
  const api = fakeApi();
  api.addVersion({ "index.html": "<h1>1</h1>" });
  await pull(api.client, prototypeId, dir);
  await write(".env", "SECRET=1");
  await write(".git/HEAD", "ref");
  await write("node_modules/lib/index.js", "x");
  await write("game.js", "go()");

  await push(api.client, dir);

  expect((await api.client.versionFiles(prototypeId, 2)).map((file) => file.path)).toEqual([
    "game.js",
    "index.html",
  ]);
});

test("pulling another version replaces the old one's files and leaves files gesso never had", async () => {
  const api = fakeApi();
  api.addVersion({ "index.html": "<h1>1</h1>", "old.js": "old()" });
  api.addVersion({ "index.html": "<h1>2</h1>", "new.js": "new()" });
  await pull(api.client, prototypeId, dir, { number: 1 });
  await write("notes.txt", "mine");

  expect(await pull(api.client, prototypeId, dir)).toEqual({
    version: 2,
    written: 2,
    deleted: 1,
  });
  expect((await readdir(dir)).toSorted()).toEqual([
    ".gesso.json",
    "index.html",
    "new.js",
    "notes.txt",
  ]);
});

test("pull refuses to overwrite files changed since, unless forced", async () => {
  const api = fakeApi();
  api.addVersion({ "index.html": "<h1>1</h1>" });
  api.addVersion({ "index.html": "<h1>2</h1>" });
  await pull(api.client, prototypeId, dir, { number: 1 });
  await write("index.html", "<h1>edited</h1>");

  await expect(pull(api.client, prototypeId, dir)).rejects.toThrow(/index\.html/);
  expect(await read("index.html")).toBe("<h1>edited</h1>");

  await pull(api.client, prototypeId, dir, { force: true });
  expect(await read("index.html")).toBe("<h1>2</h1>");
});

test("pull refuses to overwrite a file gesso never had that the version also has", async () => {
  const api = fakeApi();
  api.addVersion({ "index.html": "<h1>1</h1>" });
  api.addVersion({ "index.html": "<h1>1</h1>", "game.js": "theirs()" });
  await pull(api.client, prototypeId, dir, { number: 1 });
  await write("game.js", "mine()");

  await expect(pull(api.client, prototypeId, dir)).rejects.toThrow(/game\.js/);
  expect(await read("game.js")).toBe("mine()");
});

test.each([
  ["a folder with other files", async () => writeFile(join(dir, "a.txt"), "a")],
  [
    "another prototype's folder",
    async () =>
      writeFile(
        join(dir, ".gesso.json"),
        JSON.stringify({ format: 1, prototypeId: "other", version: 1, files: {} }),
      ),
  ],
])("pull refuses %s", async (_, prepare) => {
  const api = fakeApi();
  api.addVersion({ "index.html": "<h1>1</h1>" });
  await prepare();

  await expect(pull(api.client, prototypeId, dir)).rejects.toThrow();
  await expect(read("index.html")).rejects.toThrow();
});

test("a prototype with no version gets a folder to push its first version from", async () => {
  const api = fakeApi();

  expect(await pull(api.client, prototypeId, dir)).toEqual({ version: 0, written: 0, deleted: 0 });
  await write("index.html", "<h1>first</h1>");

  expect(await push(api.client, dir)).toMatchObject({ kind: "created", version: 1 });
});

test("push from a folder behind the newest version is refused, unless forced", async () => {
  const api = fakeApi();
  api.addVersion({ "index.html": "<h1>1</h1>" });
  await pull(api.client, prototypeId, dir);
  api.addVersion({ "index.html": "<h1>2 from elsewhere</h1>" });
  await write("index.html", "<h1>mine</h1>");

  await expect(push(api.client, dir)).rejects.toThrow(/版 2/);
  expect(await api.client.listVersions(prototypeId)).toHaveLength(2);

  expect(await push(api.client, dir, { force: true })).toMatchObject({ version: 3 });
});

test("pull never writes through a link to outside the folder", async () => {
  const outside = await mkdtemp(join(tmpdir(), "gesso-outside-"));
  try {
    const api = fakeApi();
    api.addVersion({ "index.html": "<h1>1</h1>" });
    api.addVersion({ "index.html": "<h1>1</h1>", "assets/a.js": "a()", "data.json": "{}" });
    await pull(api.client, prototypeId, dir, { number: 1 });
    await writeFile(join(outside, "data.json"), "theirs");
    await symlink(outside, join(dir, "assets"));
    await symlink(join(outside, "data.json"), join(dir, "data.json"));

    await expect(pull(api.client, prototypeId, dir, { force: true })).rejects.toThrow(/リンク/);

    expect((await readdir(outside)).toSorted()).toEqual(["data.json"]);
    expect(await readFile(join(outside, "data.json"), "utf8")).toBe("theirs");
  } finally {
    await rm(outside, { recursive: true, force: true });
  }
});

test("a file that becomes a folder in the next version, and back", async () => {
  const api = fakeApi();
  api.addVersion({ "index.html": "<h1>1</h1>", level: "one" });
  api.addVersion({ "index.html": "<h1>2</h1>", "level/one.json": "{}" });
  api.addVersion({ "index.html": "<h1>3</h1>", level: "three" });
  await pull(api.client, prototypeId, dir, { number: 1 });

  await pull(api.client, prototypeId, dir, { number: 2 });
  expect(await read("level/one.json")).toBe("{}");
  await pull(api.client, prototypeId, dir, { number: 3 });
  expect(await read("level")).toBe("three");
});

test("pull refuses when a file pulled before was deleted since", async () => {
  const api = fakeApi();
  api.addVersion({ "index.html": "<h1>1</h1>", "game.js": "go()" });
  await pull(api.client, prototypeId, dir);
  await rm(join(dir, "game.js"));

  await expect(pull(api.client, prototypeId, dir)).rejects.toThrow(/game\.js/);
});

test("push needs a folder that was pulled", async () => {
  await write("index.html", "<h1>1</h1>");
  await expect(push(fakeApi().client, dir)).rejects.toThrow(/\.gesso\.json/);
});
