import { mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, test } from "vitest";
import {
  credentialsPath,
  deleteCredentials,
  loadCredentials,
  saveCredentials,
} from "./credentials.ts";

let configHome: string;
let path: string;

beforeEach(async () => {
  configHome = await mkdtemp(join(tmpdir(), "gesso-config-"));
  path = credentialsPath({ XDG_CONFIG_HOME: configHome });
});

afterEach(async () => {
  await rm(configHome, { recursive: true, force: true });
});

test("saved credentials are read back, and only their owner can read the file", async () => {
  expect(path).toBe(join(configHome, "gesso", "credentials.json"));
  await saveCredentials(path, { apiUrl: "https://gesso.test/api", token: "t" });

  expect(await loadCredentials(path)).toEqual({ apiUrl: "https://gesso.test/api", token: "t" });
  expect((await stat(path)).mode & 0o777).toBe(0o600);
});

test("signing out leaves no credentials", async () => {
  await saveCredentials(path, { apiUrl: "https://gesso.test/api", token: "t" });
  await deleteCredentials(path);
  expect(await loadCredentials(path)).toBeNull();
});

test("a file of a format this CLI doesn't know is refused, not read in part", async () => {
  await saveCredentials(path, { apiUrl: "https://gesso.test/api", token: "t" });
  await writeFile(path, JSON.stringify({ format: 2, apiUrl: "x", token: "t" }));
  await expect(loadCredentials(path)).rejects.toThrow(/login/);
});
