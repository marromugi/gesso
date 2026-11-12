import { realpath, rm, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import type { VersionSource } from "../api/client.ts";
import { CliError } from "../cliError.ts";
import { isVersionPath } from "../workspace.ts";
import { GitError, git, gitBytes } from "./run.ts";

/** Who makes the commits that hold a gesso version, whoever runs the CLI. */
/** What `symbolic-ref` puts before a branch's name. */
const branchPrefix = "refs/heads/";

const gessoIdentity = {
  GIT_AUTHOR_NAME: "gesso",
  GIT_AUTHOR_EMAIL: "gesso@localhost",
  GIT_COMMITTER_NAME: "gesso",
  GIT_COMMITTER_EMAIL: "gesso@localhost",
};

/** An entry of a commit's tree: a file, a link, or a submodule. */
export type TreeEntry = {
  path: string;
  mode: string;
  kind: "file" | "link" | "submodule";
  object: string;
};

/** A file to put in a version's commit. */
export type VersionContent = { path: string; content: Uint8Array };

/** How `mergeIn` brought a version's commit into the branch. */
export type MergeResult =
  | { kind: "fastForward" }
  | { kind: "merged" }
  | { kind: "conflict"; paths: string[] };

/** Where a folder stands with git. */
export type Location =
  | { kind: "root"; repo: Repo }
  | { kind: "inside"; root: string }
  | { kind: "none" };

/** The git repository the prototype's folder is, as the CLI uses it. */
export type Repo = {
  readonly dir: string;
  /** The commit HEAD points at and its branch (`null` when detached); `null` before any commit. */
  head(): Promise<VersionSource | null>;
  /** The entries of `commit`'s tree, by path with `/`. */
  entries(commit: string): Promise<TreeEntry[]>;
  readBlob(object: string): Promise<Uint8Array>;
  /**
   * Whether anything git tracks is changed and not committed; with `untracked`, new files count
   * too (ignored files never do).
   */
  hasUncommittedChanges(options: { untracked: boolean }): Promise<boolean>;
  /** The paths git tracks in the working tree. */
  trackedPaths(): Promise<Set<string>>;
  hasCommit(commit: string): Promise<boolean>;
  /**
   * Makes a commit holding a version, without touching the working tree: `base`'s tree with its
   * version files replaced by `files` (dot files, `node_modules`, links and submodules kept), on
   * top of `base`. Its content is stored as it is, with no line-ending conversion.
   */
  versionCommit(
    files: readonly VersionContent[],
    base: string | null,
    message: string,
  ): Promise<string>;
  /** Brings `commit` into the current branch: fast-forward when it can, a merge when not. */
  mergeIn(commit: string, message: string): Promise<MergeResult>;
  /** Commits `paths` as they are in the working tree, as gesso (no hooks, no signing). */
  commitAsGesso(paths: readonly string[], message: string): Promise<void>;
  /** The repository's `.git` folder (shared by its worktrees), which holds what git doesn't track. */
  gitDir(): Promise<string>;
};

/**
 * Whether `dir` is a repository's top (a worktree counts), inside one, or neither. A folder not
 * made yet is inside a repository when the nearest folder above it that exists is.
 */
export async function locateRepo(dir: string): Promise<Location> {
  const found = await stat(dir).catch(() => null);
  if (found === null) {
    const parent = dirname(dir);
    if (parent === dir) return { kind: "none" };
    const above = await locateRepo(parent);
    if (above.kind === "root") return { kind: "inside", root: above.repo.dir };
    return above;
  }
  if (!found.isDirectory()) throw new CliError(`${dir} はフォルダーではありません。`);
  const top = await git(dir, ["rev-parse", "--show-toplevel"]).catch(() => null);
  if (top === null) return { kind: "none" };
  if ((await realpath(top)) !== (await realpath(dir))) return { kind: "inside", root: top };
  return { kind: "root", repo: repoAt(dir) };
}

/** Makes `dir` (which must exist) a new repository. */
export async function initRepo(dir: string): Promise<Repo> {
  await git(dir, ["init", "--quiet"]);
  return repoAt(dir);
}

function repoAt(dir: string): Repo {
  const run = (args: string[], options?: Parameters<typeof git>[2]) => git(dir, args, options);

  async function entries(commit: string): Promise<TreeEntry[]> {
    const listing = await run(["ls-tree", "-r", "-z", "--full-tree", commit]);
    return listing
      .split("\0")
      .filter((entry) => entry !== "")
      .flatMap((entry): TreeEntry[] => {
        // `<mode> <type> <object>\t<path>`
        const tab = entry.indexOf("\t");
        const [mode = "", type = "", object = ""] = entry.slice(0, tab).split(" ");
        const path = entry.slice(tab + 1);
        if (type === "commit") return [{ path, mode, kind: "submodule", object }];
        if (mode === "120000") return [{ path, mode, kind: "link", object }];
        return [{ path, mode, kind: "file", object }];
      });
  }

  async function head(): Promise<VersionSource | null> {
    const commit = await run(["rev-parse", "--verify", "--quiet", "HEAD^{commit}"]).catch(
      () => null,
    );
    if (commit === null) return null;
    // The full name, shortened here: git's own short form becomes `heads/main` beside a tag `main`.
    const ref = await run(["symbolic-ref", "--quiet", "HEAD"]).catch(() => null);
    const branch = ref?.startsWith(branchPrefix) ? ref.slice(branchPrefix.length) : null;
    return { commit, branch };
  }

  // Shared by every worktree of the repository, so all of them are tied to the same prototype.
  const gitDir = async () => realpath(resolve(dir, await run(["rev-parse", "--git-common-dir"])));

  return {
    dir,
    head,
    gitDir,
    entries,
    async readBlob(object) {
      return new Uint8Array(await gitBytes(dir, ["cat-file", "blob", object]));
    },
    async hasUncommittedChanges({ untracked }) {
      const files = untracked ? "--untracked-files=all" : "--untracked-files=no";
      return (await run(["status", "--porcelain=v1", "-z", files])) !== "";
    },
    async trackedPaths() {
      const listing = await run(["ls-files", "-z"]);
      return new Set(listing.split("\0").filter((path) => path !== ""));
    },
    async hasCommit(commit) {
      return run(["cat-file", "-e", `${commit}^{commit}`]).then(
        () => true,
        () => false,
      );
    },
    async versionCommit(files, base, message) {
      const env = { GIT_INDEX_FILE: join(await gitDir(), "gesso-index") };
      try {
        await run(base === null ? ["read-tree", "--empty"] : ["read-tree", base], { env });
        const kept = base === null ? [] : await entries(base);
        const modes = new Map(kept.map((entry) => [entry.path, entry.mode]));
        const removed = kept.filter((entry) => replacedBy(entry, files)).map((entry) => entry.path);
        if (removed.length > 0) {
          await run(["update-index", "--force-remove", "-z", "--stdin"], {
            env,
            input: `${removed.join("\0")}\0`,
          });
        }
        const lines: string[] = [];
        for (const file of files) {
          const blob = await run(["hash-object", "-w", "--no-filters", "--stdin"], {
            input: file.content,
          });
          const mode = modes.get(file.path) === "100755" ? "100755" : "100644";
          lines.push(`${mode} ${blob}\t${file.path}`);
        }
        if (lines.length > 0) {
          await run(["update-index", "--add", "-z", "--index-info"], {
            env,
            input: `${lines.join("\0")}\0`,
          });
        }
        const tree = await run(["write-tree"], { env });
        const parent = base === null ? [] : ["-p", base];
        return await run(["commit-tree", tree, ...parent, "--no-gpg-sign", "-m", message], {
          env: gessoIdentity,
        });
      } finally {
        await rm(env.GIT_INDEX_FILE, { force: true });
      }
    },
    async commitAsGesso(paths, message) {
      // The person's ignore rules and hooks are theirs, not for what gesso commits.
      await run(["add", "--force", "--", ...paths]);
      await run(
        [
          "-c",
          "core.hooksPath=/dev/null",
          "commit",
          "--quiet",
          "--no-verify",
          "--no-gpg-sign",
          "-m",
          message,
          "--",
          ...paths,
        ],
        { env: gessoIdentity },
      );
    },
    async mergeIn(commit, message) {
      const current = await head();
      const fastForward =
        current === null ||
        (await run(["merge-base", "--is-ancestor", current.commit, commit]).then(
          () => true,
          () => false,
        ));
      try {
        if (fastForward) {
          await run(["merge", "--ff-only", "--quiet", commit]);
          return { kind: "fastForward" };
        }
        await run(["merge", "--no-ff", "--no-edit", "--quiet", "-m", message, commit]);
        return { kind: "merged" };
      } catch (error) {
        if (!(error instanceof GitError)) throw error;
        const conflicted = await run(["diff", "--name-only", "--diff-filter=U", "-z"]);
        const paths = conflicted.split("\0").filter((path) => path !== "");
        if (paths.length > 0) return { kind: "conflict", paths };
        throw new CliError(`git が取り込めませんでした: ${error.stderr.trim()}`, { cause: error });
      }
    },
  };
}

/**
 * Whether a version's files take the place of `entry`: a version file of `base`, or anything at,
 * inside or above a path the new version has a file at.
 */
function replacedBy(entry: TreeEntry, files: readonly VersionContent[]): boolean {
  if (entry.kind === "file" && isVersionPath(entry.path)) return true;
  return files.some(
    (file) =>
      file.path === entry.path ||
      file.path.startsWith(`${entry.path}/`) ||
      entry.path.startsWith(`${file.path}/`),
  );
}
