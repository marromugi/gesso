import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { getPlatformProxy } from "wrangler";

/** Better Auth's session cookie, with the `__Secure-` prefix `useSecureCookies` gives it. */
const sessionCookieName = "__Secure-better-auth.session_token";

/** Settings the tests use instead of `.dev.vars`, which CI doesn't have. */
const testVars = {
  AUTH_BASE_URL: "http://localhost:5173/api/auth",
  BETTER_AUTH_SECRET: "test-secret-that-is-at-least-32-characters",
  GITHUB_CLIENT_ID: "test",
  GITHUB_CLIENT_SECRET: "test",
  ALLOWED_GITHUB_USER_IDS: "1",
} satisfies Partial<Env>;

/** The GitHub ID `addUser` gives a user who is allowed to sign in. */
export const allowedGitHubId = "1";

export type LocalPlatform = {
  /** The Worker's bindings, on a fresh local D1 and R2 with every migration applied. */
  env: Env;
  dispose: () => Promise<void>;
};

/** Starts a local D1 and R2 that keep nothing on disk. */
export async function startLocalPlatform(): Promise<LocalPlatform> {
  const proxy = await getPlatformProxy<Env>({ persist: false });
  const env = { ...proxy.env, ...testVars };
  await applyMigrations(env.DB);
  return { env, dispose: () => proxy.dispose() };
}

/** Adds a user who signed in with the GitHub account `gitHubId`. */
export async function addUser(env: Env, id: string, gitHubId: string): Promise<void> {
  const at = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare(
      `insert into "user" (id, name, email, emailVerified, createdAt, updatedAt) values (?, ?, ?, 0, ?, ?)`,
    ).bind(id, id, `${id}@example.com`, at, at),
    env.DB.prepare(
      `insert into account (id, accountId, providerId, userId, createdAt, updatedAt) values (?, ?, 'github', ?, ?, ?)`,
    ).bind(`${id}-github`, gitHubId, id, at, at),
  ]);
}

/** Adds a prototype owned by `ownerId`. */
export async function addPrototype(env: Env, id: string, ownerId: string): Promise<void> {
  const at = new Date().toISOString();
  await env.DB.prepare(
    `insert into prototype (id, ownerId, name, createdAt, updatedAt) values (?, ?, ?, ?, ?)`,
  )
    .bind(id, ownerId, id, at, at)
    .run();
}

/** Makes a session for `userId` and gives the `Cookie` header that carries it. */
export async function signIn(env: Env, userId: string): Promise<string> {
  const token = crypto.randomUUID();
  const at = new Date();
  const expiresAt = new Date(at.getTime() + 60 * 60 * 1000);
  await env.DB.prepare(
    `insert into session (id, expiresAt, token, createdAt, updatedAt, userId) values (?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      crypto.randomUUID(),
      expiresAt.toISOString(),
      token,
      at.toISOString(),
      at.toISOString(),
      userId,
    )
    .run();
  // Signed the way Better Auth signs it: the token, a dot, and its HMAC-SHA256 in base64.
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(env.BETTER_AUTH_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(token));
  const signed = `${token}.${Buffer.from(signature).toString("base64")}`;
  return `${sessionCookieName}=${encodeURIComponent(signed)}`;
}

async function applyMigrations(d1: D1Database): Promise<void> {
  const dir = resolve(import.meta.dirname, "../../migrations");
  const files = readdirSync(dir)
    .filter((name) => name.endsWith(".sql"))
    .toSorted();
  for (const file of files) {
    const statements = readFileSync(resolve(dir, file), "utf8")
      .replaceAll("--> statement-breakpoint", "")
      .split(/;\s*(?:\n|$)/)
      .map((statement) => statement.trim())
      .filter((statement) => statement !== "");
    await d1.batch(statements.map((statement) => d1.prepare(statement)));
  }
}
