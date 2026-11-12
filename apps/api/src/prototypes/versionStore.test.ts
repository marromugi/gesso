import { afterAll, beforeAll, expect, test } from "vitest";
import { type Db, getDb } from "../db/index.ts";
import {
  type LocalPlatform,
  addPrototype,
  addUser,
  allowedGitHubId,
  startLocalPlatform,
} from "../testing/localPlatform.ts";
import { hashContent } from "./versionFiles.ts";
import { createVersion, getVersion, listVersions, saveFileContent } from "./versionStore.ts";

const now = new Date("2026-11-12T00:00:00.000Z");
const owner = "owner";

let platform: LocalPlatform;
let db: Db;

beforeAll(async () => {
  platform = await startLocalPlatform();
  db = getDb(platform.env.DB);
  await addUser(platform.env, owner, allowedGitHubId);
});

afterAll(async () => {
  await platform.dispose();
});

async function save(prototypeId: string, text: string): Promise<string> {
  const content = await new Blob([text]).arrayBuffer();
  const hash = await hashContent(content);
  const result = await saveFileContent(
    db,
    platform.env.PROTOTYPE_FILES,
    owner,
    prototypeId,
    hash,
    content,
    now,
  );
  expect(result).toEqual({ kind: "saved" });
  return hash;
}

test("versions are numbered from 1, newest first, and keep their files", async () => {
  await addPrototype(platform.env, "numbered", owner);
  const page = await save("numbered", "<script src=game.js></script>");
  const first = await save("numbered", "jump(1)");
  const second = await save("numbered", "jump(2)");

  const v1 = await createVersion(
    db,
    owner,
    "numbered",
    [
      { path: "index.html", hash: page },
      { path: "game.js", hash: first },
    ],
    now,
  );
  // The page is reused as it is, without being uploaded again.
  const v2 = await createVersion(
    db,
    owner,
    "numbered",
    [
      { path: "index.html", hash: page },
      { path: "game.js", hash: second },
    ],
    now,
  );

  expect(v1).toMatchObject({ kind: "created", version: { number: 1 } });
  expect(v2).toMatchObject({ kind: "created", version: { number: 2 } });
  expect(await listVersions(db, owner, "numbered")).toEqual([
    { number: 2, createdAt: now.toISOString() },
    { number: 1, createdAt: now.toISOString() },
  ]);
  expect(await getVersion(db, owner, "numbered", 1)).toEqual({
    number: 1,
    createdAt: now.toISOString(),
    files: [
      { path: "game.js", hash: first, size: 7 },
      { path: "index.html", hash: page, size: 29 },
    ],
  });
});

test(
  "a version with more files than one D1 statement can bind keeps every file",
  { timeout: 30_000 },
  async () => {
    await addPrototype(platform.env, "large", owner);
    const paths = [
      "index.html",
      ...Array.from({ length: 99 }, (_, i) => `f${String(i).padStart(3, "0")}.js`),
    ];
    const files = await Promise.all(
      paths.map(async (path) => ({ path, hash: await save("large", path) })),
    );

    const created = await createVersion(db, owner, "large", files, now);

    expect(created).toMatchObject({ kind: "created", version: { number: 1 } });
    const version = await getVersion(db, owner, "large", 1);
    expect(version?.files.map((file) => file.path)).toEqual(paths.toSorted());
  },
);
