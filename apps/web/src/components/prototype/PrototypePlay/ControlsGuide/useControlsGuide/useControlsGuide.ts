import { type ApiFailure, useGetPrototypeVersionControls } from "@/lib/api";
import { keyLabel } from "./keyLabel";

/** One action as the guide lists it: its name and the keys that do it, as people read them. */
export type GuideLine = { id: string; label: string; keys: GuideKey[] };

/** A key as `controls.json` names it (`code`, unique in the file) and as people read it. */
export type GuideKey = { code: string; label: string };

/**
 * What the guide shows for a version.
 * - `none`: it declares no controls (no `controls.json`), so nothing is shown.
 * - `invalid`: its `controls.json` can't be read, and why.
 */
export type GuideState =
  | { state: "loading" }
  | { state: "none" }
  | { state: "failed"; failure: ApiFailure }
  | { state: "invalid"; problem: string }
  | { state: "declared"; lines: GuideLine[] };

/** The controls version `number` of the prototype declares in its `controls.json`. */
export function useControlsGuide(prototypeId: string, number: number): GuideState {
  const controls = useGetPrototypeVersionControls(prototypeId, number, {
    // A version's files never change, so neither do its controls.
    query: { staleTime: Number.POSITIVE_INFINITY },
  });
  if (controls.isPending) return { state: "loading" };
  if (controls.isError) return { state: "failed", failure: controls.error.failure };
  const { actions, problem } = controls.data;
  if (problem !== null) return { state: "invalid", problem };
  if (actions === null) return { state: "none" };
  return {
    state: "declared",
    lines: actions.map((action) => ({
      id: action.id,
      label: action.label,
      keys: action.keys.map((code) => ({ code, label: keyLabel(code) })),
    })),
  };
}
