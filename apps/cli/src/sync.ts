import { mkdir } from "node:fs/promises";
import type { ApiClient, VersionFile, VersionSource } from "./api/client.ts";
import { CliError } from "./cliError.ts";
import { type Repo, initRepo, openRepo } from "./git/repo.ts";
import {
  deleteLocalFile,
  hashContent,
  isEmptyFolder,
  isVersionPath,
  readManifest,
  writeLocalFile,
  writeManifest,
} from "./workspace.ts";

/** What a repository for a prototype with no version yet is synced with. */
const noVersion = 0;

/** How many files are downloaded, or read from git, at the same time. */
const atOnce = 8;

/** The page every version starts from (`entryPath` in apps/api). */
const entryPath = "index.html";

export type PullResult = {
  version: number;
  /** Whether `dir` was made a new repository. */
  initialized: boolean;
  written: number;
  deleted: number;
  /** Whether the files were committed (`false` when nothing changed). */
  committed: boolean;
};

/**
 * Puts version `number` (or the newest) of `prototypeId` into `dir` and commits it as
 * "gesso 版 N". An empty or missing folder is made a new repository first; an existing one must
 * be for this prototype (or none yet) and have nothing uncommitted. Files of the version the
 * repository had that the new one lacks are deleted. Everything is downloaded before the folder
 * is touched. Throws `CliError` when the folder can't take the version.
 */
export async function pull(
  api: ApiClient,
  prototypeId: string,
  dir: string,
  { number }: { number?: number } = {},
): Promise<PullResult> {
  let repo = await openRepo(dir);
  const initialized = repo === null;
  if (repo === null) {
    if (!(await isEmptyFolder(dir))) {
      throw new CliError(
        `${dir} は git のリポジトリではなく、空でもありません。空のフォルダーか、git のリポジトリを指定してください。`,
      );
    }
    await mkdir(dir, { recursive: true });
    repo = await initRepo(dir);
  } else {
    const manifest = await readManifest(await repo.gitDir());
    if (manifest !== null && manifest.prototypeId !== prototypeId) {
      throw new CliError(`${dir} は別のプロトタイプ（${manifest.prototypeId}）のものです。`);
    }
    if (await repo.hasUncommittedChanges()) {
      throw new CliError(
        `${dir} に commit していない変更があります。commit するか片づけてから pull してください。`,
      );
    }
  }

  const version = number ?? (await newestVersion(api, prototypeId))?.number ?? noVersion;
  const files = version === noVersion ? [] : await api.versionFiles(prototypeId, version);
  const contents = await download(api, prototypeId, files);
  const kept = new Set(files.map((file) => file.path));
  const gone = (await versionPaths(repo)).filter((path) => !kept.has(path));
  // Old files go first: a path that was a file may now be a folder, or the other way round.
  for (const path of gone) await deleteLocalFile(dir, path);
  for (const { path, content } of contents) await writeLocalFile(dir, path, content);
  const committed = version !== noVersion && (await repo.commitAll(`gesso 版 ${version}`));
  await writeManifest(await repo.gitDir(), { prototypeId, version });
  return { version, initialized, written: files.length, deleted: gone.length, committed };
}

export type PushResult =
  | {
      kind: "created";
      version: number;
      source: VersionSource;
      files: number;
      uploaded: number;
      /** Committed files a version never holds (dot files, `node_modules`). */
      leftOut: string[];
      uncommitted: boolean;
    }
  | { kind: "unchanged"; version: number; uncommitted: boolean };

/**
 * Sends HEAD's commit of the repository `dir` as the next version of the prototype it was
 * pulled for, uploading only content gesso doesn't have yet. Changes not committed are not
 * sent. Nothing is made when the newest version came from the same commit or has the same
 * files. A newer version than the one the repository was synced with would be left behind, so
 * that is refused unless `force`. Throws `CliError` when the folder isn't a prototype's
 * repository or the API refuses the files.
 */
export async function push(
  api: ApiClient,
  dir: string,
  { force = false }: { force?: boolean } = {},
): Promise<PushResult> {
  const repo = await openRepo(dir);
  if (repo === null) {
    throw new CliError(
      `${dir} は git のリポジトリではありません。\`pnpm gesso pull <プロトタイプの ID> ${dir}\` で用意してください。`,
    );
  }
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
  const uncommitted = await repo.hasUncommittedChanges();

  const committed = await repo.committedFiles();
  const included = committed.filter((file) => isVersionPath(file.path));
  const leftOut = committed.map((file) => file.path).filter((path) => !isVersionPath(path));
  if (!included.some((file) => file.path === entryPath)) {
    throw new CliError(
      `commit のルートに ${entryPath} がありません。版には ${entryPath} が要ります。`,
    );
  }
  const local = await inBatches(included, async (file) => {
    const content = await file.read();
    return { path: file.path, hash: hashContent(content), content };
  });
  const files = local.map(({ path, hash }) => ({ path, hash }));

  const newest = await newestVersion(api, manifest.prototypeId);
  if (newest !== null) {
    // The same commit, or another one with the same files (one `pull` made, say).
    if (sameFiles(files, await api.versionFiles(manifest.prototypeId, newest.number))) {
      await writeManifest(gitDir, { ...manifest, version: newest.number });
      return { kind: "unchanged", version: newest.number, uncommitted };
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
  await writeManifest(gitDir, { ...manifest, version: result.number });
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

/** The paths of HEAD's commit that a version holds; none before the first commit. */
async function versionPaths(repo: Repo): Promise<string[]> {
  if ((await repo.head()) === null) return [];
  return (await repo.committedFiles()).map((file) => file.path).filter(isVersionPath);
}

function download(api: ApiClient, prototypeId: string, files: readonly VersionFile[]) {
  return inBatches(files, async (file) => ({
    path: file.path,
    content: await api.readContent(prototypeId, file.hash),
  }));
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
