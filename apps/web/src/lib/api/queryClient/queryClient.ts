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
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: (failureCount, error) =>
          isUnreachable(error) && failureCount < unreachableRetryLimit,
        throwOnError: isBug,
      },
      mutations: {
        throwOnError: isBug,
      },
    },
  });
}
