import type { OAuth2Tokens } from "better-auth";
import { github } from "better-auth/social-providers";

/**
 * Reads `ALLOWED_GITHUB_USER_IDS`: GitHub's numeric user IDs, separated by commas. The numeric
 * ID is used, not the login name, because a login can be changed and then taken by someone else.
 */
export function parseGitHubUserIds(value: string): ReadonlySet<string> {
  return new Set(
    value
      .split(",")
      .map((id) => id.trim())
      .filter((id) => id !== ""),
  );
}

/**
 * Better Auth's GitHub sign-in, letting through only the users in `allowedIds`. For anyone else
 * the profile comes back empty, so the callback fails before a user or session is made, both for
 * a first sign-in and for a user who already exists.
 */
export function signInOnlyAllowedGitHubUsers(
  credentials: { clientId: string; clientSecret: string },
  allowedIds: ReadonlySet<string>,
) {
  const provider = github(credentials);
  return async (tokens: OAuth2Tokens) => {
    const info = await provider.getUserInfo(tokens);
    // Better Auth types the ID as a string, but GitHub's API sends a number.
    // oxlint-disable-next-line typescript/no-unnecessary-type-conversion
    if (!info || !allowedIds.has(String(info.data.id))) return null;
    return info;
  };
}
