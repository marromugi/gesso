import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  type ApiFailure,
  type PrototypeVersionList,
  getListPrototypeVersionsQueryKey,
  useWritePrototypeVersionNote,
} from "@/lib/api";
import type { ShownNote } from "../../usePrototypePlay";

/**
 * Where the note stands.
 * - `saved`: what is shown is the version's saved note.
 * - `edited`: the person changed it and hasn't saved.
 * - `changedElsewhere`: edited, while the saved note changed somewhere else (another tab,
 *   another person); saving overwrites that.
 * - `failed`: the last save didn't go through.
 */
export type NoteStatus =
  | { kind: "saved" }
  | { kind: "edited" }
  | { kind: "changedElsewhere" }
  | { kind: "failed"; failure: ApiFailure };

export type VersionNoteEditor = {
  text: string;
  change: (text: string) => void;
  save: () => void;
  saving: boolean;
  status: NoteStatus;
};

/** What the person typed, and the saved note it started from. */
type Edit = { text: string; from: string };

/**
 * Editing the note of the version `shown`. Until the person types, it shows the saved note and
 * follows it as it changes (a save from another tab, say). Saving replaces the note and puts it
 * in the version list already fetched, which `shown` comes from.
 */
export function useVersionNote(prototypeId: string, shown: ShownNote): VersionNoteEditor {
  const queryClient = useQueryClient();
  const [edit, setEdit] = useState<Edit | null>(null);
  const write = useWritePrototypeVersionNote({
    mutation: {
      onSuccess: async (written, { number }) => {
        const queryKey = getListPrototypeVersionsQueryKey(prototypeId);
        // A fetch of the list that started before the save would put the old note back.
        await queryClient.cancelQueries({ queryKey });
        queryClient.setQueryData<PrototypeVersionList>(
          queryKey,
          (list) =>
            list && {
              versions: list.versions.map((version) =>
                version.number === number ? { ...version, ...written } : version,
              ),
            },
        );
        setEdit((current) => (current?.text === written.note ? null : current));
      },
    },
  });

  return {
    text: edit?.text ?? shown.note,
    change: (text) => {
      write.reset();
      setEdit((current) =>
        text === shown.note ? null : { text, from: current?.from ?? shown.note },
      );
    },
    save: () => {
      write.mutate({ prototypeId, number: shown.number, data: { note: edit?.text ?? shown.note } });
    },
    saving: write.isPending,
    status: noteStatus(edit, shown.note, write.error?.failure ?? null),
  };
}

function noteStatus(edit: Edit | null, saved: string, failure: ApiFailure | null): NoteStatus {
  if (failure !== null) return { kind: "failed", failure };
  if (edit === null) return { kind: "saved" };
  return edit.from === saved ? { kind: "edited" } : { kind: "changedElsewhere" };
}
