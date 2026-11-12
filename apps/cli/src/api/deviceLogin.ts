import * as v from "valibot";
import { CliError } from "../cliError.ts";

/** The client ID the API's device sign-in accepts (`cliClientId` in apps/api). */
const cliClientId = "gesso-cli";

/** How much longer to wait between polls after the API says to slow down (RFC 8628). */
const slowDownStepMs = 5000;

const deviceCodeGrant = "urn:ietf:params:oauth:grant-type:device_code";

const DeviceCode = v.object({
  device_code: v.string(),
  user_code: v.string(),
  verification_uri_complete: v.string(),
  interval: v.number(),
});

const TokenAnswer = v.union([
  v.object({ access_token: v.string() }),
  v.object({ error: v.string() }),
]);

/** Where the person approves the sign-in, and the code they check there. */
export type Approval = { url: string; userCode: string };

export type DeviceLoginIo = {
  fetch: typeof fetch;
  /** Shows the person where to approve and which code to check. */
  show: (approval: Approval) => void;
  wait: (ms: number) => Promise<void>;
};

/**
 * Signs in to the API at `apiUrl` with the device flow: asks for a code, has the person approve
 * it on the web app, and polls until they do. Returns the session token. Throws `CliError` when
 * they deny it, the code expires, or the API can't be reached.
 */
export async function deviceLogin(apiUrl: string, io: DeviceLoginIo): Promise<string> {
  const code = v.parse(
    DeviceCode,
    await post(io.fetch, `${apiUrl}/auth/device/code`, { client_id: cliClientId }),
  );
  io.show({ url: code.verification_uri_complete, userCode: code.user_code });

  let intervalMs = code.interval * 1000;
  for (;;) {
    await io.wait(intervalMs);
    const answer = v.parse(
      TokenAnswer,
      await post(
        io.fetch,
        `${apiUrl}/auth/device/token`,
        { grant_type: deviceCodeGrant, device_code: code.device_code, client_id: cliClientId },
        { acceptErrors: true },
      ),
    );
    if ("access_token" in answer) return answer.access_token;
    if (answer.error === "authorization_pending") continue;
    if (answer.error === "slow_down") {
      intervalMs += slowDownStepMs;
      continue;
    }
    if (answer.error === "access_denied") throw new CliError("サインインは拒否されました。");
    if (answer.error === "expired_token") {
      throw new CliError("コードの期限が切れました。もう一度 `pnpm gesso login` してください。");
    }
    throw new CliError(`サインインできませんでした: ${answer.error}`);
  }
}

/** POSTs JSON; with `acceptErrors`, a 400 body (the device flow's answers) is returned too. */
async function post(
  fetchFn: typeof fetch,
  url: string,
  body: object,
  { acceptErrors = false } = {},
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetchFn(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (cause) {
    throw new CliError(`${new URL(url).origin} に接続できません。`, { cause });
  }
  if (!response.ok && !(acceptErrors && response.status === 400)) {
    throw new CliError(`POST ${url} が ${response.status} を返しました: ${await response.text()}`);
  }
  return response.json();
}
