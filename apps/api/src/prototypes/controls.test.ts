import { expect, test } from "vitest";
import { readControls } from "./controls.ts";

test("controls.json's actions are read as declared", () => {
  const text = JSON.stringify({
    format: 1,
    actions: [{ id: "jump", label: "ジャンプ", keys: ["Space", "KeyW"] }],
  });
  expect(readControls(text)).toEqual({
    kind: "declared",
    actions: [{ id: "jump", label: "ジャンプ", keys: ["Space", "KeyW"] }],
  });
});

test.each([
  ["not JSON", "{ format: 1", /JSON/],
  ["another format", JSON.stringify({ format: 2, actions: [] }), /^format: 無効な入力/],
  [
    "an action without keys",
    JSON.stringify({ format: 1, actions: [{ id: "a", label: "A" }] }),
    /^actions\.0\.keys: /,
  ],
  [
    "two actions with one id",
    JSON.stringify({
      format: 1,
      actions: [
        { id: "a", label: "A", keys: ["KeyA"] },
        { id: "a", label: "B", keys: ["KeyB"] },
      ],
    }),
    /^actions\.1\.id: a はほかの操作にもあります$/,
  ],
  [
    "one key in two actions",
    JSON.stringify({
      format: 1,
      actions: [
        { id: "a", label: "A", keys: ["KeyA"] },
        { id: "b", label: "B", keys: ["KeyB", "KeyA"] },
      ],
    }),
    /^actions\.1\.keys\.1: KeyA はほかでも使われています$/,
  ],
])("controls.json that is %s says what is wrong, and where", (_, text, problem) => {
  const read = readControls(text);
  expect(read.kind).toBe("invalid");
  expect(read.kind === "invalid" ? read.problem : "").toMatch(problem);
});

test("controls.json saved with a byte order mark is read as the browser reads it", () => {
  const text = `\uFEFF${JSON.stringify({ format: 1, actions: [] })}`;
  expect(readControls(text)).toEqual({ kind: "declared", actions: [] });
});
