import { log, outro } from "@clack/prompts";
import { notesToShow } from "../notes.ts";
import { gessoCommand, signedInApi, sourceLabel, versionNumber } from "../ui.ts";

export const notes = gessoCommand({
  name: "notes",
  description: "版のメモ（遊んで気づいたこと）を読む",
  args: {
    id: { type: "positional", description: "プロトタイプの ID", required: true },
    version: { type: "string", description: "この版のメモだけを読む（既定はメモのある版すべて）" },
  },
  async run(args) {
    const number = args.version === undefined ? undefined : versionNumber(args.version);
    const shown = notesToShow(await (await signedInApi()).listVersions(args.id), number);
    if (shown.length === 0) {
      outro("メモのある版はありません");
      return;
    }
    for (const version of shown) {
      const from = version.source === null ? "" : `（${sourceLabel(version.source)}）`;
      log.step(`版 ${version.number}${from}`);
      log.message(version.note === "" ? "（メモなし）" : version.note);
    }
    outro(`${shown.length} 個の版のメモ`);
  },
});
