import { chmod, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import * as v from "valibot";
import { CliError } from "./cliError.ts";

/** The saved file; one of a format this CLI doesn't know is refused, not read in part. */
const SavedCredentials = v.object({
  format: v.literal(1),
  apiUrl: v.string(),
  token: v.string(),
});

/** What `gesso login` keeps: which API it signed in to, and the session token for it. */
export type Credentials = { apiUrl: string; token: string };

/**
 * Where the credentials live: `$XDG_CONFIG_HOME/gesso/credentials.json`, or under `~/.config`.
 * Readable by the owner alone, since the token signs in as them.
 */
export function credentialsPath(env: NodeJS.ProcessEnv = process.env): string {
  const configHome = env.XDG_CONFIG_HOME || join(homedir(), ".config");
  return join(configHome, "gesso", "credentials.json");
}

/** The saved credentials, or `null` when no one has signed in. */
export async function loadCredentials(path: string): Promise<Credentials | null> {
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch (cause) {
    if (isNotFound(cause)) return null;
    throw new CliError(`${path} を読めません。`, { cause });
  }
  const parsed = v.safeParse(SavedCredentials, JSON.parse(text));
  if (!parsed.success) {
    throw new CliError(`${path} の形が違います。\`pnpm gesso login\` し直してください。`);
  }
  return { apiUrl: parsed.output.apiUrl, token: parsed.output.token };
}

export async function saveCredentials(path: string, credentials: Credentials): Promise<void> {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const text = `${JSON.stringify({ format: 1, ...credentials }, null, 2)}\n`;
  await writeFile(path, text, { mode: 0o600 });
  // `mode` applies only to a file made new; one left from before keeps its own.
  await chmod(path, 0o600);
}

export async function deleteCredentials(path: string): Promise<void> {
  await rm(path, { force: true });
}

/** The saved credentials; throws `CliError` saying to sign in when there are none. */
export async function requireCredentials(path: string): Promise<Credentials> {
  const credentials = await loadCredentials(path);
  if (!credentials) throw new CliError("サインインしていません。`pnpm gesso login` してください。");
  return credentials;
}

function isNotFound(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
