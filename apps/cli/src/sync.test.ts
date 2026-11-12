import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, expect, test } from "vitest";
import type { ApiClient, PrototypeVersion, VersionFile, VersionSource } from "./api/client.ts";
import { git } from "./git/run.ts";
import { pull, push } from "./sync.ts";
import { hashContent } from "./workspace.ts";

const prototypeId = "p1";

let gitHome: string;

beforeAll(async () => {
  // The person's own git settings (identity, signing, hooks) must not reach these repositories.
  gitHome = await mkdtemp(join(tmpdir(), "gesso-gitconfig-"));
  await writeFile(
    join(gitHome, "config"),
    "[user]\n\tname = Tester\n\temail = tester@example.com\n[init]\n\tdefaultBranch = main\n",
  );
  process.env.GIT_CONFIG_GLOBAL = join(gitHome, "config");
  process.env.GIT_CONFIG_NOSYSTEM = "1";
});

afterAll(async () => {
  await rm(gitHome, { recursive: true, force: true });
});

/**
 * Stands in for the API: one prototype, its versions, and the content uploaded for it.
 * `uploads` counts the content sent; an unknown version is not found, as the API answers.
 */
function fakeApi() {
  const contents = new Map<string, Uint8Array>();
  const versions: { files: VersionFile[]; source: VersionSource | null; note: string }[] = [];
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
          note: version.note,
          noteUpdatedAt: null,
        }))
        .toReversed(),
    versionFiles: async (_, number) => {
      const version = versions[number - 1];
      if (!version) throw new Error(`no version ${number}`);
      return version.files;
    },
    readContent: async (_, hash) => contents.get(hash) ?? new Uint8Array(),
    saveContent: async (_, hash, content) => {
      state.uploads += 1;
      contents.set(hash, content);
    },
    createVersion: async (_, files, source) => {
      const missing = files.map((file) => file.hash).filter((hash) => !contents.has(hash));
      if (missing.length > 0) return { kind: "missingContent", hashes: [...new Set(missing)] };
      versions.push({ files, source, note: "" });
      return { kind: "created", number: versions.length };
    },
  };
  /** Makes a version straight in the fake, as a push from elsewhere would. */
  function addVersion(files: Record<string, string>, note = "") {
    const entries = Object.entries(files).map(([path, text]) => {
      const content = new TextEncoder().encode(text);
      contents.set(hashContent(content), content);
      return { path, hash: hashContent(content) };
    });
    versions.push({ files: entries, source: null, note });
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

async function read(path: string, folder = dir): Promise<string> {
  return readFile(join(folder, path), "utf8");
}

async function write(files: Record<string, string>, folder = dir): Promise<void> {
  for (const [path, text] of Object.entries(files)) {
    await mkdir(dirname(join(folder, path)), { recursive: true });
    await writeFile(join(folder, path), text);
  }
}

/** Writes `files` and commits everything, as the person (or Claude Code) does between pushes. */
async function commit(files: Record<string, string>, message = "edit", folder = dir) {
  await write(files, folder);
  await git(folder, ["add", "--all"]);
  await git(folder, ["commit", "--quiet", "-m", message]);
  return git(folder, ["rev-parse", "HEAD"]);
}

async function log(folder = dir): Promise<string[]> {
  return (await git(folder, ["log", "--format=%an: %s"])).split("\n");
}

test("pull makes a repository of the newest version, and push sends a later commit back", async () => {
  const api = fakeApi();
  api.addVersion({ "index.html": "<h1>1</h1>", "src/game.js": "jump()" });

  expect(await pull(api.client, prototypeId, dir)).toMatchObject({
    kind: "pulled",
    version: 1,
    initialized: true,
    merge: { kind: "fastForward" },
  });
  expect(await read("src/game.js")).toBe("jump()");
  expect(await log()).toEqual(["gesso: gesso 版 1"]);

  const head = await commit({ "src/game.js": "jump(2)", "src/enemy.js": "walk()" });
  const pushed = await push(api.client, dir);

  // Only the two new contents are uploaded; index.html is already there.
  expect(pushed).toMatchObject({ kind: "created", version: 2, uploaded: 2, files: 3 });
  expect(api.versions[1]?.source).toEqual({ commit: head, branch: "main" });
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
  expect(await push(api.client, dir)).toMatchObject({ kind: "unchanged", version: 1 });

  await commit({ "game.js": "go()" });
  await push(api.client, dir);
  expect(await push(api.client, dir)).toMatchObject({ kind: "unchanged", version: 2 });
  expect(api.versions).toHaveLength(2);
});

test("a version's bytes come back as they were, whatever the line-ending settings", async () => {
  const api = fakeApi();
  api.addVersion({ "index.html": "<h1>1</h1>" });
  await pull(api.client, prototypeId, dir);
  await git(dir, ["config", "core.autocrlf", "input"]);
  await commit({ ".gitattributes": "* text=auto\n" }, "normalize line endings");
  api.addVersion({ "index.html": "<h1>2</h1>\r\n", "game.js": "go()\r\n" });

  await pull(api.client, prototypeId, dir);

  expect(await push(api.client, dir)).toMatchObject({ kind: "unchanged", version: 2 });
});

test("committed dot files, node_modules, links and submodules stay out, and are named", async () => {
  const api = fakeApi();
  api.addVersion({ "index.html": "<h1>1</h1>" });
  await pull(api.client, prototypeId, dir);
  await symlink("index.html", join(dir, "home.html"));
  await commit({ ".gitignore": "dist\n", "node_modules/lib/x.js": "x", "game.js": "go()" });

  const pushed = await push(api.client, dir);

  expect(pushed).toMatchObject({
    leftOut: [
      { path: ".gitignore", reason: "dot" },
      { path: "home.html", reason: "link" },
      { path: "node_modules/lib/x.js", reason: "dot" },
    ],
  });
  expect(await api.paths(2)).toEqual(["game.js", "index.html"]);
});

test("the branch is recorded, even beside a tag of the same name, and none when detached", async () => {
  const api = fakeApi();
  api.addVersion({ "index.html": "<h1>1</h1>" });
  await pull(api.client, prototypeId, dir);
  await git(dir, ["tag", "main"]);
  await commit({ "a.js": "a()" });
  await push(api.client, dir);
  expect(api.versions[1]?.source?.branch).toBe("main");

  await git(dir, ["checkout", "--quiet", "--detach"]);
  await commit({ "b.js": "b()" });
  await push(api.client, dir);
  expect(api.versions[2]?.source?.branch).toBeNull();
});

test("a prototype with no version gets a repository to push its first version from", async () => {
  const api = fakeApi();

  expect(await pull(api.client, prototypeId, dir)).toEqual({
    kind: "noVersion",
    initialized: true,
  });
  await expect(push(api.client, dir)).rejects.toThrow(/commit がありません/);
  await commit({ "index.html": "<h1>first</h1>" });

  expect(await push(api.client, dir)).toMatchObject({ kind: "created", version: 1 });
});

test("an existing project ties to a prototype with no version, and nothing of it changes", async () => {
  const api = fakeApi();
  await git(dir, ["init", "--quiet"]);
  await commit({ "index.html": "<h1>mine</h1>", "README.md": "readme" });

  expect(await pull(api.client, prototypeId, dir)).toMatchObject({ kind: "noVersion" });
  expect((await readdir(dir)).toSorted()).toEqual([".git", "README.md", "index.html"]);

  expect(await push(api.client, dir)).toMatchObject({ kind: "created", version: 1 });
});

test("a repository with its own history isn't overwritten by a prototype's versions", async () => {
  const api = fakeApi();
  api.addVersion({ "index.html": "<h1>1</h1>" });
  await git(dir, ["init", "--quiet"]);
  await commit({ "package.json": "{}", "src/app.ts": "app" });

  await expect(pull(api.client, prototypeId, dir)).rejects.toThrow(/空のフォルダー/);

  expect((await readdir(dir)).toSorted()).toEqual([".git", "package.json", "src"]);
  expect(await log()).toEqual(["Tester: edit"]);
});

test("pull brings the version's own note along, even when it was pulled already", async () => {
  const api = fakeApi();
  api.addVersion({ "index.html": "<h1>1</h1>" }, "ジャンプが重い");
  api.addVersion({ "index.html": "<h1>2</h1>" }, "敵が速すぎる");

  expect(await pull(api.client, prototypeId, dir, { number: 1 })).toMatchObject({
    kind: "pulled",
    note: "ジャンプが重い",
  });
  // The note may be written after the version was pulled.
  expect(await pull(api.client, prototypeId, dir, { number: 1 })).toEqual({
    kind: "upToDate",
    version: 1,
    note: "ジャンプが重い",
  });
  await expect(pull(api.client, prototypeId, dir, { number: 5 })).rejects.toThrow(
    /版 5 はありません/,
  );
});

test("pull merges a newer version into local commits, keeping both", async () => {
  const api = fakeApi();
  api.addVersion({ "index.html": "<h1>1</h1>", "game.js": "go()" });
  await pull(api.client, prototypeId, dir);
  await commit({ "mine.js": "mine()" });
  api.addVersion({ "index.html": "<h1>2</h1>", "game.js": "go()" });

  expect(await pull(api.client, prototypeId, dir)).toMatchObject({ merge: { kind: "merged" } });

  expect(await read("mine.js")).toBe("mine()");
  expect(await read("index.html")).toBe("<h1>2</h1>");
  expect(await push(api.client, dir)).toMatchObject({ kind: "created", version: 3 });
  expect(await api.paths(3)).toEqual(["game.js", "index.html", "mine.js"]);
});

test("a conflict with a local commit is left to resolve in git, then pushes", async () => {
  const api = fakeApi();
  api.addVersion({ "index.html": "<h1>1</h1>" });
  await pull(api.client, prototypeId, dir);
  await commit({ "index.html": "<h1>mine</h1>" });
  api.addVersion({ "index.html": "<h1>theirs</h1>" });

  expect(await pull(api.client, prototypeId, dir)).toMatchObject({
    merge: { kind: "conflict", paths: ["index.html"] },
  });
  expect(await read("index.html")).toContain("<<<<<<<");

  await commit({ "index.html": "<h1>both</h1>" }, "resolve");
  expect(await push(api.client, dir)).toMatchObject({ kind: "created", version: 3 });
});

test("files a version dropped are deleted, and a file can become a folder", async () => {
  const api = fakeApi();
  api.addVersion({ "index.html": "<h1>1</h1>", level: "one", "old.js": "old()" });
  api.addVersion({ "index.html": "<h1>2</h1>", "level/one.json": "{}" });
  await pull(api.client, prototypeId, dir, { number: 1 });
  await write({ ".env": "SECRET=1" });

  await pull(api.client, prototypeId, dir);

  expect(await read("level/one.json")).toBe("{}");
  expect((await readdir(dir)).toSorted()).toEqual([".env", ".git", "index.html", "level"]);
  expect(await log()).toEqual(["gesso: gesso 版 2", "gesso: gesso 版 1"]);
});

test("dot files in a folder made a repository are left out of git's history", async () => {
  const api = fakeApi();
  api.addVersion({ "index.html": "<h1>1</h1>" });
  await write({ ".env": "SECRET=1" });

  await pull(api.client, prototypeId, dir);

  expect(await git(dir, ["ls-files"])).toBe("index.html");
});

test("pull leaves work alone, and changes nothing when it refuses", async () => {
  const api = fakeApi();
  api.addVersion({ "index.html": "<h1>1</h1>" });
  await write({ "notes.txt": "mine" });
  await expect(pull(api.client, prototypeId, dir)).rejects.toThrow(/空でもありません/);
  expect(await readdir(dir)).toEqual(["notes.txt"]);

  await rm(join(dir, "notes.txt"));
  await pull(api.client, prototypeId, dir);
  api.addVersion({ "index.html": "<h1>2</h1>", "dist/x.js": "theirs" });
  await write({ ".gitignore": "dist\n", "dist/x.js": "my build" });
  await commit({}, "ignore dist");
  await expect(pull(api.client, prototypeId, dir)).rejects.toThrow(/dist\/x\.js/);
  expect(await read("dist/x.js")).toBe("my build");

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
    await pull(api.client, prototypeId, dir);
    await symlink(outside, join(dir, "assets"));
    await commit({}, "link assets");
    api.addVersion({ "index.html": "<h1>1</h1>", "assets/a.js": "a()" });

    await pull(api.client, prototypeId, dir).catch(() => undefined);

    expect(await readdir(outside)).toEqual([]);
  } finally {
    await rm(outside, { recursive: true, force: true });
  }
});

