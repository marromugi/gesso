/** Better Auth's session cookie, with the `__Secure-` prefix `useSecureCookies` gives it. */
export const sessionCookieName = "__Secure-better-auth.session_token";

/** The scheme the CLI sends its session token with. */
const bearerPrefix = "bearer ";

/**
 * The `Cookie` header that carries session `token`, signed the way Better Auth signs it: the
 * token, a dot, and its HMAC-SHA256 under `secret` in base64.
 */
export async function sessionCookieHeader(token: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(token));
  const signed = `${token}.${Buffer.from(signature).toString("base64")}`;
  return `${sessionCookieName}=${encodeURIComponent(signed)}`;
}

/** The session token sent as `Authorization: Bearer <token>`, or `null` without one. */
export function bearerToken(headers: Headers): string | null {
  const authorization = headers.get("authorization");
  if (authorization?.slice(0, bearerPrefix.length).toLowerCase() !== bearerPrefix) return null;
  const token = authorization.slice(bearerPrefix.length).trim();
  return token === "" ? null : token;
}

/**
 * `headers` with the session cookie Better Auth reads in place of any cookie, carrying `token`.
 * Better Auth's `bearer` plugin does the same, but it also hands the session token back in a
 * header on every response that sets the cookie, which a page's script could read.
 */
export async function withSessionCookie(
  headers: Headers,
  token: string,
  secret: string,
): Promise<Headers> {
  const converted = new Headers(headers);
  converted.set("cookie", await sessionCookieHeader(token, secret));
  return converted;
}
