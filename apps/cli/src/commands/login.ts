import { setTimeout as sleep } from "node:timers/promises";
import { note, outro, spinner } from "@clack/prompts";
import { createApiClient } from "../api/client.ts";
import { deviceLogin } from "../api/deviceLogin.ts";
import { CliError } from "../cliError.ts";
import { credentialsPath, saveCredentials } from "../credentials.ts";
import { gessoCommand } from "../ui.ts";

/** Where the CLI signs in when no `--api` is given: the web app's origin plus `/api`. */
const defaultApiUrl = "https://gesso-web.marrromugi-dev.workers.dev/api";

export const login = gessoCommand({
  name: "login",
  description: "ブラウザで承認してサインインする",
  args: {
    api: {
      type: "string",
      description: `API の URL（手元の開発サーバーなら http://localhost:5173/api）`,
      default: defaultApiUrl,
    },
  },
  async run(args) {
    const apiUrl = args.api.replace(/\/+$/, "");
    const waiting = spinner();
    const token = await deviceLogin(apiUrl, {
      fetch,
      show({ url, userCode }) {
        note(
          [
            `URL     ${url}`,
            `コード  ${userCode}`,
            "",
            "gesso にサインインしたブラウザで URL を開き、",
            "コードが同じか確かめてから承認してください。",
          ].join("\n"),
          "ブラウザで承認",
        );
        waiting.start("承認を待っています");
      },
      wait: (ms) => sleep(ms),
    }).catch((error: unknown) => {
      waiting.error("サインインできませんでした");
      throw error;
    });
    waiting.stop("承認されました");

    // Approved, but the API may still refuse the person (no longer allowed to sign in).
    const me = await createApiClient({ apiUrl, token, fetch }).me();
    if (me === null)
      throw new CliError("承認されましたが、このアカウントではサインインできません。");
    await saveCredentials(credentialsPath(), { apiUrl, token });
    outro(`${me.name} としてサインインしました`);
  },
});
