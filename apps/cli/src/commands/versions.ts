import { log, outro } from "@clack/prompts";
import type { PrototypeVersion } from "../api/client.ts";
import { gessoCommand, signedInApi, sourceLabel } from "../ui.ts";

export const versions = gessoCommand({
  name: "versions",
  description: "プロトタイプの版（新しい順）",
  args: {
    id: { type: "positional", description: "プロトタイプの ID", required: true },
  },
  async run(args) {
    const list = await (await signedInApi()).listVersions(args.id);
    if (list.length === 0) {
      outro("版はまだありません");
      return;
    }
    log.message(list.map(versionLine));
    outro(`${list.length} 個の版`);
  },
});

const createdAtFormat = new Intl.DateTimeFormat("ja-JP", {
  dateStyle: "short",
  timeStyle: "short",
});

/** `版 3  2026/11/12 19:30  main a1b2c3d`: when, and the commit it came from. */
function versionLine(version: PrototypeVersion): string {
  const at = createdAtFormat.format(new Date(version.createdAt));
  const source = version.source === null ? "" : `  ${sourceLabel(version.source)}`;
  return `版 ${version.number}  ${at}${source}`;
}
