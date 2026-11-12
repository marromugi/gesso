import {
  type ApiError,
  type ApiFailure,
  type PlayUrl,
  type PrototypeVersion,
  useCreatePrototypePlayUrl,
  useGetPrototype,
  useListPrototypeVersions,
} from "@/lib/api";

/** HTTP statuses the API answers with for no session, and for a prototype that isn't theirs. */
const unauthorizedStatus = 401;
const notFoundStatus = 404;

const createdAtFormat = new Intl.DateTimeFormat("ja-JP", {
  dateStyle: "medium",
  timeStyle: "short",
});

/** One version in the list to switch between. */
export type VersionItem = { number: number; label: string; createdAt: string; current: boolean };

/**
 * What the player area shows.
 * - `noVersions`: the prototype has no version yet.
 * - `missing`: the version asked for doesn't exist.
 * - `loading` / `failed` / `playing`: the play URL of version `number`.
 */
export type PlayerState =
  | { state: "noVersions" }
  | { state: "missing"; number: number }
  | { state: "loading"; number: number }
  | { state: "failed"; number: number; failure: ApiFailure }
  | { state: "playing"; number: number; url: string };

export type PrototypePlayState =
  | { state: "loading" }
  | { state: "signedOut" }
  | { state: "notFound" }
  | { state: "failed"; failure: ApiFailure }
  | { state: "ready"; name: string; versions: VersionItem[]; player: PlayerState };

/**
 * The prototype `prototypeId` with its versions, playing version `version` or, without one, the
 * newest. A play URL is fetched once per version shown and kept while the page is open: a new
 * one would reload the game.
 */
export function usePrototypePlay(prototypeId: string, version?: number): PrototypePlayState {
  const prototype = useGetPrototype(prototypeId);
  const versions = useListPrototypeVersions(prototypeId);
  const list = versions.data?.versions ?? [];
  const shown = version ?? list[0]?.number;
  const exists = list.some((item) => item.number === shown);
  const play = useCreatePrototypePlayUrl(prototypeId, shown ?? 0, {
    query: {
      enabled: exists,
      staleTime: Number.POSITIVE_INFINITY,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  });

  // What was shown stays when fetching it again fails.
  if (prototype.data === undefined || versions.data === undefined) {
    const error = prototype.error ?? versions.error;
    if (error === null) return { state: "loading" };
    const { failure } = error;
    if (failure.kind === "rejected" && failure.status === unauthorizedStatus) {
      return { state: "signedOut" };
    }
    if (failure.kind === "rejected" && failure.status === notFoundStatus) {
      return { state: "notFound" };
    }
    return { state: "failed", failure };
  }

  return {
    state: "ready",
    name: prototype.data.name,
    versions: list.map((item) => versionItem(item, shown)),
    player: playerState(shown, exists, play),
  };
}

function versionItem(item: PrototypeVersion, shown: number | undefined): VersionItem {
  return {
    number: item.number,
    label: `版 ${item.number}`,
    createdAt: createdAtFormat.format(new Date(item.createdAt)),
    current: item.number === shown,
  };
}

function playerState(
  shown: number | undefined,
  exists: boolean,
  play: { data: PlayUrl | undefined; error: ApiError | null },
): PlayerState {
  if (shown === undefined) return { state: "noVersions" };
  if (!exists) return { state: "missing", number: shown };
  if (play.data !== undefined) return { state: "playing", number: shown, url: play.data.url };
  if (play.error !== null) return { state: "failed", number: shown, failure: play.error.failure };
  return { state: "loading", number: shown };
}
