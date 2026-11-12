import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  type ApiFailure,
  type PrototypeVersionList,
  getListPrototypeVersionsQueryKey,
  useWritePrototypeVersionNote,
} from "@/lib/api";
import type { ShownNote } from "../../usePrototypePlay";

export type VersionNoteEditor = {
  draft: string;
  change: (draft: string) => void;
  save: () => void;
  saving: boolean;
  /** Whether the draft is what the version has saved. */
  saved: boolean;
  failure: ApiFailure | null;
};

/**
 * Editing the note of the version `shown`, starting from what it has saved. Saving replaces the
 * note and puts it in the version list already fetched, which `shown` comes from.
 */
export function useVersionNote(prototypeId: string, shown: ShownNote): VersionNoteEditor {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(shown.note);
  const write = useWritePrototypeVersionNote({
    mutation: {
      onSuccess: (written, { number }) =>
        queryClient.setQueryData<PrototypeVersionList>(
          getListPrototypeVersionsQueryKey(prototypeId),
          (list) =>
            list && {
              versions: list.versions.map((version) =>
                version.number === number ? { ...version, ...written } : version,
              ),
            },
        ),
    },
  });

  return {
    draft,
    change: setDraft,
    save: () => write.mutate({ prototypeId, number: shown.number, data: { note: draft } }),
    saving: write.isPending,
    saved: draft === shown.note,
    failure: write.error?.failure ?? null,
  };
}
