import { ApiError, fetchApi } from "@/lib/api";

/** Where the API serves Better Auth's routes (`authRoutePrefix` in apps/api/src/auth). */
const authPath = "/auth";

const jsonPost = { method: "POST", headers: { "content-type": "application/json" } } as const;

/**
 * Starts signing in with GitHub: the browser leaves for GitHub and comes back to `returnTo`, a
 * path in this app. Throws `ApiError` when the API does not hand back where to go.
 */
export async function startGitHubSignIn(returnTo: string): Promise<void> {
  const body = await fetchApi<unknown>(`${authPath}/sign-in/social`, {
    ...jsonPost,
    body: JSON.stringify({ provider: "github", callbackURL: returnTo }),
  });
  window.location.assign(readRedirectUrl(body));
}

/** Ends the current session. Throws `ApiError` when the API does not confirm it. */
export async function signOut(): Promise<void> {
  await fetchApi<unknown>(`${authPath}/sign-out`, { ...jsonPost, body: "{}" });
}

function readRedirectUrl(body: unknown): string {
  if (typeof body === "object" && body !== null && "url" in body && typeof body.url === "string") {
    return body.url;
  }
  throw new ApiError({ kind: "unreadable" }, "POST /auth/sign-in/social: no url in the body");
}
