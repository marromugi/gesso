import { expect, test } from "vitest";

import { matchOptions } from "./matchOptions.ts";

const options = [
  { value: "lora", label: "Lora" },
  { value: "noto-serif-jp", label: "Noto Serif JP" },
];

test("keeps the options whose label contains the text, ignoring case and outer spaces", () => {
  expect(matchOptions(options, "  SERIF ")).toEqual([options[1]]);
  expect(matchOptions(options, "")).toEqual(options);
  expect(matchOptions(options, "zz")).toEqual([]);
});
