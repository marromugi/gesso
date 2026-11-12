import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ApiClient, PrototypeVersion, VersionFile, VersionSource } from "../api/client.ts";
import { hashContent } from "../workspace.ts";

/** The one prototype the fake API has. */
export const prototypeId = "p1";

/**
 * Stands in for the API: one prototype, its versions, and the content uploaded for it.
 * `uploads` counts the content sent; an unknown version is not found, as the API answers.
 */
export function fakeApi() {
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

/**
 * Points git at settings of the tests' own (an identity, `main` as the first branch), so the
 * person's own (identity, signing, hooks) never reach the tests' repositories. Gives what
 * undoes it.
 */
export async function isolateGitSettings(): Promise<() => Promise<void>> {
  const home = await mkdtemp(join(tmpdir(), "gesso-gitconfig-"));
  await writeFile(
    join(home, "config"),
    "[user]\n\tname = Tester\n\temail = tester@example.com\n[init]\n\tdefaultBranch = main\n",
  );
  process.env.GIT_CONFIG_GLOBAL = join(home, "config");
  process.env.GIT_CONFIG_NOSYSTEM = "1";
  return () => rm(home, { recursive: true, force: true });
}
