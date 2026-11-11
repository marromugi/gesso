import { betterAuth } from "better-auth";
import { authOptions } from "./authOptions.ts";

/** Where this Worker serves Better Auth's routes. */
export const authRoutePrefix = "/auth";

type Auth = ReturnType<typeof createAuth>;

function createAuth(env: Env) {
  return betterAuth({ ...authOptions(env), database: env.DB });
}

// One instance per Worker environment: building it per request would repeat Better Auth's setup,
// including its check of the database schema.
const authByEnv = new WeakMap<Env, Auth>();

export function getAuth(env: Env): Auth {
  let auth = authByEnv.get(env);
  if (!auth) {
    auth = createAuth(env);
    authByEnv.set(env, auth);
  }
  return auth;
}

/**
 * Better Auth routes by the public URL in `AUTH_BASE_URL`, but the web Worker forwards requests
 * here with `/api` removed. Puts the public origin and path back before handing the request over.
 */
export function toPublicAuthRequest(request: Request, authBaseUrl: string): Request {
  const url = new URL(request.url);
  if (url.pathname !== authRoutePrefix && !url.pathname.startsWith(`${authRoutePrefix}/`)) {
    throw new Error(`${url.pathname} is not under ${authRoutePrefix}`);
  }
  const publicBase = new URL(authBaseUrl);
  url.protocol = publicBase.protocol;
  url.host = publicBase.host;
  url.pathname = `${publicBase.pathname.replace(/\/+$/, "")}${url.pathname.slice(authRoutePrefix.length)}`;
  return new Request(url, request);
}
