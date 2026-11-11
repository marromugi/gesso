import type { ApiFailure } from "@/lib/api";
import { type Account, useAccountMenu } from "./useAccountMenu";

export function AccountMenu() {
  const { account, signIn, signOut } = useAccountMenu();

  if (account.state === "signedIn") {
    return (
      <div>
        <span>{account.user.name}</span>
        <button type="button" onClick={signOut.run} disabled={signOut.pending}>
          サインアウト
        </button>
        {signOut.failure ? (
          <output>サインアウトできませんでした（{failureText(signOut.failure)}）</output>
        ) : null}
      </div>
    );
  }

  if (account.state === "signedOut") {
    return (
      <div>
        <button type="button" onClick={signIn.run} disabled={signIn.pending}>
          GitHub でサインイン
        </button>
        {signIn.failure ? (
          <output>サインインを始められませんでした（{failureText(signIn.failure)}）</output>
        ) : null}
      </div>
    );
  }

  return <output>{statusText(account)}</output>;
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
