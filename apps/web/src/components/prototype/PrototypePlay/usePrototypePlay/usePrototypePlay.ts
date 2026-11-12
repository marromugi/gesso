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

/** How much of a commit's name is shown, as git shows it. */
const shortCommitLength = 7;

const createdAtFormat = new Intl.DateTimeFormat("ja-JP", {
  dateStyle: "medium",
  timeStyle: "short",
});

/** One version in the list to switch between. */
export type VersionItem = {
  number: number;
  label: string;
  createdAt: string;
  /** Where it came from, as `main a1b2c3d`; `null` when it wasn't sent from git. */
  source: string | null;
  current: boolean;
};

/** The note of the version being played, as saved. */
export type ShownNote = { number: number; note: string };

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
  | { state: "openNewest"; number: number }
  | {
      state: "ready";
      name: string;
      versions: VersionItem[];
      player: PlayerState;
      /** `null` when no version is being played, or the one asked for doesn't exist. */
      note: ShownNote | null;
    };

/**
 * The prototype `prototypeId` with its versions, playing version `version`. Without one, it says
 * to open the newest (`openNewest`), so that a version sent later doesn't replace the game being
 * played. A play URL is fetched again only after it expires and only when its version is shown
 * anew: a new URL reloads the game.
 */
export function usePrototypePlay(prototypeId: string, version?: number): PrototypePlayState {
  const prototype = useGetPrototype(prototypeId);
  const versions = useListPrototypeVersions(prototypeId);
  const list = versions.data?.versions ?? [];
  const exists = list.some((item) => item.number === version);
  const play = useCreatePrototypePlayUrl(prototypeId, version ?? 0, {
    query: {
      enabled: exists,
      staleTime: (query) => {
        const expiresAt = query.state.data?.expiresAt;
        return expiresAt === undefined ? 0 : Math.max(Date.parse(expiresAt) - Date.now(), 0);
      },
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

  const [newest] = list;
  if (version === undefined && newest !== undefined) {
    return { state: "openNewest", number: newest.number };
  }

  return {
    state: "ready",
    name: prototype.data.name,
    versions: list.map((item) => versionItem(item, version)),
    player: playerState(version, exists, play),
    note: shownNote(list, version),
  };
}

function shownNote(list: readonly PrototypeVersion[], shown: number | undefined): ShownNote | null {
  const item = list.find((candidate) => candidate.number === shown);
  return item === undefined ? null : { number: item.number, note: item.note };
}

function versionItem(item: PrototypeVersion, shown: number | undefined): VersionItem {
  return {
    number: item.number,
    label: `版 ${item.number}`,
    createdAt: createdAtFormat.format(new Date(item.createdAt)),
    source:
      item.source === null
        ? null
        : `${item.source.branch ?? "ブランチなし"} ${item.source.commit.slice(0, shortCommitLength)}`,
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
