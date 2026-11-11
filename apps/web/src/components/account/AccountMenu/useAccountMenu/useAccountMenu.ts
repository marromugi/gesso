import { type UseQueryResult, useMutation, useQueryClient } from "@tanstack/react-query";
import { type ApiError, type ApiFailure, type Me, type User, useGetMe } from "@/lib/api";
import { signOut, startGitHubSignIn } from "@/lib/auth";

export type Account =
  | { state: "checking" }
  | { state: "failed"; failure: ApiFailure }
  | { state: "signedOut" }
  | { state: "signedIn"; user: User };

export type AccountAction = {
  run: () => void;
  pending: boolean;
  failure: ApiFailure | null;
};

export type AccountMenu = { account: Account; signIn: AccountAction; signOut: AccountAction };

/** Who is signed in, with the actions to sign in with GitHub and to sign out. */
export function useAccountMenu(): AccountMenu {
  const queryClient = useQueryClient();
  const me = useGetMe();
  const signInMutation = useMutation<void, ApiError>({
    // Comes back to the page it started from.
    mutationFn: () => startGitHubSignIn(`${window.location.pathname}${window.location.search}`),
  });
  const signOutMutation = useMutation<void, ApiError>({
    mutationFn: signOut,
    // Everything fetched belonged to the session that ended, so all of it is dropped and fetched again.
    onSuccess: () => queryClient.resetQueries(),
  });

  return {
    account: toAccount(me),
    signIn: {
      run: () => signInMutation.mutate(),
      pending: signInMutation.isPending,
      failure: signInMutation.error?.failure ?? null,
    },
    signOut: {
      run: () => signOutMutation.mutate(),
      pending: signOutMutation.isPending,
      failure: signOutMutation.error?.failure ?? null,
    },
  };
}

function toAccount(me: UseQueryResult<Me, ApiError>): Account {
  if (me.isPending) return { state: "checking" };
  if (me.isError) return { state: "failed", failure: me.error.failure };
  const { user } = me.data;
  return user ? { state: "signedIn", user } : { state: "signedOut" };
}
