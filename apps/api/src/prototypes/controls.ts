import { z } from "@hono/zod-openapi";

/** Where a version declares its controls (the templates' `controls.json`, apps/cli/templates). */
export const controlsPath = "controls.json";

/** The largest `controls.json` read, in bytes; a list of keys is far smaller. */
export const maxControlsBytes = 64 * 1024;

/** One thing the player does: what it is called and the keys (`KeyboardEvent.code`) that do it. */
export const ControlAction = z
  .object({ id: z.string(), label: z.string(), keys: z.array(z.string()) })
  .openapi("ControlAction");

/** Each id and each key belongs to one action, as the game's runtime requires. */
const ControlsFile = z
  .object({ format: z.literal(1), actions: z.array(ControlAction) })
  .superRefine(({ actions }, context) => {
    const ids = new Set<string>();
    const keys = new Set<string>();
    for (const [index, action] of actions.entries()) {
      if (ids.has(action.id)) {
        context.addIssue({
          code: "custom",
          path: ["actions", index, "id"],
          message: `${action.id} はほかの操作にもあります`,
        });
      }
      ids.add(action.id);
      for (const [keyIndex, key] of action.keys.entries()) {
        if (keys.has(key)) {
          context.addIssue({
            code: "custom",
            path: ["actions", index, "keys", keyIndex],
            message: `${key} はほかでも使われています`,
          });
        }
        keys.add(key);
      }
    }
  });

export type ControlAction = z.infer<typeof ControlAction>;

const inJapanese = z.locales.ja().localeError;

/** What a version's `controls.json` declares, or why it can't be read. */
export type ControlsRead =
  | { kind: "declared"; actions: ControlAction[] }
  | { kind: "invalid"; problem: string };

/**
 * `text` read as `controls.json`: its actions, or what is wrong with it, in words for the
 * person who wrote it (format 1 is the only one known). The game's runtime accepts the same
 * files, except that this reads no more than `maxControlsBytes`.
 */
export function readControls(text: string): ControlsRead {
  let json: unknown;
  try {
    // A browser's `response.json()` drops a leading byte order mark; so does this.
    json = JSON.parse(text.replace(/^\uFEFF/u, ""));
  } catch {
    return { kind: "invalid", problem: "JSON として読めません" };
  }
  const parsed = ControlsFile.safeParse(json, { error: inJapanese });
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
