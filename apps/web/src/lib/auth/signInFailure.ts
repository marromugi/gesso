/** Better Auth's code for a sign-in the API refused: the GitHub user is not allowed. */
const notAllowedCode = "unable_to_get_user_info";

/** The query parameter Better Auth adds when a sign-in fails and comes back to this app. */
const errorParam = "error";

export type SignInFailure = {
  /** What to tell the person. */
  message: string;
  /** The same URL without the error, to replace the one in the address bar. */
  href: string;
};

/**
 * Reads a failed sign-in from the URL Better Auth came back to (`?error=<code>`). Null when the
 * URL carries no error.
 */
export function readSignInFailure(location: {
  pathname: string;
  searchStr: string;
  hash: string;
}): SignInFailure | null {
  const params = new URLSearchParams(location.searchStr);
  const code = params.get(errorParam);
  if (code === null) return null;
  params.delete(errorParam);
  const search = params.size === 0 ? "" : `?${params.toString()}`;
  const hash = location.hash === "" ? "" : `#${location.hash}`;
  return { message: messageFor(code), href: `${location.pathname}${search}${hash}` };
}

function messageFor(code: string): string {
  if (code === notAllowedCode) return "この GitHub アカウントではサインインできません";
  return "サインインできませんでした";
}
