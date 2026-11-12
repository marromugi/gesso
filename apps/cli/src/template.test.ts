import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, expect, test } from "vitest";
import { git } from "./git/run.ts";
import { push } from "./sync.ts";
import { newFromTemplate, templateFiles, templateNames } from "./template.ts";
import { fakeApi, isolateGitSettings, prototypeId } from "./testing/fakeApi.ts";

let undoGitSettings: () => Promise<void>;
let dir: string;

beforeAll(async () => {
  undoGitSettings = await isolateGitSettings();
});

afterAll(async () => {
  await undoGitSettings();
});

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "gesso-template-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

test.each(templateNames)(
  "the %s template declares its controls and has what its page loads",
  async (name) => {
    const files = new Map((await templateFiles(name)).map((file) => [file.path, file.content]));
    const text = (path: string) => new TextDecoder().decode(files.get(path));

    const controls: { format: number; actions: { id: string; label: string; keys: string[] }[] } =
      JSON.parse(text("controls.json"));
    expect(controls.format).toBe(1);
    const keys = controls.actions.flatMap((action) => action.keys);
    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(controls.actions.map((action) => action.id)).size).toBe(controls.actions.length);

    expect(text("index.html")).toContain('src="src/main.js"');
    expect(text("src/main.js")).toContain('from "./gesso/runtime.js"');
    expect(files.has("src/gesso/runtime.js")).toBe(true);
    expect(files.has("CLAUDE.md")).toBe(true);
  },
);

test("a prototype with no version starts from a template, committed, and pushes as version 1", async () => {
  const api = fakeApi();

  const result = await newFromTemplate(api.client, prototypeId, join(dir, "game"), "2d");

  const game = join(dir, "game");
  expect(result.files).toBe((await templateFiles("2d")).length);
  expect(await git(game, ["log", "--format=%an: %s"])).toBe("gesso: gesso テンプレート 2d");
  expect(await git(game, ["status", "--porcelain"])).toBe("");
  expect(await push(api.client, game)).toMatchObject({ kind: "created", version: 1 });
  expect(await api.paths(1)).toEqual([
    "CLAUDE.md",
    "controls.json",
    "index.html",
    "src/gesso/runtime.js",
    "src/main.js",
  ]);
});

test("a prototype with versions, or a file in the way, is refused and nothing changes", async () => {
  const api = fakeApi();
  await writeFile(join(dir, "index.html"), "<h1>mine</h1>");
  await expect(newFromTemplate(api.client, prototypeId, dir, "3d")).rejects.toThrow(/index\.html/);
  expect(await readdir(dir)).toEqual(["index.html"]);
  expect(await readFile(join(dir, "index.html"), "utf8")).toBe("<h1>mine</h1>");

  api.addVersion({ "index.html": "<h1>1</h1>" });
  await expect(newFromTemplate(api.client, prototypeId, join(dir, "new"), "3d")).rejects.toThrow(
    /もう版があります/,
  );
  expect(await readdir(dir)).toEqual(["index.html"]);
});
