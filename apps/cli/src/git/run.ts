import { spawn } from "node:child_process";

/** Git failed: the command, and what it said. */
export class GitError extends Error {
  override name = "GitError";
  readonly stderr: string;

  constructor(args: readonly string[], stderr: string, exitCode: number | null) {
    super(`git ${args.join(" ")} failed (${exitCode}): ${stderr.trim()}`);
    this.stderr = stderr;
  }
}

export type GitOptions = {
  /** Sent to git's standard input. */
  input?: string | Uint8Array;
  /** Added to the environment the CLI runs in, which git otherwise inherits as it is. */
  env?: Record<string, string>;
};

/** Runs `git <args>` in `cwd` and gives what it wrote to standard output, as bytes. */
export function gitBytes(cwd: string, args: string[], options: GitOptions = {}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = spawn("git", args, {
      cwd,
      env: { ...process.env, ...options.env },
      stdio: ["pipe", "pipe", "pipe"],
    });
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => out.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => err.push(chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(Buffer.concat(out));
      else reject(new GitError(args, Buffer.concat(err).toString("utf8"), code));
    });
    child.stdin.end(options.input);
  });
}

/** Runs `git <args>` in `cwd` and gives its standard output as text, without the last newline. */
export async function git(cwd: string, args: string[], options: GitOptions = {}): Promise<string> {
  return (await gitBytes(cwd, args, options)).toString("utf8").replace(/\n$/, "");
}
