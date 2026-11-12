import { log, outro } from "@clack/prompts";
import { CliError } from "../cliError.ts";
import { locateRepo } from "../git/repo.ts";
import { notesToShow } from "../notes.ts";
import { fromHere, gessoCommand, signedInApi, sourceLabel, versionNumber } from "../ui.ts";
import { readManifest } from "../workspace.ts";

export const notes = gessoCommand({
  name: "notes",
  description: "版のメモ（遊んで気づいたこと）を読む",
  args: {
    id: {
      type: "positional",
      description: "プロトタイプの ID（既定は、今いるリポジトリのプロトタイプ）",
      required: false,
    },
    version: { type: "string", description: "この版のメモだけを読む（既定はメモのある版すべて）" },
  },
  async run(args) {
    const prototypeId = args.id ?? (await prototypeHere());
    const number = args.version === undefined ? undefined : versionNumber(args.version);
    const shown = notesToShow(await (await signedInApi()).listVersions(prototypeId), number);
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

/** The prototype the repository the command was typed in is tied to. */
async function prototypeHere(): Promise<string> {
  const location = await locateRepo(fromHere("."));
  const manifest =
    location.kind === "root" ? await readManifest(await location.repo.gitDir()) : null;
  if (manifest === null) {
    throw new CliError(
      "プロトタイプの ID を指定するか、プロトタイプのリポジトリで動かしてください。",
    );
  }
  return manifest.prototypeId;
}
