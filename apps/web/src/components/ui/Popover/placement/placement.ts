export type Direction = "top" | "right" | "bottom" | "left";
export type Align = "start" | "center" | "end";
export type Placement = Direction | `${Direction}-${"start" | "end"}`;

/** The placement on `direction` of the trigger, lined up with it by `align`. */
export function placementFor(direction: Direction, align: Align): Placement {
  return align === "center" ? direction : `${direction}-${align}`;
}

/**
 * The corner or edge of the popover that touches its trigger at each
 * placement, as a CSS transform-origin, so it grows out of the trigger.
 */
const ORIGIN: Record<Placement, string> = {
  top: "bottom center",
  "top-start": "bottom left",
  "top-end": "bottom right",
  bottom: "top center",
  "bottom-start": "top left",
  "bottom-end": "top right",
  left: "right center",
  "left-start": "right top",
  "left-end": "right bottom",
  right: "left center",
  "right-start": "left top",
  "right-end": "left bottom",
};

export function originFor(placement: Placement): string {
  return ORIGIN[placement];
}
