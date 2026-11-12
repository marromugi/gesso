import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type ApiError, type ApiFailure, useGetMe } from "@/lib/api";
import {
  type DeviceStatus,
  approveDeviceSignIn,
  denyDeviceSignIn,
  readDeviceSignIn,
} from "@/lib/auth";

/** HTTP status the API answers with for a code that doesn't exist or has expired. */
const badRequestStatus = 400;

/**
 * Where approving the CLI's sign-in stands.
 * - `noCode`: the page was opened without the code the CLI shows.
 * - `signedOut`: approving needs the person signed in.
 * - `unknownCode`: the code doesn't exist or has expired.
 * - `pending`: waiting for the person to approve or deny; `answering` while that is sent.
 */
export type DeviceApproval =
  | { state: "noCode" }
  | { state: "loading" }
  | { state: "signedOut" }
  | { state: "failed"; failure: ApiFailure }
  | { state: "unknownCode" }
  | {
      state: "pending";
      userCode: string;
      approve: () => void;
      deny: () => void;
      answering: boolean;
      failure: ApiFailure | null;
    }
  | { state: "approved" }
  | { state: "denied" };

/** Approving or denying the CLI sign-in that showed `userCode`, as the signed-in person. */
export function useDeviceApproval(userCode: string | undefined): DeviceApproval {
  const queryClient = useQueryClient();
  const me = useGetMe();
  const signedIn = me.data?.user != null;
  const queryKey = ["deviceSignIn", userCode] as const;
  const status = useQuery<DeviceStatus, ApiError>({
    queryKey,
    queryFn: () => readDeviceSignIn(userCode ?? ""),
    // Reading it ties the code to whoever is signed in, so it waits until someone is.
    enabled: userCode !== undefined && signedIn,
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
  });
  const answer = useMutation<DeviceStatus, ApiError, DeviceStatus>({
    mutationFn: async (next) => {
      await (next === "approved" ? approveDeviceSignIn : denyDeviceSignIn)(userCode ?? "");
      return next;
    },
    onSuccess: (next) => queryClient.setQueryData(queryKey, next),
  });

  if (userCode === undefined) return { state: "noCode" };
  if (me.isPending) return { state: "loading" };
  if (me.isError) return { state: "failed", failure: me.error.failure };
  if (!signedIn) return { state: "signedOut" };
  if (status.isPending) return { state: "loading" };
  if (status.isError) {
    const { failure } = status.error;
    if (failure.kind === "rejected" && failure.status === badRequestStatus) {
      return { state: "unknownCode" };
    }
    return { state: "failed", failure };
  }
  if (status.data === "approved") return { state: "approved" };
  if (status.data === "denied") return { state: "denied" };
  return {
    state: "pending",
    userCode,
    approve: () => answer.mutate("approved"),
    deny: () => answer.mutate("denied"),
    answering: answer.isPending,
    failure: answer.error?.failure ?? null,
  };
}
