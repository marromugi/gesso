import type { Context, MiddlewareHandler } from "hono";
import { getAuth } from "./auth.ts";

/** The signed-in user as the routes see them. */
export type SessionUser = { id: string; name: string; email: string; image: string | null };

/** What `requireUser` puts in the context for the routes behind it. */
export type SignedInVariables = { user: SessionUser };

/**
 * Reads the session the request carries, or `null` without a valid one. Better Auth's
 * `Set-Cookie` headers (extending the session, clearing a bad cookie) are added to the response.
 */
export async function readSessionUser<E extends { Bindings: Env }>(
  c: Context<E>,
): Promise<SessionUser | null> {
  const { headers, response: session } = await getAuth(c.env).api.getSession({
    headers: c.req.raw.headers,
    returnHeaders: true,
  });
  for (const cookie of headers.getSetCookie()) c.header("set-cookie", cookie, { append: true });
  if (!session) return null;
  const { id, name, email, image } = session.user;
  return { id, name, email, image: image ?? null };
}

/** Lets only signed-in requests through, with the user in `c.var.user`; others get 401. */
export const requireUser: MiddlewareHandler<{
  Bindings: Env;
  Variables: SignedInVariables;
}> = async (c, next) => {
  const user = await readSessionUser(c);
  if (!user) return c.json({ error: "unauthorized" } as const, 401);
  c.set("user", user);
  return next();
};
