import { log, outro } from "@clack/prompts";
import { createApiClient } from "../api/client.ts";
import { CliError } from "../cliError.ts";
import { credentialsPath, deleteCredentials, loadCredentials } from "../credentials.ts";
import { gessoCommand } from "../ui.ts";

export const logout = gessoCommand({
  name: "logout",
  description: "gesso のセッションを終え、サインインした情報を消す",
  async run() {
    const path = credentialsPath();
    const credentials = await loadCredentials(path);
    if (credentials !== null) {
      await createApiClient({ ...credentials, fetch })
        .endSession()
        .catch((error: unknown) => {
          if (!(error instanceof CliError)) throw error;
          log.warn(`gesso のセッションを終えられませんでした（${error.message}）`);
        });
    }
    await deleteCredentials(path);
    outro("サインインした情報を消しました");
  },
});
