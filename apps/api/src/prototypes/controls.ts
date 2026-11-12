import { z } from "@hono/zod-openapi";

/** Where a version declares its controls (the templates' `controls.json`, apps/cli/templates). */
export const controlsPath = "controls.json";

/** The largest `controls.json` read, in bytes; a list of keys is far smaller. */
export const maxControlsBytes = 64 * 1024;

/** One thing the player does: what it is called and the keys (`KeyboardEvent.code`) that do it. */
export const ControlAction = z
  .object({ id: z.string(), label: z.string(), keys: z.array(z.string()) })
  .openapi("ControlAction");

const ControlsFile = z.object({ format: z.literal(1), actions: z.array(ControlAction) });

export type ControlAction = z.infer<typeof ControlAction>;

/** What a version's `controls.json` declares, or why it can't be read. */
export type ControlsRead =
  | { kind: "declared"; actions: ControlAction[] }
  | { kind: "invalid"; problem: string };

/**
 * `text` read as `controls.json`: its actions, or what is wrong with it, in words for the
 * person who wrote it (format 1 is the only one known; the game's own runtime checks the same).
 */
export function readControls(text: string): ControlsRead {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { kind: "invalid", problem: "JSON として読めません" };
  }
  const parsed = ControlsFile.safeParse(json);
  if (!parsed.success) {
    const [issue] = parsed.error.issues;
    const where = issue?.path.join(".") ?? "";
    return {
      kind: "invalid",
      problem: `${where === "" ? "" : `${where}: `}${issue?.message ?? ""}`,
    };
  }
  return { kind: "declared", actions: parsed.data.actions };
}
