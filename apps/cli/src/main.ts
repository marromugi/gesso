#!/usr/bin/env node
import { setTimeout as sleep } from "node:timers/promises";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { createApiClient, defaultApiUrl } from "./api.ts";
import { CliError } from "./cliError.ts";
import {
  credentialsPath,
  deleteCredentials,
  loadCredentials,
  requireCredentials,
  saveCredentials,
} from "./credentials.ts";
import { login } from "./login.ts";
import { pull, push } from "./sync.ts";

const usage = `gesso: プロトタイプの版を gesso と手元のフォルダーの間でやりとりする

  pnpm gesso login [--api <URL>]   ブラウザで承認してサインインする（既定の API: ${defaultApiUrl}）
  pnpm gesso logout                gesso のセッションを終え、サインインした情報を消す
  pnpm gesso list                  自分のプロトタイプの ID と名前
  pnpm gesso versions <ID>         プロトタイプの版（新しい順）
  pnpm gesso pull <ID> [<dir>] [--version <N>] [--force]
                                   版（既定はいちばん新しい版）を <dir>（既定は .）に取ってくる
  pnpm gesso push [<dir>] [--force]
                                   <dir>（既定は .）のファイルを次の版として送る

pull したフォルダーには .gesso.json ができ、push はそれを見て送り先を決めます。
まだ版のないプロトタイプも、pull で空のフォルダーを用意してから push します。
ドットで始まるファイルとフォルダー、node_modules、リンクは送りません。
フォルダーが取ってきた版より新しい版があると、push は --force なしでは送りません。
`;

async function main(argv: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      api: { type: "string" },
      version: { type: "string" },
      force: { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
  });
  const [command, ...rest] = positionals;
  const path = credentialsPath();
  // `pnpm gesso` runs from the repository's root; folders are meant from where it was typed.
  const here = process.env.INIT_CWD ?? process.cwd();

  if (values.help || command === undefined) {
    process.stdout.write(usage);
    return;
  }
  if (command === "login") {
    const apiUrl = (values.api ?? defaultApiUrl).replace(/\/+$/, "");
    const token = await login(apiUrl, { fetch, say: console.log, wait: (ms) => sleep(ms) });
    // Approved, but the API may still refuse the person (no longer allowed to sign in).
    const me = await createApiClient(apiUrl, token, fetch).me();
    if (me === null)
      throw new CliError("承認されましたが、このアカウントではサインインできません。");
    await saveCredentials(path, { apiUrl, token });
    console.log(`${me.name} としてサインインしました。`);
    return;
  }
  if (command === "logout") {
    const credentials = await loadCredentials(path);
    if (credentials !== null) {
      await createApiClient(credentials.apiUrl, credentials.token, fetch)
        .endSession()
        .catch((error: unknown) => {
          if (!(error instanceof CliError)) throw error;
          console.error(`gesso のセッションを終えられませんでした（${error.message}）。`);
        });
    }
    await deleteCredentials(path);
    console.log("サインインした情報を消しました。");
    return;
  }

  const credentials = await requireCredentials(path);
  const api = createApiClient(credentials.apiUrl, credentials.token, fetch);
  if (command === "list") {
    for (const prototype of await api.listPrototypes()) {
      console.log(`${prototype.id}  ${prototype.name}`);
    }
  } else if (command === "versions") {
    const [prototypeId] = rest;
    if (prototypeId === undefined) throw new CliError("プロトタイプの ID を指定してください。");
    for (const version of await api.listVersions(prototypeId)) {
      console.log(`版 ${version.number}  ${version.createdAt}`);
    }
  } else if (command === "pull") {
    const [prototypeId, folder = "."] = rest;
    if (prototypeId === undefined) throw new CliError("プロトタイプの ID を指定してください。");
    const dir = resolve(here, folder);
    const result = await pull(api, prototypeId, dir, {
      number: values.version === undefined ? undefined : versionNumber(values.version),
      force: values.force,
    });
    if (result.version === 0) {
      console.log(
        `プロトタイプにはまだ版がありません。${dir} にファイルを置いて \`pnpm gesso push\` すると版 1 ができます。`,
      );
    } else {
      console.log(
        `版 ${result.version} を ${dir} に取ってきました（${result.written} ファイル、消したもの ${result.deleted}）。`,
      );
    }
  } else if (command === "push") {
    const [folder = "."] = rest;
    const result = await push(api, resolve(here, folder), { force: values.force });
    if (result.kind === "unchanged") {
      console.log(`版 ${result.version} から変わったファイルがないので、版は作りませんでした。`);
    } else {
      console.log(
        `版 ${result.version} を作りました（${result.files} ファイル、新しく上げた中身 ${result.uploaded}）。`,
      );
    }
  } else {
    throw new CliError(`知らないコマンドです: ${command}\n\n${usage}`);
  }
}

function versionNumber(text: string): number {
  const number = Number(text);
  if (!Number.isInteger(number) || number < 1) {
    throw new CliError(`--version は 1 以上の整数です: ${text}`);
  }
  return number;
}

try {
  await main(process.argv.slice(2));
} catch (error) {
  if (error instanceof CliError) {
    console.error(error.message);
    process.exitCode = 1;
  } else {
    throw error;
  }
}
