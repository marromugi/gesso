import { type ApiFailure, useGetHealth } from "@/lib/api";

export type ApiHealth =
  | { state: "checking" }
  | { state: "ok" }
  | { state: "failed"; failure: ApiFailure };

/** Asks the API whether it is up, and again whenever the query refetches. */
export function useApiHealth(): ApiHealth {
  const health = useGetHealth();
  if (health.isPending) return { state: "checking" };
  if (health.isError) return { state: "failed", failure: health.error.failure };
  return { state: "ok" };
}
