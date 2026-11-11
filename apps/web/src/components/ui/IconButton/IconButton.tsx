import { Icon } from "@/components/ui/Icon";

import { iconButton } from "./style.ts";
import type { IconButtonProps } from "./type.ts";

/** A round button that shows only an icon. */
export function IconButton({ icon, label, className, ...props }: IconButtonProps) {
  return (
    <button {...props} aria-label={label} className={iconButton({ className })}>
      <Icon icon={icon} size="md" />
    </button>
  );
}
