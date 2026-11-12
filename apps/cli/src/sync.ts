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

export type PullResult = { version: number; written: number; deleted: number };

/**
 * Puts version `number` (or the newest) of `prototypeId` into `dir`. The folder must be empty, or
 * hold that prototype from an earlier pull or push with no file changed since: files of the old
 * version are replaced or deleted, and files gesso never had are left alone. With `force`,
 * changed files are overwritten. Throws `CliError` when the folder can't take the version.
 */
export async function pull(
  api: ApiClient,
  prototypeId: string,
  dir: string,
  { number, force = false }: { number?: number; force?: boolean } = {},
): Promise<PullResult> {
  const manifest = await readManifest(dir);
  if (manifest === null) {
    if (!(await isEmptyFolder(dir))) {
      throw new CliError(
        `${dir} は空ではなく、${manifestName} もありません。空のフォルダーを指定してください。`,
      );
    }
  } else {
    if (manifest.prototypeId !== prototypeId) {
      throw new CliError(`${dir} には別のプロトタイプ（${manifest.prototypeId}）が入っています。`);
    }
    if (!force) {
      const changed = await changedFiles(dir, manifest.files);
      if (changed.length > 0) {
        throw new CliError(
          `前に取ってきてから変わったファイルがあります: ${changed.join(", ")}。\`pnpm gesso push\` するか、--force で上書きしてください。`,
        );
      }
    }
  }

  const version = number ?? (await newestVersion(api, prototypeId));
  const files = await api.versionFiles(prototypeId, version);
  if (manifest !== null && !force) {
    const local = await localFiles(dir);
    const clashing = files
      .map((file) => file.path)
      .filter((path) => local.has(path) && !(path in manifest.files));
    if (clashing.length > 0) {
      throw new CliError(
        `gesso にないファイルが、版 ${version} のファイルと同じ場所にあります: ${clashing.join(", ")}。--force で上書きできます。`,
      );
    }
  }
  for (const file of files) {
    await writeLocalFile(dir, file.path, await api.readContent(prototypeId, file.hash));
  }
  const kept = new Set(files.map((file) => file.path));
  const gone = Object.keys(manifest?.files ?? {}).filter((path) => !kept.has(path));
  for (const path of gone) await deleteLocalFile(dir, path);
  await writeManifest(dir, { prototypeId, version, files: hashesOf(files) });
  return { version, written: files.length, deleted: gone.length };
}

export type PushResult =
  | { kind: "created"; version: number; uploaded: number; files: number }
  | { kind: "unchanged"; version: number };

/**
 * Sends the files in `dir` as the next version of the prototype its `.gesso.json` names,
 * uploading only content gesso doesn't have yet. Nothing is made when no file changed since the
 * version the folder was synced with. Throws `CliError` when the folder isn't a prototype's or
 * the API refuses the files.
 */
export async function push(api: ApiClient, dir: string): Promise<PushResult> {
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

async function newestVersion(api: ApiClient, prototypeId: string): Promise<number> {
  const [newest] = await api.listVersions(prototypeId);
  if (!newest) throw new CliError(`プロトタイプ ${prototypeId} にはまだ版がありません。`);
  return newest.number;
}

/** Files of the manifest that were changed or deleted in the folder since. */
async function changedFiles(dir: string, synced: Record<string, string>): Promise<string[]> {
  const local = await localFiles(dir);
  return Object.entries(synced)
    .filter(([path, hash]) => local.get(path)?.hash !== hash)
    .map(([path]) => path);
}

function sameFiles(a: Record<string, string>, b: Record<string, string>): boolean {
  const paths = Object.keys(a);
  return paths.length === Object.keys(b).length && paths.every((path) => a[path] === b[path]);
}
