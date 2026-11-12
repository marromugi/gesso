import type { BetterAuthOptions } from "better-auth";
import { deviceAuthorization } from "better-auth/plugins/device-authorization";
import { github } from "better-auth/social-providers";
import { onlyAllowedGitHubUsers, parseGitHubUserIds } from "./allowedGitHubUsers.ts";

/** The client ID the gesso CLI (apps/cli) signs in with; the only one device sign-in accepts. */
export const cliClientId = "gesso-cli";

/** The web app's page where a signed-in person approves a CLI's sign-in (apps/web `/device`). */
const deviceApprovalPath = "/device";

/**
 * Letters a CLI's sign-in code is made of: no digits, so the web app's router never reads a
 * code as a number (`2345E678`), and no I or O, which look like 1 and 0.
 */
const userCodeLetters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const userCodeLength = 8;

/** A code of `userCodeLength` letters, each equally likely. */
export function generateUserCode(): string {
  // Bytes from this on would make the first letters more likely than the rest.
  const limit = 256 - (256 % userCodeLetters.length);
  let code = "";
  while (code.length < userCodeLength) {
    for (const byte of crypto.getRandomValues(new Uint8Array(userCodeLength))) {
      if (byte < limit && code.length < userCodeLength) {
        code += userCodeLetters[byte % userCodeLetters.length];
      }
    }
  }
  return code;
}

/** What the auth setup reads from the Worker's environment. */
export type AuthEnv = Record<
  | "AUTH_BASE_URL"
  | "BETTER_AUTH_SECRET"
  | "GITHUB_CLIENT_ID"
  | "GITHUB_CLIENT_SECRET"
  | "ALLOWED_GITHUB_USER_IDS",
  string
>;

/**
 * Better Auth's settings, apart from the database. `scripts/auth-schema.ts` builds the schema from
 * these against a local SQLite file, so they must not import anything that only exists on Workers.
 *
 * Sign-in is GitHub only, and only for the GitHub users in `ALLOWED_GITHUB_USER_IDS` (checked
 * again on every session read, in `session.ts`); no passwords are stored. The provider's tokens
 * are dropped whenever an account row is written, because nothing here calls GitHub after
 * sign-in.
 *
 * The CLI signs in with the device flow (RFC 8628): it gets a code, the person approves it on the
 * web app's `/device` page while signed in, and the CLI receives a session token of its own,
 * which it sends as `Authorization: Bearer` (read in `session.ts`).
 */
export function authOptions(env: AuthEnv) {
  // Better Auth's own GitHub profile lookup, which the allowlist wraps.
  const gitHub = github({ clientId: env.GITHUB_CLIENT_ID, clientSecret: env.GITHUB_CLIENT_SECRET });
  return {
    baseURL: env.AUTH_BASE_URL,
    secret: env.BETTER_AUTH_SECRET,
    telemetry: { enabled: false },
    socialProviders: {
      github: {
        clientId: env.GITHUB_CLIENT_ID,
        clientSecret: env.GITHUB_CLIENT_SECRET,
        getUserInfo: onlyAllowedGitHubUsers(
          (tokens) => gitHub.getUserInfo(tokens),
          parseGitHubUserIds(env.ALLOWED_GITHUB_USER_IDS),
        ),
      },
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
    plugins: [
      deviceAuthorization({
        // Relative to the auth base URL's origin: the web app's page, not an API route.
        verificationUri: deviceApprovalPath,
        validateClient: (clientId) => clientId === cliClientId,
        generateUserCode,
      }),
    ],
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
