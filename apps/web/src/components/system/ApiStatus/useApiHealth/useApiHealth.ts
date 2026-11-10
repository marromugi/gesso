import { useEffect, useState } from "react";
import { ApiError, type ApiFailure, getHealth } from "@/lib/api";

export type ApiHealth =
  | { state: "checking" }
  | { state: "ok" }
  | { state: "failed"; failure: ApiFailure };

/** Asks the API whether it is up when the caller mounts. */
export function useApiHealth(): ApiHealth {
  const [health, setHealth] = useState<ApiHealth>({ state: "checking" });

  useEffect(() => {
    const controller = new AbortController();
    getHealth({ signal: controller.signal }).then(
      () => {
        if (!controller.signal.aborted) setHealth({ state: "ok" });
      },
      (error: unknown) => {
        if (controller.signal.aborted) return;
        if (!(error instanceof ApiError)) throw error;
        setHealth({ state: "failed", failure: error.failure });
      },
    );
    return () => controller.abort();
  }, []);

  return health;
}
