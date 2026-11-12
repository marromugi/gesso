import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import * as v from "valibot";
import { CliError } from "./cliError.ts";

/** Where in the `.git` folder the CLI keeps which prototype and version the folder holds. */
const manifestName = "gesso.json";

/** A folder a version never holds (`leftOutFolder` in apps/api's versionFiles.ts). */
const leftOutFolder = "node_modules";

/** One of a format the CLI doesn't know is refused, not read in part. */
const SavedManifest = v.object({
  format: v.literal(2),
  prototypeId: v.string(),
  version: v.pipe(v.number(), v.integer(), v.minValue(0)),
  commit: v.nullable(v.string()),
});

/**
 * Which prototype the folder's repository is for, the version it was last synced with (0 for a
 * prototype with no version yet), and the commit that holds that version in this repository:
 * what the next pull's commit is made on top of. `null` until there is one.
 */
export type Manifest = { prototypeId: string; version: number; commit: string | null };

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
  let saved: unknown;
  try {
    saved = JSON.parse(text);
  } catch {
    saved = null;
  }
  const parsed = v.safeParse(SavedManifest, saved);
  if (!parsed.success) {
    throw new CliError(`${path} が壊れているか、形が違います。消してから pull し直してください。`);
  }
  const { prototypeId, version, commit } = parsed.output;
  return { prototypeId, version, commit };
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

/** SHA-256 as lowercase hex, as the API names content. */
export function hashContent(content: Uint8Array): string {
  return createHash("sha256").update(content).digest("hex");
}

function isNotFound(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
