import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "../fetchApi/fetchApi.ts";

/** How many times a query is tried again after the API could not be reached. */
const unreachableRetryLimit = 3;

function isUnreachable(error: Error): boolean {
  return error instanceof ApiError && error.failure.kind === "unreachable";
}

/** Anything thrown that is not an `ApiError` is a bug, not a failure the screen can describe. */
function isBug(error: Error): boolean {
  return !(error instanceof ApiError);
}

/**
 * Builds the QueryClient for the generated query hooks.
 * - A query is tried again only when the API could not be reached, up to 3 times. A rejected or
 *   unreadable answer would come back the same, so it fails at once.
 * - A bug is thrown to the nearest error boundary, so a hook's `error` is always an `ApiError`.
 * - Requests are sent even when the browser reports it is offline. That flag doesn't say whether
 *   this API answers (it may run on this machine), so only `fetchApi` decides it is unreachable.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        networkMode: "always",
        retry: (failureCount, error) =>
          isUnreachable(error) && failureCount < unreachableRetryLimit,
        throwOnError: isBug,
      },
      mutations: {
        networkMode: "always",
        throwOnError: isBug,
      },
    },
  });
}
