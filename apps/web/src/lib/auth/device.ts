import { ApiError, fetchApi } from "@/lib/api";

/** Where the API serves Better Auth's device sign-in routes. */
const devicePath = "/auth/device";

/** Where a CLI's sign-in stands, for the code it showed. */
export type DeviceStatus = "pending" | "approved" | "denied";

const statuses: ReadonlySet<string> = new Set<DeviceStatus>(["pending", "approved", "denied"]);

function isDeviceStatus(value: unknown): value is DeviceStatus {
  return typeof value === "string" && statuses.has(value);
}

/**
 * Looks up the CLI sign-in that showed `userCode`, and ties it to the signed-in person so they
 * can approve it. Throws `ApiError`; a code that doesn't exist or has expired is rejected with 400.
 */
export async function readDeviceSignIn(userCode: string): Promise<DeviceStatus> {
  const query = new URLSearchParams({ user_code: userCode });
  const body = await fetchApi<unknown>(`${devicePath}?${query}`, { method: "GET" });
  if (
    typeof body === "object" &&
    body !== null &&
    "status" in body &&
    isDeviceStatus(body.status)
  ) {
    return body.status;
  }
  throw new ApiError({ kind: "unreadable" }, `GET ${devicePath}: no known status in the body`);
}

/** Lets the CLI that showed `userCode` sign in as the signed-in person. Throws `ApiError`. */
export async function approveDeviceSignIn(userCode: string): Promise<void> {
  await answer("approve", userCode);
}

/** Refuses the CLI that showed `userCode`. Throws `ApiError`. */
export async function denyDeviceSignIn(userCode: string): Promise<void> {
  await answer("deny", userCode);
}

async function answer(action: "approve" | "deny", userCode: string): Promise<void> {
  await fetchApi<unknown>(`${devicePath}/${action}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userCode }),
  });
}
