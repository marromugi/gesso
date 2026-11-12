import { createHash } from "node:crypto";
import { lstat, mkdir, readFile, readdir, rm, rmdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import type { VersionFile } from "./api.ts";
import { CliError } from "./cliError.ts";

/** The file in a prototype's folder that says which prototype and version it holds. */
export const manifestName = ".gesso.json";

/** The format of `.gesso.json`; one this CLI doesn't know is refused, not read in part. */
const manifestFormat = 1;

/** Folders never sent as part of a version, besides anything whose name starts with a dot. */
const skippedFolders: ReadonlySet<string> = new Set(["node_modules"]);

/**
 * What a folder pulled from or pushed to gesso holds: the prototype, the version it was last
 * synced with, and each file's SHA-256 at that point, to tell which files were changed since.
 */
export type Manifest = { prototypeId: string; version: number; files: Record<string, string> };

/** The folder's `.gesso.json`, or `null` when it has none. */
export async function readManifest(dir: string): Promise<Manifest | null> {
  let text: string;
  try {
    text = await readFile(join(dir, manifestName), "utf8");
  } catch (cause) {
    if (isNotFound(cause)) return null;
    throw cause;
  }
  const saved: unknown = JSON.parse(text);
  if (
    typeof saved === "object" &&
    saved !== null &&
    "format" in saved &&
    saved.format === manifestFormat &&
    "prototypeId" in saved &&
    typeof saved.prototypeId === "string" &&
    "version" in saved &&
    typeof saved.version === "number" &&
    "files" in saved &&
    isHashes(saved.files)
  ) {
    return { prototypeId: saved.prototypeId, version: saved.version, files: saved.files };
  }
  throw new CliError(`${join(dir, manifestName)} の形が違います。`);
}

export async function writeManifest(dir: string, manifest: Manifest): Promise<void> {
  const text = JSON.stringify({ format: manifestFormat, ...manifest }, null, 2);
  await writeFile(join(dir, manifestName), `${text}\n`);
}

/**
 * The files of the folder that make a version, with their content and SHA-256, by path with `/`.
 * Anything whose name starts with a dot (`.gesso.json`, `.git`) and `node_modules` are left out,
 * and so are links.
 */
export async function localFiles(
  dir: string,
): Promise<Map<string, { hash: string; content: Uint8Array }>> {
  const files = new Map<string, { hash: string; content: Uint8Array }>();
  async function walk(relative: string): Promise<void> {
    const entries = await readdir(join(dir, relative), { withFileTypes: true }).catch(
      (cause: unknown) => {
        // A folder that isn't there yet holds nothing.
        if (relative === "" && isNotFound(cause)) return [];
        throw cause;
      },
    );
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      const path = relative === "" ? entry.name : `${relative}/${entry.name}`;
      if (entry.isDirectory()) {
        if (!skippedFolders.has(entry.name)) await walk(path);
      } else if (entry.isFile()) {
        const content = new Uint8Array(await readFile(join(dir, path)));
        files.set(path, { hash: hashContent(content), content });
      }
    }
  }
  await walk("");
  return files;
}

/** Whether the folder has nothing in it but dot files (or doesn't exist). */
export async function isEmptyFolder(dir: string): Promise<boolean> {
  try {
    const entries = await readdir(dir);
    return entries.every((name) => name.startsWith("."));
  } catch (cause) {
    if (isNotFound(cause)) return true;
    throw cause;
  }
}

/** Writes `content` at `path` in the folder, making the folders on the way. */
export async function writeLocalFile(dir: string, path: string, content: Uint8Array) {
  await insideFolder(dir, path);
  const target = resolve(dir, path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content);
}

/** Deletes the file at `path` in the folder, then the folders it leaves empty. */
export async function deleteLocalFile(dir: string, path: string) {
  await insideFolder(dir, path);
  const root = resolve(dir);
  await rm(resolve(root, path), { force: true });
  for (let folder = dirname(resolve(root, path)); folder !== root; folder = dirname(folder)) {
    if ((await readdir(folder)).length > 0) break;
    await rmdir(folder);
  }
}

/**
 * Throws unless `path` really is in the folder: not outside it by name, not reached through a
 * link (which `localFiles` never reads, so nothing would warn that it is overwritten), and not a
 * link itself.
 */
async function insideFolder(dir: string, path: string): Promise<void> {
  const root = resolve(dir);
  const outside = new CliError(`版のパス ${path} はフォルダーの外か、リンクの先を指しています。`);
  if (!resolve(root, path).startsWith(`${root}${sep}`)) throw outside;
  // Each part that exists already must be a real file or folder; the rest is made new.
  let current = root;
  for (const segment of path.split("/")) {
    current = join(current, segment);
    const stat = await lstat(current).catch((cause: unknown) => {
      if (isNotFound(cause)) return null;
      throw cause;
    });
    if (stat === null) return;
    if (stat.isSymbolicLink()) throw outside;
  }
}

/** SHA-256 as lowercase hex, as the API names content. */
export function hashContent(content: Uint8Array): string {
  return createHash("sha256").update(content).digest("hex");
}

/** A version's files as the manifest keeps them. */
export function hashesOf(files: readonly VersionFile[]): Record<string, string> {
  return Object.fromEntries(files.map((file) => [file.path, file.hash]));
}

function isHashes(value: unknown): value is Record<string, string> {
  return (
    typeof value === "object" &&
    value !== null &&
    Object.values(value).every((hash) => typeof hash === "string")
  );
}

function isNotFound(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
