import { icon } from "./style.ts";
import type { IconProps } from "./type.ts";

/** Draws the given SVG at a set size. It is decorative, so screen readers skip it. */
export function Icon({ icon: Source, size }: IconProps) {
  return <Source aria-hidden className={icon({ size })} />;
}
