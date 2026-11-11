import { Button } from "@/components/ui/Button";
import type { ApiFailure } from "@/lib/api";
import { type Account, useAccountMenu } from "./useAccountMenu";

/** Better Auth's code for a sign-in the API refused: the GitHub user is not allowed. */
const notAllowedCode = "unable_to_get_user_info";

export type AccountMenuProps = {
  /** Better Auth's error code when the last sign-in failed and came back to this page. */
  signInError?: string;
};

export function AccountMenu({ signInError }: AccountMenuProps) {
  const { account, signIn, signOut } = useAccountMenu();

  if (account.state === "signedIn") {
    return (
      <div className="flex items-center gap-3">
        <span>{account.user.name}</span>
        <Button type="button" tone="neutral" onClick={signOut.run} disabled={signOut.pending}>
          サインアウト
        </Button>
        {signOut.failure ? (
          <output>サインアウトできませんでした（{failureText(signOut.failure)}）</output>
        ) : null}
      </div>
    );
  }

  if (account.state === "signedOut") {
    return (
      <div className="flex items-center gap-3">
        <Button type="button" onClick={signIn.run} disabled={signIn.pending}>
          GitHub でサインイン
        </Button>
        {signIn.failure ? (
          <output>サインインを始められませんでした（{failureText(signIn.failure)}）</output>
        ) : signInError === undefined ? null : (
          <output role="alert">{signInErrorText(signInError)}</output>
        )}
      </div>
    );
  }

  return <output>{statusText(account)}</output>;
}

function signInErrorText(code: string): string {
  if (code === notAllowedCode) return "この GitHub アカウントではサインインできません";
  return "サインインできませんでした";
}

function statusText(account: Extract<Account, { state: "checking" | "failed" }>): string {
  if (account.state === "checking") return "サインイン状態を確認しています…";
  return `サインイン状態を確認できません（${failureText(account.failure)}）`;
}

function failureText(failure: ApiFailure): string {
  if (failure.kind === "unreachable") return "API に接続できません";
  if (failure.kind === "unreadable") return "API の応答を読み取れません";
  return `API がエラーを返しました: ${failure.status}`;
}
