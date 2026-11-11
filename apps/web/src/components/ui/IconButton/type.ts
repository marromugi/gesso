import type { ComponentProps } from "react";

import type { IconSource } from "@/components/ui/Icon";

export type IconButtonProps = {
  icon: IconSource;
  /** Its name for screen readers, since it shows only the icon. */
  label: string;
} & Omit<ComponentProps<"button">, "aria-label" | "children">;
