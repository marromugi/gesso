import { log, outro } from "@clack/prompts";
import { type LeftOut, push as pushVersion } from "../sync.ts";
import { fromHere, gessoCommand, progress, signedInApi, sourceLabel } from "../ui.ts";

const reasons: Record<LeftOut["reason"], string> = {
  dot: "ドットで始まるもの・node_modules",
  link: "リンク",
  submodule: "サブモジュール",
};

export const push = gessoCommand({
  name: "push",
  description: "リポジトリの最新の commit を次の版として送る",
  args: {
    dir: {
      type: "positional",
      description: "プロトタイプのリポジトリ",
      required: false,
      default: ".",
    },
    force: {
      type: "boolean",
      description: "取り込んだ版より新しい版があっても送る",
      default: false,
    },
  },
  async run(args) {
    const running = progress("commit を送っています");
    const result = await pushVersion(await signedInApi(), fromHere(args.dir), {
      force: args.force,
    }).catch((error: unknown) => {
      running.error("送れませんでした");
      throw error;
    });

    if (result.kind === "unchanged") {
      running.stop(`版 ${result.version} と同じなので、版は作りませんでした`);
    } else {
      running.stop(`版 ${result.version} を作りました`);
      log.message([
        `${sourceLabel(result.source)} から`,
        `${result.files} ファイル（新しく上げた中身 ${result.uploaded}）`,
      ]);
    }
    if (result.leftOut.length > 0) {
      log.info(
        [
          "版に入れないファイル:",
          ...result.leftOut.map((file) => `  ${file.path}（${reasons[file.reason]}）`),
        ].join("\n"),
      );
    }
    if (result.uncommitted) {
      log.warn("commit していない変更があります。送ったのは commit した分だけです");
    }
    outro(result.kind === "unchanged" ? "変わりなし" : `版 ${result.version}`);
  },
});
