import { expect, test } from "vitest";
import type { PrototypeVersion } from "./api/client.ts";
import { notesToShow } from "./notes.ts";

const source = { commit: "a".repeat(40), branch: "main" };

/** Newest first, as the API lists them. */
const versions: PrototypeVersion[] = [
  { number: 3, createdAt: "", source, note: "敵が速すぎる", noteUpdatedAt: "" },
  { number: 2, createdAt: "", source: null, note: "  \n", noteUpdatedAt: "" },
  { number: 1, createdAt: "", source: null, note: "ジャンプが重い", noteUpdatedAt: "" },
];

test("without a version, every version with a note is shown, newest first", () => {
  expect(notesToShow(versions).map((version) => [version.number, version.note])).toEqual([
    [3, "敵が速すぎる"],
    [1, "ジャンプが重い"],
  ]);
});

test("a version asked for is shown even without a note, and one that doesn't exist says so", () => {
  expect(notesToShow(versions, 2)).toEqual([{ number: 2, source: null, note: "  \n" }]);
  expect(() => notesToShow(versions, 9)).toThrow(/版 9 はありません/);
});
