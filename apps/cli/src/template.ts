import { lstat, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, relative, sep } from "node:path";
import type { ApiClient } from "./api/client.ts";
import { CliError } from "./cliError.ts";
import { locateRepo } from "./git/repo.ts";
import { pull } from "./sync.ts";

/** The templates a prototype starts from: the folder in `templates/` each one is in. */
export const templateNames = ["2d", "3d"] as const;

export type TemplateName = (typeof templateNames)[number];

/** Where the templates are: one folder each, and `shared` for what every one has. */
const templatesDir = join(import.meta.dirname, "..", "templates");

export type TemplateFile = { path: string; content: Uint8Array };

/** The files of template `name`, by path with `/`: the shared ones, then its own over them. */
export async function templateFiles(name: TemplateName): Promise<TemplateFile[]> {
  const files = new Map<string, Uint8Array>();
  for (const folder of ["shared", name]) {
    const root = join(templatesDir, folder);
    for (const entry of await readdir(root, { recursive: true, withFileTypes: true })) {
      if (!entry.isFile()) continue;
      const full = join(entry.parentPath, entry.name);
      files.set(relative(root, full).split(sep).join("/"), new Uint8Array(await readFile(full)));
    }
  }
  return [...files]
    .map(([path, content]) => ({ path, content }))
    .toSorted((a, b) => (a.path < b.path ? -1 : 1));
}

/**
 * Starts the prototype `prototypeId`, which must have no version yet, in `dir` from template
 * `name`: the folder is made its repository as `pull` makes it, and the template's files are
 * committed as "gesso テンプレート <name>". Nothing is written over a file already there.
 */
export async function newFromTemplate(
  api: ApiClient,
  prototypeId: string,
  dir: string,
  name: TemplateName,
): Promise<{ files: number }> {
  if ((await api.listVersions(prototypeId)).length > 0) {
    throw new CliError(
      `プロトタイプ ${prototypeId} にはもう版があります。テンプレートからは、版のないプロトタイプだけを始められます。\`pnpm gesso pull\` で取り込んでください。`,
    );
  }
  const files = await templateFiles(name);
  const taken: string[] = [];
  for (const file of files) {
    if ((await lstat(join(dir, file.path)).catch(() => null)) !== null) taken.push(file.path);
  }
  if (taken.length > 0) {
    throw new CliError(`テンプレートと同じ場所に、もうファイルがあります: ${taken.join(", ")}`);
  }

  await pull(api, prototypeId, dir);
  const location = await locateRepo(dir);
  if (location.kind !== "root") throw new Error(`${dir} should be a repository after pull`);
  for (const file of files) {
    await mkdir(dirname(join(dir, file.path)), { recursive: true });
    await writeFile(join(dir, file.path), file.content);
  }
  await location.repo.commitAsGesso(
    files.map((file) => file.path),
    `gesso テンプレート ${name}`,
  );
  return { files: files.length };
}

export function isTemplateName(name: string): name is TemplateName {
  return (templateNames as readonly string[]).includes(name);
}
