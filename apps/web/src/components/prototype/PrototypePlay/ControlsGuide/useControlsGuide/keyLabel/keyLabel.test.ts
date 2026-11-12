import { expect, test } from "vitest";
import { keyLabel } from "./keyLabel.ts";

test.each([
  ["KeyA", "A"],
  ["Digit1", "1"],
  ["Numpad7", "7"],
  ["ArrowLeft", "←"],
  ["Space", "Space"],
  ["ShiftLeft", "Shift"],
  ["F5", "F5"],
])("%s reads as %s", (code, label) => {
  expect(keyLabel(code)).toBe(label);
});
