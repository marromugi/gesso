import { log, outro } from "@clack/prompts";
import { CliError } from "../cliError.ts";
import { isTemplateName, newFromTemplate, templateNames } from "../template.ts";
import { fromHere, gessoCommand, progress, signedInApi } from "../ui.ts";

export const create = gessoCommand({
  name: "new",
  description: "版のないプロトタイプを、2D か 3D のテンプレートから始める",
  args: {
    id: { type: "positional", description: "プロトタイプの ID", required: true },
    dir: {
      type: "positional",
      description: "始めるフォルダー（空か、まだないフォルダー）",
      required: false,
      default: ".",
    },
    template: {
      type: "string",
      description: `テンプレート（${templateNames.join(" か ")}）`,
      required: true,
    },
  },
  async run(args) {
    if (!isTemplateName(args.template)) {
      throw new CliError(`テンプレートは ${templateNames.join(" か ")} です: ${args.template}`);
    }
    const dir = fromHere(args.dir);
    const running = progress(`${args.template} のテンプレートを置いています`);
    const result = await newFromTemplate(await signedInApi(), args.id, dir, args.template).catch(
      (error: unknown) => {
        running.error("始められませんでした");
        throw error;
      },
    );
    running.stop(`${args.template} のテンプレートを置きました（${result.files} ファイル）`);
    log.message([
      "CLAUDE.md に、決まりとデバッグのしかたがあります",
      "`pnpm gesso serve` で手元で遊べ、`pnpm gesso push` で版 1 になります",
    ]);
    outro(dir);
  },
});
