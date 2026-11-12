import { stat } from "node:fs/promises";
import { CheckRepoActions, type SimpleGit, simpleGit } from "simple-git";
import type { VersionSource } from "../api/client.ts";

/** File modes `git ls-tree` gives regular files; links (120000) and submodules aren't files. */
const fileModes: ReadonlySet<string> = new Set(["100644", "100755"]);

/** Who commits for the CLI when git has no identity set up. */
const fallbackIdentity = ["user.name=gesso", "user.email=gesso@localhost"];

/** A file of a commit: where it sits, and how to read it. */
export type CommittedFile = { path: string; read: () => Promise<Uint8Array> };

/** The git repository the prototype's folder is, as the CLI uses it. */
export type Repo = {
  /** The commit HEAD points at, and its branch; `null` before the first commit. */
  head(): Promise<VersionSource | null>;
  /** The files of HEAD's commit, by path with `/`. Links and submodules are left out. */
  committedFiles(): Promise<CommittedFile[]>;
  /** Whether anything is changed or added and not committed (ignored files don't count). */
  hasUncommittedChanges(): Promise<boolean>;
  /** Commits every change in the folder; `false` when there was nothing to commit. */
  commitAll(message: string): Promise<boolean>;
  /** The `.git` folder, which holds what git doesn't track. */
  gitDir(): Promise<string>;
};

/** The repository whose root is `dir`, or `null` when `dir` isn't one's root (or isn't there). */
export async function openRepo(dir: string): Promise<Repo | null> {
  const isFolder = await stat(dir).then(
    (found) => found.isDirectory(),
    () => false,
  );
  if (!isFolder) return null;
  const git = simpleGit({ baseDir: dir });
  const isRoot = await git.checkIsRepo(CheckRepoActions.IS_REPO_ROOT).catch(() => false);
  return isRoot ? repoAt(git) : null;
}

/** Makes `dir` (which must exist) a new repository. */
export async function initRepo(dir: string): Promise<Repo> {
  const git = simpleGit({ baseDir: dir });
  await git.init();
  return repoAt(git);
}

function repoAt(git: SimpleGit): Repo {
  return {
    async head() {
      const commit = await git.revparse(["--verify", "--quiet", "HEAD"]).catch(() => "");
      if (commit === "") return null;
      const branch = await git.revparse(["--abbrev-ref", "HEAD"]);
      return { commit: commit.trim(), branch: branch.trim() === "HEAD" ? null : branch.trim() };
    },
    async committedFiles() {
      const listing = await git.raw(["ls-tree", "-r", "-z", "--full-tree", "HEAD"]);
      return listing
        .split("\0")
        .filter((entry) => entry !== "")
        .flatMap((entry) => {
          // `<mode> <type> <object>\t<path>`
          const tab = entry.indexOf("\t");
          const [mode = "", type = "", object = ""] = entry.slice(0, tab).split(" ");
          if (type !== "blob" || !fileModes.has(mode)) return [];
          const read = async () => new Uint8Array(await git.binaryCatFile(["blob", object]));
          return [{ path: entry.slice(tab + 1), read }];
        });
    },
    async hasUncommittedChanges() {
      return !(await git.status()).isClean();
    },
    async commitAll(message) {
      await git.add(["--all"]);
      if ((await git.status()).isClean()) return false;
      const identity = (await git.getConfig("user.email")).value;
      const committer = identity
        ? git
        : simpleGit({ baseDir: await root(git), config: fallbackIdentity });
      await committer.commit(message);
      return true;
    },
    async gitDir() {
      return (await git.revparse(["--absolute-git-dir"])).trim();
    },
  };
}

async function root(git: SimpleGit): Promise<string> {
  return (await git.revparse(["--show-toplevel"])).trim();
}
