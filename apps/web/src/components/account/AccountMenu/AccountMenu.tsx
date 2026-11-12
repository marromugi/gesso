import { Button } from "@/components/ui/Button";
import { apiFailureText } from "@/lib/ui/apiFailureText";
import { type Account, useAccountMenu } from "./useAccountMenu";

export function AccountMenu() {
  const { account, signIn, signOut } = useAccountMenu();

  if (account.state === "signedIn") {
    return (
      <div className="flex items-center gap-3">
        <span>{account.user.name}</span>
        <Button type="button" tone="neutral" onClick={signOut.run} disabled={signOut.pending}>
          サインアウト
        </Button>
        {signOut.failure ? (
          <output>サインアウトできませんでした（{apiFailureText(signOut.failure)}）</output>
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
          <output>サインインを始められませんでした（{apiFailureText(signIn.failure)}）</output>
        ) : null}
      </div>
    );
  }

  return <output>{statusText(account)}</output>;
}

function statusText(account: Extract<Account, { state: "checking" | "failed" }>): string {
  if (account.state === "checking") return "サインイン状態を確認しています…";
  return `サインイン状態を確認できません（${apiFailureText(account.failure)}）`;
}
