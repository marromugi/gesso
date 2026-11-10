/**
 * How a call to the API failed.
 * - `unreachable`: no complete answer came from the API (network down, API not running, blocked
 *   by the browser, connection lost mid-body, or a gateway in between answering 502/504 for it).
 * - `rejected`: the API answered with another status outside 2xx.
 * - `unreadable`: the answer was 2xx but its body is not JSON.
 */
export type ApiFailure =
  | { kind: "unreachable" }
  | { kind: "rejected"; status: number }
  | { kind: "unreadable" };

export class ApiError extends Error {
  readonly failure: ApiFailure;

  constructor(failure: ApiFailure, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ApiError";
    this.failure = failure;
  }
}

/** Statuses a proxy or gateway sends when the server behind it gave no answer. */
const gatewayFailureStatuses: ReadonlySet<number> = new Set([502, 504]);

const apiBaseUrl = readApiBaseUrl(import.meta.env.VITE_API_BASE_URL);

function readApiBaseUrl(value: string | undefined): string {
  if (!value) {
    throw new Error(
      "VITE_API_BASE_URL is not set, so the web app has no API to call. Set it in the .env file for this mode.",
    );
  }
  return value.replace(/\/+$/, "");
}

/**
 * Sends a request to the API at `VITE_API_BASE_URL` + `path` and returns the parsed JSON body,
 * or `undefined` for an empty body. The generated client in `../generated` calls this for every
 * operation and supplies `T` from the OpenAPI document; the body is not checked against it.
 *
 * Throws `ApiError` for every failure listed in `ApiFailure`. An aborted request rejects with the
 * abort reason as `fetch` does.
 */
export async function fetchApi<T>(path: string, init: RequestInit): Promise<T> {
  const request = `${init.method ?? "GET"} ${path}`;

  let response: Response;
  let body: string;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, init);
    body = await response.text();
  } catch (cause) {
    if (init.signal?.aborted) throw cause;
    throw new ApiError({ kind: "unreachable" }, `${request}: no complete response`, { cause });
  }

  if (gatewayFailureStatuses.has(response.status)) {
    throw new ApiError({ kind: "unreachable" }, `${request}: gateway answered ${response.status}`);
  }
  if (!response.ok) {
    throw new ApiError(
      { kind: "rejected", status: response.status },
      `${request}: ${response.status}`,
    );
  }

  let parsed: unknown;
  try {
    parsed = body === "" ? undefined : JSON.parse(body);
  } catch (cause) {
    throw new ApiError({ kind: "unreadable" }, `${request}: body is not JSON`, { cause });
  }
  // orval's mutator contract: the generated caller picks T from the OpenAPI document.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return parsed as T;
}
