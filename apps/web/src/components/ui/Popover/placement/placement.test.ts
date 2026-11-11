import { describe, expect, it } from "vitest";

import { originFor, placementFor } from "./placement.ts";
import type { Placement } from "./placement.ts";

describe("placementFor", () => {
  it("is the direction alone when centred", () => {
    expect(placementFor("bottom", "center")).toBe("bottom");
  });

  it("adds the alignment to the direction", () => {
    expect(placementFor("right", "start")).toBe("right-start");
    expect(placementFor("top", "end")).toBe("top-end");
  });
});

describe("originFor", () => {
  it("is the edge or corner of the popover that touches the trigger", () => {
    const placements: Placement[] = [
      "top",
      "top-start",
      "top-end",
      "bottom",
      "bottom-start",
      "bottom-end",
      "left",
      "left-start",
      "left-end",
      "right",
      "right-start",
      "right-end",
    ];
    expect(placements.map((placement) => originFor(placement))).toEqual([
      "bottom center",
      "bottom left",
      "bottom right",
      "top center",
      "top left",
      "top right",
      "right center",
      "right top",
      "right bottom",
      "left center",
      "left top",
      "left bottom",
    ]);
  });
});
