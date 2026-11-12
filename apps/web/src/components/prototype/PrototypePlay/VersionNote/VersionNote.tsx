import { useId } from "react";
import { Button } from "@/components/ui/Button";
import { control } from "@/components/ui/Field";
import { apiFailureText } from "@/lib/ui/apiFailureText";
import type { ShownNote } from "../usePrototypePlay";
import { useVersionNote } from "./useVersionNote";

/** The longest note a version takes, as the API has it. */
const maxNoteLength = 20_000;

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
        value={editor.draft}
        onChange={(event) => editor.change(event.target.value)}
        rows={6}
        maxLength={maxNoteLength}
        placeholder="遊んで気づいたことを書くと、Claude Code が pnpm gesso notes で読めます"
        className={control()}
      />
      <div className="flex items-center gap-3">
        <Button type="button" onClick={editor.save} disabled={editor.saved || editor.saving}>
          保存する
        </Button>
        <output className="text-sm opacity-70">
          {editor.failure
            ? `保存できませんでした（${apiFailureText(editor.failure)}）`
            : editor.saved
              ? "保存済み"
              : "保存していない変更があります"}
        </output>
      </div>
    </section>
  );
}