test("a worktree of the repository pushes like the repository", async () => {
  const api = fakeApi();
  api.addVersion({ "index.html": "<h1>1</h1>" });
  await pull(api.client, prototypeId, dir);
  const worktree = `${dir}-wt`;
  try {
    await git(dir, ["worktree", "add", "--quiet", worktree, "-b", "feature"]);
    await commit({ "feature.js": "f()" }, "feature", worktree);

    expect(await push(api.client, worktree)).toMatchObject({ kind: "created", version: 2 });
    expect(api.versions[1]?.source?.branch).toBe("feature");
  } finally {
    await rm(worktree, { recursive: true, force: true });
  }
});

test("pull makes a folder that isn't there yet, but not a repository inside another", async () => {
  const api = fakeApi();
  api.addVersion({ "index.html": "<h1>1</h1>" });

  await pull(api.client, prototypeId, join(dir, "new"));
  expect(await read("index.html", join(dir, "new"))).toBe("<h1>1</h1>");

  await expect(pull(api.client, prototypeId, join(dir, "new", "inner"))).rejects.toThrow(
    /別の git のリポジトリ/,
  );
});

test("a version that doesn't exist leaves no repository behind", async () => {
  const api = fakeApi();
  await expect(pull(api.client, prototypeId, join(dir, "new"), { number: 7 })).rejects.toThrow();
  expect(await readdir(dir)).toEqual([]);
});

test("push needs a repository that was pulled, with index.html at the root", async () => {
  const api = fakeApi();
  await expect(push(api.client, dir)).rejects.toThrow(/git のリポジトリのフォルダーではありません/);

  await git(dir, ["init", "--quiet"]);
  await expect(push(api.client, dir)).rejects.toThrow(/結びついていません/);

  await pull(api.client, prototypeId, dir);
  await commit({ "src/index.html": "<h1>not at the root</h1>" });
  await expect(push(api.client, dir)).rejects.toThrow(/index\.html/);
  expect(api.state.uploads).toBe(0);
  expect(api.versions).toEqual([]);
});
