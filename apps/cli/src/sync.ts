import { lstat, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { ApiClient, VersionFile, VersionSource } from "./api/client.ts";
import { CliError } from "./cliError.ts";
import { type MergeResult, type Repo, initRepo, locateRepo } from "./git/repo.ts";
import {
  hashContent,
  isEmptyFolder,
  isVersionPath,
  readManifest,
  writeManifest,
} from "./workspace.ts";

/** What a repository for a prototype with no version yet is synced with. */
const noVersion = 0;

/** How many files are downloaded, or read from git, at the same time. */
const atOnce = 8;

/** The page every version starts from (`entryPath` in apps/api). */
const entryPath = "index.html";

export type PullResult =
  | { kind: "upToDate"; version: number }
  | { kind: "noVersion"; initialized: boolean }
  | {
      kind: "pulled";
      version: number;
      initialized: boolean;
      files: number;
      /** How the version's commit came into the branch; a conflict is left for the person. */
      merge: MergeResult;
    };

/**
 * Brings version `number` (or the newest) of `prototypeId` into the git repository `dir`, the
 * way `git pull` does: the version becomes a commit "gesso 版 N" on top of the one the
 * repository last synced with, and is merged into the current branch (a fast-forward when
 * nothing was committed since). Local commits are kept; conflicts are left to resolve in git.
 *
 * An empty or missing folder is made a new repository. An existing one must be this
 * prototype's (or, for a prototype with no version yet, one to tie to it), have nothing
 * uncommitted, and have no untracked or ignored file where the version has one. Nothing in the
 * folder changes until everything is downloaded, and git itself writes the files.
 */
export async function pull(
  api: ApiClient,
  prototypeId: string,
  dir: string,
  { number }: { number?: number } = {},
): Promise<PullResult> {
  const location = await locateRepo(dir);
  if (location.kind === "inside") {
    throw new CliError(
      `${dir} は別の git のリポジトリ（${location.root}）の中です。リポジトリの外のフォルダーを指定してください。`,
    );
  }
  let repo = location.kind === "root" ? location.repo : null;
  const manifest = repo === null ? null : await readManifest(await repo.gitDir());
  if (repo === null && !(await isEmptyFolder(dir))) {
    throw new CliError(
      `${dir} は git のリポジトリではなく、空でもありません。空のフォルダーか、このプロトタイプのリポジトリを指定してください。`,
    );
  }
  if (manifest !== null && manifest.prototypeId !== prototypeId) {
    throw new CliError(`${dir} は別のプロトタイプ（${manifest.prototypeId}）のものです。`);
  }
  if (repo !== null && (await repo.hasUncommittedChanges({ untracked: false }))) {
    throw new CliError(
      `${dir} に commit していない変更があります。commit するか片づけてから pull してください。`,
    );
  }

  const version = number ?? (await newestVersion(api, prototypeId))?.number ?? noVersion;
  if (manifest !== null && manifest.version === version) return { kind: "upToDate", version };
  if (repo !== null && manifest === null && version !== noVersion && (await repo.head()) !== null) {
    throw new CliError(
      `${dir} は、まだどのプロトタイプとも結びついていない、commit のあるリポジトリです。版を取ってくると今のファイルとぶつかるので、空のフォルダーに pull してください。`,
    );
  }
  const base = manifest?.commit ?? null;
  if (repo !== null && base !== null && !(await repo.hasCommit(base))) {
    throw new CliError(`前に同期した commit（${base}）がこのリポジトリにありません。`);
  }

  const files = version === noVersion ? [] : await api.versionFiles(prototypeId, version);
  const contents = await inBatches(files, async (file) => ({
    path: file.path,
    content: await api.readContent(prototypeId, file.hash),
  }));
  if (repo !== null) {
    const clashing = await untrackedAt(repo, files);
    if (clashing.length > 0) {
      throw new CliError(
        `git が追っていない（無視している）ファイルが、版 ${version} のファイルと同じ場所にあります: ${clashing.join(", ")}。動かすか消してから pull してください。`,
      );
    }
  }

  const initialized = repo === null;
  if (repo === null) {
    await mkdir(dir, { recursive: true });
    repo = await initRepo(dir);
  }
  const gitDir = await repo.gitDir();
  if (version === noVersion) {
    await writeManifest(gitDir, { prototypeId, version, commit: base });
    return { kind: "noVersion", initialized };
  }
  const commit = await repo.versionCommit(contents, base, `gesso 版 ${version}`);
  const merge = await repo.mergeIn(commit, `gesso 版 ${version} を取り込む`);
  await writeManifest(gitDir, { prototypeId, version, commit });
  return { kind: "pulled", version, initialized, files: files.length, merge };
}

/** A committed path that a version never holds, and why. */
export type LeftOut = { path: string; reason: "dot" | "link" | "submodule" };

export type PushResult =
  | {
      kind: "created";
      version: number;
      source: VersionSource;
      files: number;
      uploaded: number;
      leftOut: LeftOut[];
      uncommitted: boolean;
    }
  | { kind: "unchanged"; version: number; leftOut: LeftOut[]; uncommitted: boolean };

/**
 * Sends HEAD's commit of the repository `dir` as the next version of the prototype it was
 * pulled for, uploading only content gesso doesn't have yet. Changes not committed are not
 * sent. Nothing is made when the newest version has the same files (the same commit, or the one
 * a pull just made). A newer version than the one the repository was synced with would be left
 * behind, so that is refused unless `force`. Throws `CliError` when the folder isn't a
 * prototype's repository or the API refuses the files.
 */
export async function push(
  api: ApiClient,
  dir: string,
  { force = false }: { force?: boolean } = {},
): Promise<PushResult> {
  const location = await locateRepo(dir);
  if (location.kind !== "root") {
    throw new CliError(
      `${dir} は git のリポジトリのフォルダーではありません。\`pnpm gesso pull <プロトタイプの ID> ${dir}\` で用意してください。`,
    );
  }
  const { repo } = location;
  const gitDir = await repo.gitDir();
  const manifest = await readManifest(gitDir);
  if (manifest === null) {
    throw new CliError(
      `${dir} はどのプロトタイプとも結びついていません。\`pnpm gesso pull <プロトタイプの ID> ${dir}\` してください。`,
    );
  }
  const head = await repo.head();
  if (head === null)
    throw new CliError("commit がありません。git commit してから push してください。");
  const uncommitted = await repo.hasUncommittedChanges({ untracked: true });

  const entries = await repo.entries(head.commit);
  const included = entries.filter((entry) => entry.kind === "file" && isVersionPath(entry.path));
  const leftOut = entries.flatMap((entry): LeftOut[] => {
    if (entry.kind !== "file") return [{ path: entry.path, reason: entry.kind }];
    return isVersionPath(entry.path) ? [] : [{ path: entry.path, reason: "dot" }];
  });
  if (!included.some((entry) => entry.path === entryPath)) {
    throw new CliError(
      `commit のルートに ${entryPath} がありません。版には ${entryPath} が要ります。`,
    );
  }
  const local = await inBatches(included, async (entry) => {
    const content = await repo.readBlob(entry.object);
    return { path: entry.path, hash: hashContent(content), content };
  });
  const files = local.map(({ path, hash }) => ({ path, hash }));

  const newest = await newestVersion(api, manifest.prototypeId);
  if (newest !== null) {
    // The same commit, or another one with the same files (the one a pull made, say).
    if (sameFiles(files, await api.versionFiles(manifest.prototypeId, newest.number))) {
      if (newest.number === manifest.version) {
        await writeManifest(gitDir, { ...manifest, commit: head.commit });
      }
      return { kind: "unchanged", version: newest.number, leftOut, uncommitted };
    }
  }
  const newestNumber = newest?.number ?? noVersion;
  if (newestNumber !== manifest.version && !force) {
    throw new CliError(
      `版 ${newestNumber} がありますが、このリポジトリは版 ${manifest.version} からのものです。そのまま送ると版 ${newestNumber} の変更が抜けます。\`pnpm gesso pull ${manifest.prototypeId} ${dir}\` で取り込んでから送るか、--force で送ってください。`,
    );
  }

  let result = await api.createVersion(manifest.prototypeId, files, head);
  let uploaded = 0;
  if (result.kind === "missingContent") {
    const missing = new Set(result.hashes);
    for (const { hash, content } of local) {
      if (!missing.delete(hash)) continue;
      await api.saveContent(manifest.prototypeId, hash, content);
      uploaded += 1;
    }
    result = await api.createVersion(manifest.prototypeId, files, head);
    if (result.kind === "missingContent") {
      throw new CliError(`上げたはずの中身がまだ足りません: ${result.hashes.join(", ")}`);
    }
  }
  await writeManifest(gitDir, { ...manifest, version: result.number, commit: head.commit });
  return {
    kind: "created",
    version: result.number,
    source: head,
    files: files.length,
    uploaded,
    leftOut,
    uncommitted,
  };
}

async function newestVersion(api: ApiClient, prototypeId: string) {
  const [newest] = await api.listVersions(prototypeId);
  return newest ?? null;
}

/**
 * Version paths where the working tree has something git doesn't track: an untracked or ignored
 * file (or folder) that bringing the version in would overwrite.
 */
async function untrackedAt(repo: Repo, files: readonly VersionFile[]): Promise<string[]> {
  const tracked = await repo.trackedPaths();
  const clashing: string[] = [];
  for (const file of files) {
    if (tracked.has(file.path)) continue;
    const found = await lstat(join(repo.dir, file.path)).catch(() => null);
    if (found !== null) clashing.push(file.path);
  }
  return clashing;
}

/** `work` for each item, `atOnce` at the same time, in the items' order. */
async function inBatches<T, R>(items: readonly T[], work: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  for (let start = 0; start < items.length; start += atOnce) {
    results.push(...(await Promise.all(items.slice(start, start + atOnce).map(work))));
  }
  return results;
}

function sameFiles(a: readonly VersionFile[], b: readonly VersionFile[]): boolean {
  const hashes = new Map(b.map((file) => [file.path, file.hash]));
  return a.length === b.length && a.every((file) => hashes.get(file.path) === file.hash);
}
