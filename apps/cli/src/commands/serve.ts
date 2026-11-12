import { log } from "@clack/prompts";
import { CliError } from "../cliError.ts";
import { serveFolder } from "../serve.ts";
import { fromHere, gessoCommand } from "../ui.ts";

/** Where `serve` listens unless told otherwise. */
const defaultPort = 4173;

export const serve = gessoCommand({
  name: "serve",
  description: "プロトタイプのフォルダーを手元で配る（止めるまで）",
  args: {
    dir: {
      type: "positional",
      description: "配るフォルダー",
      required: false,
      default: ".",
    },
    port: { type: "string", description: `ポート（既定は ${defaultPort}）` },
  },
  async run(args) {
    const port = args.port === undefined ? defaultPort : Number(args.port);
    if (!Number.isInteger(port) || port <= 0 || port > 65_535) {
      throw new CliError(`--port は 1〜65535 の整数です: ${args.port}`);
    }
    const dir = fromHere(args.dir);
    await serveFolder(dir, port).catch((cause: unknown) => {
      throw new CliError(`${port} 番で配れませんでした（使われているかもしれません）。`, { cause });
    });
    log.success(`http://localhost:${port}/ で ${dir} を配っています`);
    log.message(
      "?seed=1&paused を付けると、決まったシードで止まった状態から始まります。止めるには Ctrl+C",
    );
  },
});
