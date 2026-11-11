import type { ComponentProps } from "react";

export type RadioProps = {
  label: string;
} & Pick<ComponentProps<"input">, "name" | "value" | "checked" | "disabled" | "onChange">;
