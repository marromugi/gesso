import type { BetterAuthOptions } from "better-auth";

/** What the auth setup reads from the Worker's environment. */
export type AuthEnv = Record<
  "AUTH_BASE_URL" | "BETTER_AUTH_SECRET" | "GITHUB_CLIENT_ID" | "GITHUB_CLIENT_SECRET",
  string
>;

/**
 * Better Auth's settings, apart from the database. `scripts/auth-schema.ts` builds the schema from
 * these against a local SQLite file, so they must not import anything that only exists on Workers.
 *
 * Sign-in is GitHub only; no passwords are stored. The provider's tokens are dropped whenever an
 * account row is written, because nothing here calls GitHub after sign-in.
 */
export function authOptions(env: AuthEnv) {
  return {
    baseURL: env.AUTH_BASE_URL,
    secret: env.BETTER_AUTH_SECRET,
    telemetry: { enabled: false },
    socialProviders: {
      github: { clientId: env.GITHUB_CLIENT_ID, clientSecret: env.GITHUB_CLIENT_SECRET },
    },
    // Linking more accounts and reading the provider's tokens have no use with one provider and
    // no stored tokens.
    disabledPaths: [
      "/link-social",
      "/unlink-account",
      "/list-accounts",
      "/account-info",
      "/get-access-token",
      "/refresh-token",
    ],
    account: { updateAccountOnSignIn: false },
    databaseHooks: {
      account: {
        create: { before: async (account) => ({ data: withoutProviderTokens(account) }) },
        update: { before: async (account) => ({ data: withoutProviderTokens(account) }) },
      },
    },
    advanced: {
      // Secure and `__Secure-` prefixed even on http://localhost, which browsers treat as secure.
      useSecureCookies: true,
      cookies: {
        // The app reads the session only from its own pages, so no other site's link or form
        // needs to carry it. The OAuth state cookie stays `lax`: GitHub's redirect back is a
        // cross-site navigation.
        session_token: { attributes: { sameSite: "strict" } },
      },
    },
  } satisfies Omit<BetterAuthOptions, "database">;
}

function withoutProviderTokens<T extends object>(account: T): T {
  return {
    ...account,
    accessToken: null,
    refreshToken: null,
    idToken: null,
    accessTokenExpiresAt: null,
    refreshTokenExpiresAt: null,
  };
}
