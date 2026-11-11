import type { OAuth2Tokens } from "better-auth";
import { describe, expect, test, vi } from "vitest";
import {
  hasAllowedGitHubAccount,
  onlyAllowedGitHubUsers,
  parseGitHubUserIds,
} from "./allowedGitHubUsers.ts";

const tokens: OAuth2Tokens = { accessToken: "token" };

/** GitHub's profile as Better Auth's lookup returns it: the ID comes as a number. */
function profileOf(id: number) {
  return { user: { id: String(id), name: "someone" }, data: { id } };
}

describe("parseGitHubUserIds", () => {
  test("reads comma-separated IDs, ignoring spaces and empty entries", () => {
    expect([...parseGitHubUserIds(" 101984097, 42 ,,")]).toEqual(["101984097", "42"]);
  });

  test("an empty value allows no one", () => {
    expect(parseGitHubUserIds("").size).toBe(0);
  });
});

describe("onlyAllowedGitHubUsers", () => {
  const allowed = parseGitHubUserIds("101984097");

  test("passes the profile of an allowed user through", async () => {
    const getUserInfo = onlyAllowedGitHubUsers(async () => profileOf(101984097), allowed);
    expect(await getUserInfo(tokens)).toEqual(profileOf(101984097));
  });

  test("returns no profile for anyone else, so the sign-in ends", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const getUserInfo = onlyAllowedGitHubUsers(async () => profileOf(42), allowed);
    expect(await getUserInfo(tokens)).toBeNull();
  });

  test("returns no profile when GitHub gave none", async () => {
    const getUserInfo = onlyAllowedGitHubUsers(async () => null, allowed);
    expect(await getUserInfo(tokens)).toBeNull();
  });
});

describe("hasAllowedGitHubAccount", () => {
  const allowed = parseGitHubUserIds("101984097");

  test("is true when one of the user's GitHub accounts is allowed", () => {
    expect(hasAllowedGitHubAccount(["101984097"], allowed)).toBe(true);
  });

  test("is false for a user whose GitHub account was taken off the list", () => {
    expect(hasAllowedGitHubAccount(["42"], allowed)).toBe(false);
  });

  test("is false for a user with no GitHub account", () => {
    expect(hasAllowedGitHubAccount([], allowed)).toBe(false);
  });
});
