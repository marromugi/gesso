import type { ComponentProps } from "react";

export type TextFieldProps = {
  label: string;
  /** Shown under the input, which is then marked invalid. */
  error?: string;
} & Pick<
  ComponentProps<"input">,
  "name" | "type" | "autoComplete" | "disabled" | "onChange" | "onBlur" | "ref"
>;
