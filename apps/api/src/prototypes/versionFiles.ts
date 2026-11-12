/** The page a version starts from when it is played. Every version has it at its root. */
export const entryPath = "index.html";

/** The most files one version holds. */
export const maxFilesPerVersion = 1000;

/** The longest path a file takes, in characters. */
export const maxPathLength = 512;

/** The largest file that can be uploaded, in bytes. */
export const maxFileSize = 10 * 1024 * 1024;

/** SHA-256 as lowercase hex: how a file's content is named. */
export const hashPattern = /^[0-9a-f]{64}$/;

export type VersionFile = { path: string; hash: string };

/**
 * Whether `path` can name a file in a version: relative, separated by `/`, and with no empty,
 * `.` or `..` segment, so it can't point outside the version when it is served or written to disk.
 */
export function isFilePath(path: string): boolean {
  if (path.length === 0 || path.length > maxPathLength) return false;
  // Control characters and backslashes mean different things on different systems.
  for (const character of path) {
    const code = character.charCodeAt(0);
    if (code < 0x20 || code === 0x7f || character === "\\") return false;
  }
  return path.split("/").every((segment) => segment !== "" && segment !== "." && segment !== "..");
}

/**
 * What is wrong with a version's list of files as a whole, or `null` when it can be saved. Each
 * path is assumed to pass `isFilePath` already.
 */
export function versionFilesProblem(files: readonly VersionFile[]): string | null {
  if (files.length > maxFilesPerVersion) return `more than ${maxFilesPerVersion} files`;
  const paths = new Set<string>();
  for (const { path } of files) {
    if (paths.has(path)) return `${path} is listed twice`;
    paths.add(path);
  }
  if (!paths.has(entryPath)) return `no ${entryPath} at the root`;
  return null;
}

/** SHA-256 of `content`, as lowercase hex. */
export async function hashContent(content: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", content);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
