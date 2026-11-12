import { log, outro } from "@clack/prompts";
import { CliError } from "../cliError.ts";
import { isTemplateName, newFromTemplate, templateNames } from "../template.ts";
import { fromHere, gessoCommand, gessoRepository, progress, signedInApi } from "../ui.ts";

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
    // Commands with the paths filled in: CLAUDE.md can't know where gesso is on this machine.
    const gesso = `pnpm --dir ${gessoRepository} gesso`;
    log.message(
      [
        "CLAUDE.md に、決まりとデバッグのしかたがあります。このフォルダーからは:",
        `  ${gesso} serve .   手元で遊ぶ`,
        `  ${gesso} push .    commit したものを版にする`,
        `  ${gesso} notes     遊んだ人のメモを読む`,
      ].join("\n"),
    );
    outro(dir);
  },
});
