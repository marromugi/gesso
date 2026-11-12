import { log, outro } from "@clack/prompts";
import { gessoCommand, signedInApi } from "../ui.ts";

export const list = gessoCommand({
  name: "list",
  description: "自分のプロトタイプの ID と名前",
  async run() {
    const prototypes = await (await signedInApi()).listPrototypes();
    if (prototypes.length === 0) {
      outro("プロトタイプはまだありません");
      return;
    }
    log.message(prototypes.map((prototype) => `${prototype.id}  ${prototype.name}`));
    outro(`${prototypes.length} 個のプロトタイプ`);
  },
});
