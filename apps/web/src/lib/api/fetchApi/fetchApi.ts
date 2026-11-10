/**
 * How a call to the API failed.
 * - `unreachable`: no response came back (network down, API not running, blocked by the browser).
 * - `rejected`: the API answered with a status outside 2xx.
 */
export type ApiFailure = { kind: "unreachable" } | { kind: "rejected"; status: number };

export class ApiError extends Error {
  readonly failure: ApiFailure;

  constructor(failure: ApiFailure, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ApiError";
    this.failure = failure;
  }
}

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
 * Throws `ApiError` when no response comes back or the status is outside 2xx. An aborted request
 * rejects with the abort reason as `fetch` does.
 */
export async function fetchApi<T>(path: string, init: RequestInit): Promise<T> {
  const request = `${init.method ?? "GET"} ${path}`;

  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, init);
  } catch (cause) {
    if (init.signal?.aborted) throw cause;
    throw new ApiError({ kind: "unreachable" }, `${request}: no response`, { cause });
  }

  if (!response.ok) {
    throw new ApiError(
      { kind: "rejected", status: response.status },
      `${request}: ${response.status}`,
    );
  }

  const body = await response.text();
  // orval's mutator contract: the generated caller picks T from the OpenAPI document.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return (body === "" ? undefined : JSON.parse(body)) as T;
}
