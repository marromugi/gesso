import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { getPlatformProxy } from "wrangler";
import { afterAll, beforeAll, expect, test } from "vitest";
import { type Db, getDb } from "../db/index.ts";
import { hashContent } from "./versionFiles.ts";
import {
  createVersion,
  getVersion,
  listVersions,
  readFileContent,
  saveFileContent,
} from "./versionStore.ts";

const now = new Date("2026-11-12T00:00:00.000Z");
const owner = "owner";
const prototypeId = "proto";

let proxy: Awaited<ReturnType<typeof getPlatformProxy<Env>>>;
let db: Db;
let bucket: R2Bucket;

beforeAll(async () => {
  proxy = await getPlatformProxy<Env>({ persist: false });
  db = getDb(proxy.env.DB);
  bucket = proxy.env.PROTOTYPE_FILES;
  await applyMigrations(proxy.env.DB);
  await proxy.env.DB.batch(
    ["owner", "someone"].map((id) =>
      proxy.env.DB.prepare(
        `insert into "user" (id, name, email, emailVerified, createdAt, updatedAt) values (?, ?, ?, 0, ?, ?)`,
      ).bind(id, id, `${id}@example.com`, now.toISOString(), now.toISOString()),
    ),
  );
  await proxy.env.DB.prepare(
    `insert into prototype (id, ownerId, name, createdAt, updatedAt) values (?, ?, 'p', ?, ?)`,
  )
    .bind(prototypeId, owner, now.toISOString(), now.toISOString())
    .run();
});

afterAll(async () => {
  await proxy.dispose();
});

async function applyMigrations(d1: D1Database): Promise<void> {
  const dir = resolve(import.meta.dirname, "../../migrations");
  const files = readdirSync(dir)
    .filter((name) => name.endsWith(".sql"))
    .toSorted();
  for (const file of files) {
    const statements = readFileSync(resolve(dir, file), "utf8")
      .replaceAll("--> statement-breakpoint", "")
      .split(/;\s*(?:\n|$)/)
      .map((statement) => statement.trim())
      .filter((statement) => statement !== "");
    await d1.batch(statements.map((statement) => d1.prepare(statement)));
  }
}

async function save(text: string): Promise<string> {
  const content = await new Blob([text]).arrayBuffer();
  const hash = await hashContent(content);
  expect(await saveFileContent(db, bucket, owner, prototypeId, hash, content, now)).toEqual({
    kind: "saved",
  });
  return hash;
}

test("versions are numbered from 1, keep their files, and share unchanged content", async () => {
  const page = await save("<script src=game.js></script>");
  const first = await save("jump(1)");
  const second = await save("jump(2)");

  const v1 = await createVersion(
    db,
    owner,
    prototypeId,
    [
      { path: "index.html", hash: page },
      { path: "game.js", hash: first },
    ],
    now,
  );
  const v2 = await createVersion(
    db,
    owner,
    prototypeId,
    [
      { path: "index.html", hash: page },
      { path: "game.js", hash: second },
    ],
    now,
  );

  expect(v1).toMatchObject({ kind: "created", version: { number: 1 } });
  expect(v2).toMatchObject({ kind: "created", version: { number: 2 } });
  expect(await listVersions(db, owner, prototypeId)).toEqual([
    { number: 2, createdAt: now.toISOString() },
    { number: 1, createdAt: now.toISOString() },
  ]);
  expect(await getVersion(db, owner, prototypeId, 1)).toEqual({
    number: 1,
    createdAt: now.toISOString(),
    files: [
      { path: "game.js", hash: first, size: 7 },
      { path: "index.html", hash: page, size: 29 },
    ],
  });
  const read = await readFileContent(db, bucket, owner, prototypeId, second);
  expect(await read?.text()).toBe("jump(2)");
});

test("a version whose content wasn't uploaded is refused with the missing hashes", async () => {
  const page = await save("<p>missing</p>");
  const missing = "f".repeat(64);
  expect(
    await createVersion(
      db,
      owner,
      prototypeId,
      [
        { path: "index.html", hash: page },
        { path: "a.js", hash: missing },
      ],
      now,
    ),
  ).toEqual({ kind: "missingContent", hashes: [missing] });
});

test("content that doesn't match its hash isn't saved", async () => {
  const content = await new Blob(["real"]).arrayBuffer();
  const claimed = "0".repeat(64);
  expect(await saveFileContent(db, bucket, owner, prototypeId, claimed, content, now)).toEqual({
    kind: "hashMismatch",
    actual: await hashContent(content),
  });
  expect(await readFileContent(db, bucket, owner, prototypeId, claimed)).toBeNull();
});

test("someone else's prototype is not found", async () => {
  const content = await new Blob(["x"]).arrayBuffer();
  const hash = await hashContent(content);
  expect(await saveFileContent(db, bucket, "someone", prototypeId, hash, content, now)).toEqual({
    kind: "notFound",
  });
  expect(
    await createVersion(db, "someone", prototypeId, [{ path: "index.html", hash }], now),
  ).toEqual({ kind: "notFound" });
  expect(await listVersions(db, "someone", prototypeId)).toBeNull();
  expect(await getVersion(db, "someone", prototypeId, 1)).toBeNull();
  expect(await readFileContent(db, bucket, "someone", prototypeId, hash)).toBeNull();
});
