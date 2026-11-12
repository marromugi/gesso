import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { simpleGit } from "simple-git";
import { afterAll, afterEach, beforeAll, beforeEach, expect, test } from "vitest";
import type { ApiClient, PrototypeVersion, VersionFile, VersionSource } from "./api/client.ts";
import { pull, push } from "./sync.ts";
import { hashContent } from "./workspace.ts";

const prototypeId = "p1";

let gitConfig: string;

beforeAll(async () => {
  // The person's own git settings (identity, signing) must not reach the repositories here.
  gitConfig = await mkdtemp(join(tmpdir(), "gesso-gitconfig-"));
  await writeFile(join(gitConfig, "config"), "");
  process.env.GIT_CONFIG_GLOBAL = join(gitConfig, "config");
  process.env.GIT_CONFIG_NOSYSTEM = "1";
});

afterAll(async () => {
  await rm(gitConfig, { recursive: true, force: true });
});

/**
 * Stands in for the API: one prototype, its versions, and the content uploaded for it.
 * `uploads` counts the content sent.
 */
function fakeApi() {
  const contents = new Map<string, Uint8Array>();
  const versions: { files: VersionFile[]; source: VersionSource | null }[] = [];
  const state = { uploads: 0 };
  const client: ApiClient = {
    me: async () => ({ name: "owner" }),
    endSession: async () => {},
    listPrototypes: async () => [{ id: prototypeId, name: "jump" }],
    listVersions: async () =>
      versions
        .map((version, index): PrototypeVersion => ({
          number: index + 1,
          createdAt: "2026-11-12T00:00:00.000Z",
          source: version.source,
        }))
        .toReversed(),
    versionFiles: async (_, number) => versions[number - 1]?.files ?? [],
    readContent: async (_, hash) => contents.get(hash) ?? new Uint8Array(),
    saveContent: async (_, hash, content) => {
      state.uploads += 1;
      contents.set(hash, content);
    },
    createVersion: async (_, files, source) => {
      const missing = files.map((file) => file.hash).filter((hash) => !contents.has(hash));
      if (missing.length > 0) return { kind: "missingContent", hashes: [...new Set(missing)] };
      versions.push({ files, source });
      return { kind: "created", number: versions.length };
    },
  };
  /** Makes a version straight in the fake, as a push from elsewhere would. */
  function addVersion(files: Record<string, string>) {
    const entries = Object.entries(files).map(([path, text]) => {
      const content = new TextEncoder().encode(text);
      contents.set(hashContent(content), content);
      return { path, hash: hashContent(content) };
    });
    versions.push({ files: entries, source: null });
  }
  const paths = async (number: number) =>
    (await client.versionFiles(prototypeId, number)).map((file) => file.path);
  return { client, state, versions, addVersion, paths };
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

async function write(files: Record<string, string>): Promise<void> {
  for (const [path, text] of Object.entries(files)) {
    await mkdir(dirname(join(dir, path)), { recursive: true });
    await writeFile(join(dir, path), text);
  }
}

/** Writes `files` and commits everything, as the person (or Claude Code) does between pushes. */
async function commit(files: Record<string, string>, message = "edit"): Promise<string> {
  await write(files);
  const git = simpleGit({ baseDir: dir, config: ["user.name=t", "user.email=t@example.com"] });
  await git.add(["--all"]);
  await git.commit(message);
  return (await git.revparse(["HEAD"])).trim();
}

async function log(): Promise<string[]> {
  return (await simpleGit({ baseDir: dir }).log()).all.map((entry) => entry.message);
}

test("pull makes a repository of the newest version, and push sends a later commit back", async () => {
  const api = fakeApi();
  api.addVersion({ "index.html": "<h1>1</h1>", "src/game.js": "jump()" });

  expect(await pull(api.client, prototypeId, dir)).toMatchObject({
    version: 1,
    initialized: true,
    committed: true,
  });
  expect(await read("src/game.js")).toBe("jump()");
  expect(await log()).toEqual(["gesso 版 1"]);

  const head = await commit({ "src/game.js": "jump(2)", "src/enemy.js": "walk()" });
  const pushed = await push(api.client, dir);

  // Only the two new contents are uploaded; index.html is already there.
  expect(pushed).toMatchObject({ kind: "created", version: 2, uploaded: 2, files: 3 });
  expect(api.versions[1]?.source?.commit).toBe(head);
  expect(await api.paths(2)).toEqual(["index.html", "src/enemy.js", "src/game.js"]);
});

test("push sends the commit, not what isn't committed yet, and says so", async () => {
  const api = fakeApi();
  api.addVersion({ "index.html": "<h1>1</h1>" });
  await pull(api.client, prototypeId, dir);
  await commit({ "game.js": "committed()" });
  await write({ "game.js": "not committed()", "draft.js": "draft()" });

  const pushed = await push(api.client, dir);

  expect(pushed).toMatchObject({ kind: "created", uncommitted: true });
  expect(await api.paths(2)).toEqual(["game.js", "index.html"]);
  const game = (await api.client.versionFiles(prototypeId, 2)).find((f) => f.path === "game.js");
  expect(game?.hash).toBe(hashContent(new TextEncoder().encode("committed()")));
});

test("the same commit, or the same files, make no new version", async () => {
  const api = fakeApi();
  api.addVersion({ "index.html": "<h1>1</h1>" });
  await pull(api.client, prototypeId, dir);
  // Right after a pull, the commit is new but the files are the version's.
  expect(await push(api.client, dir)).toMatchObject({ kind: "unchanged", version: 1 });

  await commit({ "game.js": "go()" });
  await push(api.client, dir);
  expect(await push(api.client, dir)).toMatchObject({ kind: "unchanged", version: 2 });
  expect(api.versions).toHaveLength(2);
});

test("committed dot files and node_modules stay out of the version", async () => {
  const api = fakeApi();
  api.addVersion({ "index.html": "<h1>1</h1>" });
  await pull(api.client, prototypeId, dir);
  await commit({ ".gitignore": "dist\n", "node_modules/lib/x.js": "x", "game.js": "go()" });

  const pushed = await push(api.client, dir);

  expect(pushed).toMatchObject({ leftOut: [".gitignore", "node_modules/lib/x.js"] });
  expect(await api.paths(2)).toEqual(["game.js", "index.html"]);
});

test("a prototype with no version gets a repository to push its first version from", async () => {
  const api = fakeApi();

  expect(await pull(api.client, prototypeId, dir)).toMatchObject({ version: 0, committed: false });
  await expect(push(api.client, dir)).rejects.toThrow(/commit がありません/);
  await commit({ "index.html": "<h1>first</h1>" });

  expect(await push(api.client, dir)).toMatchObject({ kind: "created", version: 1 });
});

test("push from a repository behind the newest version is refused, unless forced", async () => {
  const api = fakeApi();
  api.addVersion({ "index.html": "<h1>1</h1>" });
  await pull(api.client, prototypeId, dir);
  api.addVersion({ "index.html": "<h1>2 from elsewhere</h1>" });
  await commit({ "index.html": "<h1>mine</h1>" });

  await expect(push(api.client, dir)).rejects.toThrow(/版 2/);
  expect(api.versions).toHaveLength(2);

  expect(await push(api.client, dir, { force: true })).toMatchObject({ version: 3 });
});

test("pulling a later version replaces the old one's files and commits them", async () => {
  const api = fakeApi();
  api.addVersion({ "index.html": "<h1>1</h1>", level: "one", "old.js": "old()" });
  api.addVersion({ "index.html": "<h1>2</h1>", "level/one.json": "{}" });
  await pull(api.client, prototypeId, dir, { number: 1 });

  expect(await pull(api.client, prototypeId, dir)).toMatchObject({ version: 2, deleted: 2 });

  expect(await read("level/one.json")).toBe("{}");
  expect((await readdir(dir)).toSorted()).toEqual([".git", "index.html", "level"]);
  expect(await log()).toEqual(["gesso 版 2", "gesso 版 1"]);
});

test("pull leaves work alone: changes not committed, another prototype, other files", async () => {
  const api = fakeApi();
  api.addVersion({ "index.html": "<h1>1</h1>" });

  await write({ "notes.txt": "mine" });
  await expect(pull(api.client, prototypeId, dir)).rejects.toThrow(/git のリポジトリではなく/);

  await rm(join(dir, "notes.txt"));
  await pull(api.client, prototypeId, dir);
  await write({ "index.html": "<h1>edited</h1>" });
  await expect(pull(api.client, prototypeId, dir)).rejects.toThrow(/commit していない変更/);
  expect(await read("index.html")).toBe("<h1>edited</h1>");

  await expect(pull(api.client, "p2", dir)).rejects.toThrow(/別のプロトタイプ/);
});

test("pull never writes through a link to outside the folder", async () => {
  const outside = await mkdtemp(join(tmpdir(), "gesso-outside-"));
  try {
    const api = fakeApi();
    api.addVersion({ "index.html": "<h1>1</h1>" });
    api.addVersion({ "index.html": "<h1>1</h1>", "assets/a.js": "a()" });
    await pull(api.client, prototypeId, dir, { number: 1 });
    await symlink(outside, join(dir, "assets"));
    await commit({}, "link assets");

    await expect(pull(api.client, prototypeId, dir)).rejects.toThrow(/リンク/);

    expect(await readdir(outside)).toEqual([]);
  } finally {
    await rm(outside, { recursive: true, force: true });
  }
});

test("pull makes a folder that isn't there yet", async () => {
  const api = fakeApi();
  api.addVersion({ "index.html": "<h1>1</h1>" });
  const folder = join(dir, "new");

  await pull(api.client, prototypeId, folder);

  expect(await readFile(join(folder, "index.html"), "utf8")).toBe("<h1>1</h1>");
});

test("push needs a repository that was pulled, with index.html at the root", async () => {
  const api = fakeApi();
  await expect(push(api.client, dir)).rejects.toThrow(/git のリポジトリではありません/);

  await simpleGit({ baseDir: dir }).init();
  await expect(push(api.client, dir)).rejects.toThrow(/結びついていません/);

  await pull(api.client, prototypeId, dir);
  await commit({ "src/index.html": "<h1>not at the root</h1>" });
  await expect(push(api.client, dir)).rejects.toThrow(/index\.html/);
});
