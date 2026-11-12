import { CliError } from "../cliError.ts";

/** Who calls the API, and where: what `gesso login` saved, with the `fetch` to use. */
export type Session = { apiUrl: string; token: string; fetch: typeof fetch };

/** What every generated call in `../generated/api.ts` passes on to `request`. */
export type RequestOptions = RequestInit & { session?: Session };

/**
 * Sends a call of the generated client to the API, as `session`, and answers with the status,
 * the body (JSON parsed, other content as a `Blob`) and the headers, whatever the status. Only a
 * call that gets no answer at all throws `CliError`.
 */
export async function request<T>(path: string, options: RequestOptions): Promise<T> {
  const { session, ...init } = options;
  if (!session) throw new Error(`${path} was called without a session`);
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${session.token}`);
  let response: Response;
  try {
    response = await session.fetch(`${session.apiUrl}${path}`, { ...init, headers });
  } catch (cause) {
    throw new CliError(`API（${session.apiUrl}）に接続できません。`, { cause });
  }
  const type = response.headers.get("content-type") ?? "";
  const data = type.includes("application/json")
    ? await response.json()
    : response.status === 204
      ? undefined
      : await response.blob();
  // orval's mutator contract: the generated caller gives `T` as the status-and-body union.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return { status: response.status, data, headers: response.headers } as T;
}
