import { useId } from "react";
import { Button } from "@/components/ui/Button";
import { control } from "@/components/ui/Field";
import { apiFailureText } from "@/lib/ui/apiFailureText";
import type { ShownNote } from "../usePrototypePlay";
import { type NoteStatus, useVersionNote } from "./useVersionNote";

/**
 * The note on the version being played: what the person noticed, for Claude Code to read with
 * `pnpm gesso notes`. Give it a `key` per version, so another version starts from its own note.
 */
export function VersionNote({ prototypeId, shown }: { prototypeId: string; shown: ShownNote }) {
  const id = useId();
  const editor = useVersionNote(prototypeId, shown);

  return (
    <section className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-semibold">
        版 {shown.number} のメモ
      </label>
      <textarea
        id={id}
        value={editor.text}
        onChange={(event) => editor.change(event.target.value)}
        rows={6}
        placeholder="遊んで気づいたことを書くと、Claude Code が pnpm gesso notes で読めます"
        className={control()}
      />
      <div className="flex items-center gap-3">
        <Button
          type="button"
          onClick={editor.save}
          disabled={editor.status.kind === "saved" || editor.saving}
        >
          保存する
        </Button>
        <output className="text-sm opacity-70">{statusText(editor.status)}</output>
      </div>
    </section>
  );
}

function statusText(status: NoteStatus): string {
  if (status.kind === "saved") return "保存済み";
  if (status.kind === "edited") return "保存していない変更があります";
  if (status.kind === "changedElsewhere") {
    return "このメモはほかの場所で書き換えられました。保存すると、それを上書きします";
  }
  return `保存できませんでした（${apiFailureText(status.failure)}）`;
}
