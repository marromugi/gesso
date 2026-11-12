import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { apiFailureText } from "@/lib/ui/apiFailureText";
import { type DeviceApproval as Approval, useDeviceApproval } from "./useDeviceApproval";

/** Where the person lets the gesso CLI sign in as them, after checking the code it shows. */
export function DeviceApproval({ userCode }: { userCode?: string }) {
  const approval = useDeviceApproval(userCode);

  return (
    <section className="mx-auto flex max-w-md flex-col gap-4">
      <h2 className="text-lg font-semibold">CLI のサインイン</h2>
      {content(approval)}
    </section>
  );
}

const login = <code className="font-mono">gesso login</code>;

function content(approval: Approval): ReactNode {
  if (approval.state === "noCode") {
    return <p>コードがありません。{login} が表示した URL を開いてください。</p>;
  }
  if (approval.state === "loading") return <output>確認しています…</output>;
  if (approval.state === "signedOut") {
    return <p>サインインすると、CLI のサインインを承認できます。</p>;
  }
  if (approval.state === "failed") {
    return <output>確認できません（{apiFailureText(approval.failure)}）</output>;
  }
  if (approval.state === "unknownCode") {
    return (
      <p>このコードは使えません。期限が切れたか、間違っています。もう一度 {login} してください。</p>
    );
  }
  if (approval.state === "approved") return <p>承認しました。ターミナルに戻ってください。</p>;
  if (approval.state === "denied") return <p>拒否しました。この CLI はサインインできません。</p>;

  return (
    <>
      <p>ターミナルに出ているコードと同じか確かめてから、承認してください。</p>
      <p className="rounded-container border border-edge bg-surface-raised text-center font-mono text-2xl tracking-widest container-p-4">
        {approval.userCode}
      </p>
      <div className="flex gap-3">
        <Button type="button" onClick={approval.approve} disabled={approval.answering}>
          承認する
        </Button>
        <Button type="button" tone="neutral" onClick={approval.deny} disabled={approval.answering}>
          拒否する
        </Button>
      </div>
      {approval.failure ? (
        <output>送れませんでした（{apiFailureText(approval.failure)}）</output>
      ) : null}
    </>
  );
}
