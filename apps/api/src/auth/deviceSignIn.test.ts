import { afterAll, beforeAll, expect, test, vi } from "vitest";
import { app } from "../app.ts";
import {
  type LocalPlatform,
  addUser,
  allowedGitHubId,
  makeSession,
  signIn,
  startLocalPlatform,
} from "../testing/localPlatform.ts";
import { cliClientId } from "./authOptions.ts";

/** The web app's origin, which the browser's requests come from. */
const webOrigin = "http://localhost:5173";

/** A little over the 5 seconds Better Auth asks a device to wait between polls. */
const pollingIntervalMs = 6000;

let platform: LocalPlatform;
let cookie: string;

beforeAll(async () => {
  platform = await startLocalPlatform();
  await addUser(platform.env, "owner", allowedGitHubId);
  await addUser(platform.env, "refused", "999");
  await addUser(platform.env, "other", allowedGitHubId);
  cookie = await signIn(platform.env, "owner");
});

afterAll(async () => {
  await platform.dispose();
});

async function call(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (typeof init.body === "string") headers.set("content-type", "application/json");
  return app.request(path, { ...init, headers }, platform.env);
}

/** What the browser sends on the approval page: the session cookie, from the web app's origin. */
const fromBrowser = () => ({ cookie, origin: webOrigin });

type DeviceCode = {
  device_code: string;
  user_code: string;
  verification_uri_complete: string;
};

async function startCliSignIn(): Promise<DeviceCode> {
  const response = await call("/auth/device/code", {
    method: "POST",
    body: JSON.stringify({ client_id: cliClientId }),
  });
  expect(response.status).toBe(200);
  return response.json();
}

function pollToken(deviceCode: string): Promise<Response> {
  return call("/auth/device/token", {
    method: "POST",
    body: JSON.stringify({
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      device_code: deviceCode,
      client_id: cliClientId,
    }),
  });
}

test("the CLI signs in once the person approves its code on the web app", async () => {
  const code = await startCliSignIn();
  expect(code.verification_uri_complete).toBe(`${webOrigin}/device?user_code=${code.user_code}`);
  expect(await (await pollToken(code.device_code)).json()).toMatchObject({
    error: "authorization_pending",
  });

  const shown = await call(`/auth/device?user_code=${code.user_code}`, { headers: fromBrowser() });
  expect(await shown.json()).toMatchObject({ status: "pending", client_id: cliClientId });
  const approved = await call("/auth/device/approve", {
    method: "POST",
    headers: fromBrowser(),
    body: JSON.stringify({ userCode: code.user_code }),
  });
  expect(approved.status).toBe(200);

  // The CLI waits out the polling interval before asking again.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(Date.now() + pollingIntervalMs);
  const token = await pollToken(code.device_code);
  vi.useRealTimers();
  expect(token.status).toBe(200);
  const { access_token: accessToken }: { access_token: string } = await token.json();
  const me = await call("/me", { headers: { authorization: `Bearer ${accessToken}` } });
  expect(await me.json()).toMatchObject({ user: { id: "owner" } });
});

test("a denied code gives the CLI no session", async () => {
  const code = await startCliSignIn();
  await call(`/auth/device?user_code=${code.user_code}`, { headers: fromBrowser() });
  await call("/auth/device/deny", {
    method: "POST",
    headers: fromBrowser(),
    body: JSON.stringify({ userCode: code.user_code }),
  });

  expect(await (await pollToken(code.device_code)).json()).toMatchObject({
    error: "access_denied",
  });
});

test("only the gesso CLI can ask for a code", async () => {
  const response = await call("/auth/device/code", {
    method: "POST",
    body: JSON.stringify({ client_id: "someone-else" }),
  });
  expect(response.status).toBe(400);
});

test("codes are letters only, which the web app's router keeps as text", async () => {
  for (let i = 0; i < 5; i += 1) {
    expect((await startCliSignIn()).user_code).toMatch(/^[A-HJ-NP-Z]{8}$/);
  }
});

test("someone else signed in can't approve a code the person opened", async () => {
  const code = await startCliSignIn();
  await call(`/auth/device?user_code=${code.user_code}`, { headers: fromBrowser() });
  const otherCookie = await signIn(platform.env, "other");

  const response = await call("/auth/device/approve", {
    method: "POST",
    headers: { cookie: otherCookie, origin: webOrigin },
    body: JSON.stringify({ userCode: code.user_code }),
  });

  expect(response.status).toBe(403);
});

test("a session of someone no longer allowed is signed out, even as Bearer", async () => {
  const headers = { authorization: `Bearer ${await makeSession(platform.env, "refused")}` };
  expect(await (await call("/me", { headers })).json()).toEqual({ user: null });
  expect((await call("/prototypes", { headers })).status).toBe(401);
});

test("a Bearer session extended on read never comes back as a cookie", async () => {
  // The same kind of session, read as a cookie, is extended with a new cookie.
  const byCookie = await call("/me", { headers: { cookie: await signIn(platform.env, "owner") } });
  expect(byCookie.headers.getSetCookie()).not.toEqual([]);

  const token = await makeSession(platform.env, "owner");
  const byBearer = await call("/me", { headers: { authorization: `Bearer ${token}` } });

  expect(await byBearer.json()).toMatchObject({ user: { id: "owner" } });
  expect(byBearer.headers.getSetCookie()).toEqual([]);
});

test("the CLI's sign-out ends its session", async () => {
  const headers = { authorization: `Bearer ${await makeSession(platform.env, "owner")}` };

  expect((await call("/session", { method: "DELETE", headers })).status).toBe(204);

  expect(await (await call("/me", { headers })).json()).toEqual({ user: null });
  expect((await call("/session", { method: "DELETE" })).status).toBe(401);
});
