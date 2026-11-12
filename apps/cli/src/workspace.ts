import { createHash } from "node:crypto";
import { lstat, mkdir, readFile, readdir, rm, rmdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import * as v from "valibot";
import { CliError } from "./cliError.ts";

/** Where in the `.git` folder the CLI keeps which prototype and version the folder holds. */
const manifestName = "gesso.json";

/** A folder a version never holds (`leftOutFolder` in apps/api's versionFiles.ts). */
const leftOutFolder = "node_modules";

/** One the CLI doesn't know is refused, not read in part. */
const Manifest = v.object({
  format: v.literal(2),
  prototypeId: v.string(),
  /** The version the folder was last synced with; 0 for a prototype with no version yet. */
  version: v.pipe(v.number(), v.integer(), v.minValue(0)),
});

/** Which prototype the folder's repository is for, and the version it was last synced with. */
export type Manifest = { prototypeId: string; version: number };

/** The manifest in `gitDir`, or `null` when the repository has none. */
export async function readManifest(gitDir: string): Promise<Manifest | null> {
  const path = join(gitDir, manifestName);
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch (cause) {
    if (isNotFound(cause)) return null;
    throw cause;
  }
  const parsed = v.safeParse(Manifest, JSON.parse(text));
  if (!parsed.success) throw new CliError(`${path} の形が違います。`);
  return { prototypeId: parsed.output.prototypeId, version: parsed.output.version };
}

export async function writeManifest(gitDir: string, manifest: Manifest): Promise<void> {
  const text = JSON.stringify({ format: 2, ...manifest }, null, 2);
  await writeFile(join(gitDir, manifestName), `${text}\n`);
}

/**
 * Whether a file at `path` belongs in a version, as the API's rule has it: no part starts with a
 * dot (`.gitignore`, `.github/…`) or is `node_modules`.
 */
export function isVersionPath(path: string): boolean {
  return path
    .split("/")
    .every((segment) => segment !== "" && !segment.startsWith(".") && segment !== leftOutFolder);
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

/** SHA-256 as lowercase hex, as the API names content. */
export function hashContent(content: Uint8Array): string {
  return createHash("sha256").update(content).digest("hex");
}

/**
 * Throws unless `path` really is in the folder: not outside it by name, and not reached through
 * a link or a link itself, which would write somewhere git doesn't see.
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

function isNotFound(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
