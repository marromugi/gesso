import type { PrototypeVersion } from "./api/client.ts";
import { CliError } from "./cliError.ts";

/** A version's note, as `notes` shows it. */
export type VersionNoteView = { number: number; source: PrototypeVersion["source"]; note: string };

/**
 * The notes to show: version `number`'s (even when empty), or, without one, every version that
 * has a note, newest first. Throws `CliError` when there is no version `number`.
 */
export function notesToShow(
  versions: readonly PrototypeVersion[],
  number?: number,
): VersionNoteView[] {
  if (number === undefined) {
    return versions.filter((version) => version.note.trim() !== "").map(view);
  }
  const version = versions.find((candidate) => candidate.number === number);
  if (version === undefined) throw new CliError(`版 ${number} はありません。`);
  return [view(version)];
}

function view({ number, source, note }: PrototypeVersion): VersionNoteView {
  return { number, source, note };
}
