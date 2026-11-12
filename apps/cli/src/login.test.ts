import { expect, test } from "vitest";
import type { Fetch } from "./api.ts";
import { login } from "./login.ts";

const apiUrl = "https://gesso.test/api";

/**
 * Stands in for the API's device sign-in: the code is answered with `answers` in turn, one per
 * poll. `waits` keeps how long the CLI waited before each poll.
 */
function fakeDeviceFlow(answers: object[]) {
  const waits: number[] = [];
  const said: string[] = [];
  const fetchFn: Fetch = async (input, init) => {
    const request = new Request(input, init);
    const { url } = request;
    const body: { client_id?: string; device_code?: string } = JSON.parse(await request.text());
    if (url === `${apiUrl}/auth/device/code` && body.client_id === "gesso-cli") {
      return Response.json({
        device_code: "device-1",
        user_code: "ABCD2345",
        verification_uri_complete: "https://gesso.test/device?user_code=ABCD2345",
        interval: 5,
      });
    }
    if (url === `${apiUrl}/auth/device/token` && body.device_code === "device-1") {
      const answer = answers.shift() ?? {};
      return Response.json(answer, { status: "access_token" in answer ? 200 : 400 });
    }
    return new Response(null, { status: 404 });
  };
  const io = {
    fetch: fetchFn,
    say: (line: string) => said.push(line),
    wait: async (ms: number) => {
      waits.push(ms);
    },
  };
  return { io, waits, said };
}

test("login shows where to approve, waits while pending, and returns the session token", async () => {
  const flow = fakeDeviceFlow([
    { error: "authorization_pending" },
    { error: "slow_down" },
    { access_token: "session-token", token_type: "Bearer" },
  ]);

  expect(await login(apiUrl, flow.io)).toBe("session-token");
  expect(flow.said.join("\n")).toContain("https://gesso.test/device?user_code=ABCD2345");
  expect(flow.said.join("\n")).toContain("ABCD2345");
  // Slowing down adds 5 seconds to the interval the API gave.
  expect(flow.waits).toEqual([5000, 5000, 10000]);
});

test.each([
  ["denied", { error: "access_denied" }, /拒否/],
  ["expired", { error: "expired_token" }, /期限/],
])("a %s sign-in fails with what to do", async (_, answer, message) => {
  await expect(login(apiUrl, fakeDeviceFlow([answer]).io)).rejects.toThrow(message);
});
