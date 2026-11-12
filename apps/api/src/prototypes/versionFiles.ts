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

/** A folder a version never holds: the CLI (apps/cli) leaves it out of what it sends. */
const leftOutFolder = "node_modules";

/**
 * Whether `path` can name a file in a version: relative, separated by `/`, with no empty
 * segment, so it can't point outside the version when it is served or written to disk. No
 * segment starts with a dot (`.env`, `.git`, `..`) or is `node_modules`: the CLI never sends
 * those, so a version that had them couldn't be pulled and pushed back unchanged.
 */
export function isFilePath(path: string): boolean {
  if (path.length === 0 || path.length > maxPathLength) return false;
  // Control characters and backslashes mean different things on different systems.
  for (const character of path) {
    const code = character.charCodeAt(0);
    if (code < 0x20 || code === 0x7f || character === "\\") return false;
  }
  return path
    .split("/")
    .every((segment) => segment !== "" && !segment.startsWith(".") && segment !== leftOutFolder);
}

/**
 * What is wrong with a version's list of files as a whole, or `null` when it can be saved: the
 * files must fit on any disk as a tree, with `index.html` at the root. Each path is assumed to
 * pass `isFilePath` already.
 */
export function versionFilesProblem(files: readonly VersionFile[]): string | null {
  if (files.length > maxFilesPerVersion) return `more than ${maxFilesPerVersion} files`;
  // Compared without case: on macOS and Windows disks, `A.js` and `a.js` are the same file.
  const paths = new Map<string, string>();
  for (const { path } of files) {
    const key = path.toLowerCase();
    const earlier = paths.get(key);
    if (earlier === path) return `${path} is listed twice`;
    if (earlier !== undefined) return `${earlier} and ${path} differ only in case`;
    paths.set(key, path);
  }
  for (const [key, path] of paths) {
    const segments = key.split("/");
    for (let end = 1; end < segments.length; end += 1) {
      const directory = paths.get(segments.slice(0, end).join("/"));
      if (directory !== undefined) return `${directory} is a file and a directory of ${path}`;
    }
  }
  if (!paths.has(entryPath)) return `no ${entryPath} at the root`;
  return null;
}

/** SHA-256 of `content`, as lowercase hex. */
export async function hashContent(content: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", content);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
