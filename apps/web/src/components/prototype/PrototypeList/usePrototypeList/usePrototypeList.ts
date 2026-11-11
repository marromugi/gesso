import { type ApiFailure, type Prototype, useListPrototypes } from "@/lib/api";

export type PrototypeListState =
  | { state: "loading" }
  | { state: "signedOut" }
  | { state: "failed"; failure: ApiFailure }
  | { state: "ready"; prototypes: Prototype[] };

/** HTTP status the API answers with when the request carries no valid session. */
const unauthorizedStatus = 401;

/** The signed-in person's prototypes, newest first; signed out when the API says so. */
export function usePrototypeList(): PrototypeListState {
  const list = useListPrototypes();
  if (list.isPending) return { state: "loading" };
  if (list.isError) {
    const { failure } = list.error;
    if (failure.kind === "rejected" && failure.status === unauthorizedStatus) {
      return { state: "signedOut" };
    }
    return { state: "failed", failure };
  }
  return { state: "ready", prototypes: list.data.prototypes };
}
