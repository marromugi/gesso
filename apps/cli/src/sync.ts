import type { ApiClient } from "./api.ts";
import { CliError } from "./cliError.ts";
import {
  deleteLocalFile,
  hashesOf,
  isEmptyFolder,
  localFiles,
  manifestName,
  readManifest,
  writeLocalFile,
  writeManifest,
} from "./workspace.ts";

/** What a folder for a prototype with no version yet is synced with. */
const noVersion = 0;

/** How many files `pull` downloads at the same time. */
const downloadsAtOnce = 8;

export type PullResult = { version: number; written: number; deleted: number };

/**
 * Puts version `number` (or the newest) of `prototypeId` into `dir`. The folder must be empty, or
 * hold that prototype from an earlier pull or push with no file changed since: files of the old
 * version are replaced or deleted, and files gesso never had are left alone unless the version
 * has a file at the same path. With `force`, changed and clashing files are overwritten. A
 * prototype with no version yet gets an empty folder to push its first version from.
 *
 * Everything is downloaded before the folder is touched, so a failed download changes nothing.
 * Throws `CliError` when the folder can't take the version.
 */
export async function pull(
  api: ApiClient,
  prototypeId: string,
  dir: string,
  { number, force = false }: { number?: number; force?: boolean } = {},
): Promise<PullResult> {
  const manifest = await readManifest(dir);
  if (manifest === null && !(await isEmptyFolder(dir))) {
    throw new CliError(
      `${dir} は空ではなく、${manifestName} もありません。空のフォルダーを指定してください。`,
    );
  }
  if (manifest !== null && manifest.prototypeId !== prototypeId) {
    throw new CliError(`${dir} には別のプロトタイプ（${manifest.prototypeId}）が入っています。`);
  }

  const version = number ?? (await newestVersion(api, prototypeId));
  const files = version === noVersion ? [] : await api.versionFiles(prototypeId, version);
  const synced = manifest?.files ?? {};
  if (!force) {
    const local = await localFiles(dir);
    const changed = Object.entries(synced)
      .filter(([path, hash]) => local.get(path)?.hash !== hash)
      .map(([path]) => path);
    if (changed.length > 0) {
      throw new CliError(
        `前に取ってきてから変わったファイルがあります: ${changed.join(", ")}。\`pnpm gesso push\` するか、--force で上書きしてください。`,
      );
    }
    const clashing = files
      .map((file) => file.path)
      .filter((path) => local.has(path) && !(path in synced));
    if (clashing.length > 0) {
      throw new CliError(
        `gesso にないファイルが、版 ${version} のファイルと同じ場所にあります: ${clashing.join(", ")}。--force で上書きできます。`,
      );
    }
  }

  const contents: { path: string; content: Uint8Array }[] = [];
  for (let start = 0; start < files.length; start += downloadsAtOnce) {
    const batch = files.slice(start, start + downloadsAtOnce);
    contents.push(
      ...(await Promise.all(
        batch.map(async (file) => ({
          path: file.path,
          content: await api.readContent(prototypeId, file.hash),
        })),
      )),
    );
  }
  const kept = new Set(files.map((file) => file.path));
  const gone = Object.keys(synced).filter((path) => !kept.has(path));
  // Old files go first: a path that was a file may now be a folder, or the other way round.
  for (const path of gone) await deleteLocalFile(dir, path);
  for (const { path, content } of contents) await writeLocalFile(dir, path, content);
  await writeManifest(dir, { prototypeId, version, files: hashesOf(files) });
  return { version, written: files.length, deleted: gone.length };
}

export type PushResult =
  | { kind: "created"; version: number; uploaded: number; files: number }
  | { kind: "unchanged"; version: number };

/**
 * Sends the files in `dir` as the next version of the prototype its `.gesso.json` names,
 * uploading only content gesso doesn't have yet. Nothing is made when no file changed since the
 * version the folder was synced with. A newer version than that one would be left behind, so
 * that is refused unless `force`. Throws `CliError` when the folder isn't a prototype's or the
 * API refuses the files.
 */
export async function push(
  api: ApiClient,
  dir: string,
  { force = false }: { force?: boolean } = {},
): Promise<PushResult> {
  const manifest = await readManifest(dir);
  if (manifest === null) {
    throw new CliError(
      `${dir} に ${manifestName} がありません。先に \`pnpm gesso pull <プロトタイプの ID> ${dir}\` してください。`,
    );
  }
  const local = await localFiles(dir);
  const files = [...local].map(([path, { hash }]) => ({ path, hash }));
  if (sameFiles(hashesOf(files), manifest.files)) {
    return { kind: "unchanged", version: manifest.version };
  }
  const newest = await newestVersion(api, manifest.prototypeId);
  if (newest !== manifest.version && !force) {
    throw new CliError(
      `版 ${newest} がありますが、このフォルダーは版 ${manifest.version} からのものです。そのまま送ると版 ${newest} の変更が抜けます。版 ${newest} を取り込んでから送るか、--force で送ってください。`,
    );
  }

  let result = await api.createVersion(manifest.prototypeId, files);
  let uploaded = 0;
  if (result.kind === "missingContent") {
    const missing = new Set(result.hashes);
    for (const { hash, content } of local.values()) {
      if (!missing.delete(hash)) continue;
      await api.saveContent(manifest.prototypeId, hash, content);
      uploaded += 1;
    }
    result = await api.createVersion(manifest.prototypeId, files);
    if (result.kind === "missingContent") {
      throw new CliError(`上げたはずの中身がまだ足りません: ${result.hashes.join(", ")}`);
    }
  }
  await writeManifest(dir, { ...manifest, version: result.number, files: hashesOf(files) });
  return { kind: "created", version: result.number, uploaded, files: files.length };
}

/** The prototype's newest version, or `noVersion` when it has none. */
async function newestVersion(api: ApiClient, prototypeId: string): Promise<number> {
  const [newest] = await api.listVersions(prototypeId);
  return newest?.number ?? noVersion;
}

function sameFiles(a: Record<string, string>, b: Record<string, string>): boolean {
  const paths = Object.keys(a);
  return paths.length === Object.keys(b).length && paths.every((path) => a[path] === b[path]);
}
