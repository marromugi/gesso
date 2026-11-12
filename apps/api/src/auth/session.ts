import { and, eq } from "drizzle-orm";
import type { Context } from "hono";
import { authTables, getDb } from "../db/index.ts";
import {
  gitHubProviderId,
  hasAllowedGitHubAccount,
  parseGitHubUserIds,
} from "./allowedGitHubUsers.ts";
import { getAuth } from "./auth.ts";
import { bearerToken, withSessionCookie } from "./sessionCookie.ts";

/** The signed-in user as the routes see them. */
export type SessionUser = { id: string; name: string; email: string; image: string | null };

/**
 * Reads the session the request carries, in the session cookie (the web app) or as
 * `Authorization: Bearer <session token>` (the CLI), or `null` without a valid one or when the
 * user's GitHub account is no longer in `ALLOWED_GITHUB_USER_IDS`. For a cookie, Better Auth's
 * `Set-Cookie` headers (extending the session, clearing a bad cookie) are added to the response;
 * a Bearer token is never handed back as a cookie, which Better Auth's own routes would take.
 */
export async function readSessionUser<E extends { Bindings: Env }>(
  c: Context<E>,
): Promise<SessionUser | null> {
  const token = bearerToken(c.req.raw.headers);
  const { headers, response: session } = await getAuth(c.env).api.getSession({
    headers:
      token === null
        ? c.req.raw.headers
        : await withSessionCookie(c.req.raw.headers, token, c.env.BETTER_AUTH_SECRET),
    returnHeaders: true,
  });
  if (token === null) {
    for (const cookie of headers.getSetCookie()) c.header("set-cookie", cookie, { append: true });
  }
  if (!session) return null;
  const { id, name, email, image } = session.user;
  if (!(await isStillAllowed(c.env, id))) return null;
  return { id, name, email, image: image ?? null };
}

/**
 * Ends the session sent as `Authorization: Bearer <session token>`, as the CLI's sign-out does.
 * Returns `false` when the request carries no Bearer token.
 */
export async function endBearerSession<E extends { Bindings: Env }>(
  c: Context<E>,
): Promise<boolean> {
  const token = bearerToken(c.req.raw.headers);
  if (token === null) return false;
  await getAuth(c.env).api.signOut({
    headers: await withSessionCookie(c.req.raw.headers, token, c.env.BETTER_AUTH_SECRET),
  });
  return true;
}

async function isStillAllowed(env: Env, userId: string): Promise<boolean> {
  const { account } = authTables;
  const accounts = await getDb(env.DB)
    .select({ accountId: account.accountId })
    .from(account)
    .where(and(eq(account.userId, userId), eq(account.providerId, gitHubProviderId)));
  const allowed = hasAllowedGitHubAccount(
    accounts.map((row) => row.accountId),
    parseGitHubUserIds(env.ALLOWED_GITHUB_USER_IDS),
  );
  if (!allowed) console.warn(JSON.stringify({ event: "session_refused", userId }));
  return allowed;
}
