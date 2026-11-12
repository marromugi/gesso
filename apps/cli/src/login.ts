import { type Fetch, cliClientId } from "./api.ts";
import { CliError } from "./cliError.ts";

/** How much longer to wait between polls after the API says to slow down (RFC 8628). */
const slowDownStepMs = 5000;

const deviceCodeGrant = "urn:ietf:params:oauth:grant-type:device_code";

export type LoginIo = {
  fetch: Fetch;
  /** Tells the person what to open and which code to check. */
  say: (line: string) => void;
  wait: (ms: number) => Promise<void>;
};

/**
 * Signs in to the API at `apiUrl` with the device flow: asks for a code, has the person approve
 * it on the web app, and polls until they do. Returns the session token. Throws `CliError` when
 * they deny it, the code expires, or the API can't be reached.
 */
export async function login(apiUrl: string, io: LoginIo): Promise<string> {
  const code = await post<{
    device_code: string;
    user_code: string;
    verification_uri_complete: string;
    interval: number;
  }>(io.fetch, `${apiUrl}/auth/device/code`, { client_id: cliClientId });

  io.say("ブラウザで次の URL を開き、コードがこれと同じか確かめてから承認してください。");
  io.say(`  URL:    ${code.verification_uri_complete}`);
  io.say(`  コード: ${code.user_code}`);

  let intervalMs = code.interval * 1000;
  for (;;) {
    await io.wait(intervalMs);
    const answer = await post<{ access_token?: string; error?: string }>(
      io.fetch,
      `${apiUrl}/auth/device/token`,
      { grant_type: deviceCodeGrant, device_code: code.device_code, client_id: cliClientId },
      { acceptErrors: true },
    );
    if (answer.access_token !== undefined) return answer.access_token;
    if (answer.error === "authorization_pending") continue;
    if (answer.error === "slow_down") {
      intervalMs += slowDownStepMs;
      continue;
    }
    if (answer.error === "access_denied") throw new CliError("サインインは拒否されました。");
    if (answer.error === "expired_token") {
      throw new CliError("コードの期限が切れました。もう一度 `pnpm gesso login` してください。");
    }
    throw new CliError(`サインインできませんでした: ${answer.error ?? "応答が読めません"}`);
  }
}

/** POSTs JSON; with `acceptErrors`, a 400 body (the device flow's answers) is returned too. */
async function post<T>(
  fetchFn: Fetch,
  url: string,
  body: object,
  { acceptErrors = false } = {},
): Promise<T> {
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
  // The shapes RFC 8628 gives the device flow's answers.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return (await response.json()) as T;
}
