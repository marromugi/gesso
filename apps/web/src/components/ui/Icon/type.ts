import type { JSX, SVGProps } from "react";

export type IconSource = (props: SVGProps<SVGSVGElement>) => JSX.Element;

export type IconProps = {
  icon: IconSource;
  size?: "sm" | "md" | "lg" | "xl";
};
