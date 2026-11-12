import type { OAuth2Tokens } from "better-auth";

/** The provider ID Better Auth stores in `account.providerId` for GitHub sign-ins. */
export const gitHubProviderId = "github";

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
 * Wraps Better Auth's GitHub profile lookup so that only the users in `allowedIds` get a
 * profile. For anyone else it returns `null`, which makes Better Auth end the sign-in with
 * `unable_to_get_user_info` before any user, account, or session is written.
 */
export function onlyAllowedGitHubUsers<Info extends { data: { id: unknown } }>(
  getUserInfo: (tokens: OAuth2Tokens) => Promise<Info | null>,
  allowedIds: ReadonlySet<string>,
): (tokens: OAuth2Tokens) => Promise<Info | null> {
  return async (tokens) => {
    const info = await getUserInfo(tokens);
    if (!info) return null;
    // Better Auth types the ID as a string, but GitHub's API sends a number.
    const gitHubUserId = String(info.data.id);
    if (!allowedIds.has(gitHubUserId)) {
      console.warn(JSON.stringify({ event: "github_sign_in_refused", gitHubUserId }));
      return null;
    }
    return info;
  };
}

/**
 * Whether a signed-in user may keep using the app: one of their GitHub accounts is still in
 * `allowedIds`. Checked on every session read, so taking an ID off the list ends that user's
 * access at once, not only their next sign-in.
 */
export function hasAllowedGitHubAccount(
  gitHubAccountIds: readonly string[],
  allowedIds: ReadonlySet<string>,
): boolean {
  return gitHubAccountIds.some((id) => allowedIds.has(id));
}
