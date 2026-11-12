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
  ["another format", JSON.stringify({ format: 2, actions: [] }), /^format: /],
  [
    "an action without keys",
    JSON.stringify({ format: 1, actions: [{ id: "a", label: "A" }] }),
    /^actions\.0\.keys: /,
  ],
])("controls.json that is %s says what is wrong, and where", (_, text, problem) => {
  const read = readControls(text);
  expect(read.kind).toBe("invalid");
  expect(read.kind === "invalid" ? read.problem : "").toMatch(problem);
});
