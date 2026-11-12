import { resolve } from "node:path";
import { cancel, intro, log, spinner } from "@clack/prompts";
import { type ArgsDef, type CommandDef, type ParsedArgs, defineCommand } from "citty";
import { createApiClient } from "./api/client.ts";
import { CliError } from "./cliError.ts";
import { credentialsPath, requireCredentials } from "./credentials.ts";

/**
 * A subcommand of `gesso`: opens with its name and, when `run` fails with `CliError`, closes with
 * the message, which says what to do, and exit code 1. Any other error is a bug and is thrown.
 */
export function gessoCommand<T extends ArgsDef>(definition: {
  name: string;
  description: string;
  args?: T;
  run: (args: ParsedArgs<T>) => Promise<void>;
}): CommandDef<T> {
  return defineCommand({
    meta: { name: definition.name, description: definition.description },
    args: definition.args,
    async run({ args }) {
      intro(`gesso ${definition.name}`);
      try {
        await definition.run(args);
      } catch (error) {
        if (!(error instanceof CliError)) throw error;
        cancel(error.message);
        process.exitCode = 1;
      }
    },
  });
}

/** Something that takes a while: shown as it runs, then how it ended. */
export type Progress = {
  stop(message: string): void;
  error(message: string): void;
};

/**
 * Starts showing `message` while something runs: a spinner on a terminal, and one line when the
 * output is read by something else (a spinner's redrawing would only add noise there).
 */
export function progress(message: string): Progress {
  if (process.stdout.isTTY) {
    const shown = spinner();
    shown.start(message);
    return { stop: (end) => shown.stop(end), error: (end) => shown.error(end) };
  }
  log.step(message);
  return { stop: (end) => log.success(end), error: (end) => log.error(end) };
}

/** The API, as the person who signed in with `gesso login`. */
export async function signedInApi() {
  const credentials = await requireCredentials(credentialsPath());
  return createApiClient({ ...credentials, fetch });
}

/**
 * `folder` as meant from where `pnpm gesso` was typed: pnpm runs it from the repository's root
 * and keeps the original place in `INIT_CWD`.
 */
export function fromHere(folder: string): string {
  return resolve(process.env.INIT_CWD ?? process.cwd(), folder);
}

/** The first 7 characters of a commit, as git shows it. */
export function shortCommit(commit: string): string {
  return commit.slice(0, 7);
}
