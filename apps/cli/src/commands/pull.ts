import { log, outro, spinner } from "@clack/prompts";
import { CliError } from "../cliError.ts";
import { pull as pullVersion } from "../sync.ts";
import { fromHere, gessoCommand, signedInApi } from "../ui.ts";

export const pull = gessoCommand({
  name: "pull",
  description: "版を git のリポジトリに取ってきて commit する",
  args: {
    id: { type: "positional", description: "プロトタイプの ID", required: true },
    dir: {
      type: "positional",
      description: "取ってくるフォルダー（空か、このプロトタイプのリポジトリ）",
      required: false,
      default: ".",
    },
    version: { type: "string", description: "版の番号（既定はいちばん新しい版）" },
  },
  async run(args) {
    const dir = fromHere(args.dir);
    const number = args.version === undefined ? undefined : versionNumber(args.version);
    const progress = spinner();
    progress.start("版を取ってきています");
    const result = await pullVersion(await signedInApi(), args.id, dir, { number }).catch(
      (error: unknown) => {
        progress.error("取ってこられませんでした");
        throw error;
      },
    );
    progress.stop(
      result.version === 0 ? "まだ版がありません" : `版 ${result.version} を取ってきました`,
    );

    if (result.initialized) log.info(`${dir} を git のリポジトリにしました`);
    if (result.version === 0) {
      outro("ファイルを置いて commit し、`pnpm gesso push` すると版 1 ができます");
      return;
    }
    log.message([
      `${result.written} ファイル（消したもの ${result.deleted}）`,
      result.committed
        ? `「gesso 版 ${result.version}」として commit しました`
        : "変わったファイルはありません",
    ]);
    outro(dir);
  },
});

function versionNumber(text: string): number {
  const number = Number(text);
  if (!Number.isInteger(number) || number < 1) {
    throw new CliError(`--version は 1 以上の整数です: ${text}`);
  }
  return number;
}
