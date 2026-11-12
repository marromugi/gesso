import { log, outro } from "@clack/prompts";
import { pull as pullVersion } from "../sync.ts";
import { fromHere, gessoCommand, progress, signedInApi, versionNumber } from "../ui.ts";

export const pull = gessoCommand({
  name: "pull",
  description: "版を取ってきて、git のリポジトリに取り込む（git pull のように）",
  args: {
    id: { type: "positional", description: "プロトタイプの ID", required: true },
    dir: {
      type: "positional",
      description: "取り込むフォルダー（空か、このプロトタイプのリポジトリ）",
      required: false,
      default: ".",
    },
    version: { type: "string", description: "版の番号（既定はいちばん新しい版）" },
  },
  async run(args) {
    const dir = fromHere(args.dir);
    const number = args.version === undefined ? undefined : versionNumber(args.version);
    const running = progress("版を取ってきています");
    const result = await pullVersion(await signedInApi(), args.id, dir, { number }).catch(
      (error: unknown) => {
        running.error("取ってこられませんでした");
        throw error;
      },
    );

    if (result.kind === "upToDate") {
      running.stop(`版 ${result.version} は取り込み済みです`);
      outro("変わりなし");
      return;
    }
    if (result.kind === "noVersion") {
      running.stop("まだ版がありません");
      if (result.initialized) log.info(`${dir} を git のリポジトリにしました`);
      outro("index.html を置いて commit し、`pnpm gesso push` すると版 1 ができます");
      return;
    }
    running.stop(`版 ${result.version} を取ってきました（${result.files} ファイル）`);
    if (result.initialized) log.info(`${dir} を git のリポジトリにしました`);
    if (result.note.trim() !== "") log.info(`版 ${result.version} のメモ:\n${result.note}`);
    if (result.merge.kind === "conflict") {
      log.warn(
        [
          `手元の commit とぶつかりました: ${result.merge.paths.join(", ")}`,
          "git で直して commit してから、`pnpm gesso push` してください",
        ].join("\n"),
      );
      outro(`版 ${result.version} を取り込み中（ぶつかりあり）`);
      // As `git pull` does: a script that looks only at the exit code still sees it isn't done.
      process.exitCode = 1;
      return;
    }
    log.message(
      result.merge.kind === "fastForward"
        ? `「gesso 版 ${result.version}」の commit に進めました`
        : `手元の commit と「gesso 版 ${result.version}」を merge しました`,
    );
    outro(dir);
  },
});
