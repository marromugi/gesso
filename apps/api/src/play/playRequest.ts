/** The page a directory is served from, as `index.html` is at a version's root. */
const directoryPage = "index.html";

/**
 * What a request to the play Worker asks for: `/<token>/<path>`.
 * - `file`: the file at `path` in the version `token` is for; a path ending in `/` means its
 *   `index.html`.
 * - `addSlash`: `/<token>` alone, which must become `/<token>/` so that the page's relative URLs
 *   resolve inside the version.
 * - `invalid`: anything else.
 */
export type PlayRequest =
  | { kind: "file"; token: string; path: string }
  | { kind: "addSlash"; location: string }
  | { kind: "invalid" };

export function parsePlayRequest(pathname: string): PlayRequest {
  const [, token, ...rest] = pathname.split("/");
  if (token === undefined || token === "") return { kind: "invalid" };
  if (rest.length === 0) return { kind: "addSlash", location: `/${token}/` };
  let segments: string[];
  try {
    segments = rest.map((segment) => decodeURIComponent(segment));
  } catch {
    return { kind: "invalid" };
  }
  if (segments.at(-1) === "") segments[segments.length - 1] = directoryPage;
  // Looked up as it is in the version's list of paths, so a path outside it matches nothing.
  const path = segments.join("/");
  return { kind: "file", token, path };
}
