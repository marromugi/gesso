import { log, outro, spinner } from "@clack/prompts";
import { push as pushVersion } from "../sync.ts";
import { fromHere, gessoCommand, shortCommit, signedInApi } from "../ui.ts";

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
      description: "取ってきた版より新しい版があっても送る",
      default: false,
    },
  },
  async run(args) {
    const progress = spinner();
    progress.start("commit を送っています");
    const result = await pushVersion(await signedInApi(), fromHere(args.dir), {
      force: args.force,
    }).catch((error: unknown) => {
      progress.error("送れませんでした");
      throw error;
    });

    if (result.kind === "unchanged") {
      progress.stop(`版 ${result.version} と同じなので、版は作りませんでした`);
    } else {
      progress.stop(`版 ${result.version} を作りました`);
      const { branch, commit } = result.source;
      log.message([
        `${branch ?? "(ブランチなし)"} ${shortCommit(commit)} から`,
        `${result.files} ファイル（新しく上げた中身 ${result.uploaded}）`,
      ]);
      if (result.leftOut.length > 0) {
        log.info(
          `版に入れないファイル（ドットで始まるもの・node_modules）: ${result.leftOut.join(", ")}`,
        );
      }
    }
    if (result.uncommitted) {
      log.warn("commit していない変更があります。送ったのは commit した分だけです");
    }
    outro(result.kind === "unchanged" ? "変わりなし" : `版 ${result.version}`);
  },
});
