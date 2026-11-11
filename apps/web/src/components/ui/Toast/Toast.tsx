import { CloseIcon } from "@/components/ui/Icon";
import { IconButton } from "@/components/ui/IconButton";

import { toastCard } from "./style.ts";
import type { ToastProps } from "./type.ts";

/** One message at the edge of the screen, with a button to put it away early. */
export function Toast({ tone, visible, onDismiss, children, ...announce }: ToastProps) {
  return (
    <div className={toastCard({ tone, visible })}>
      <p {...announce} className="min-w-0 flex-1">
        {children}
      </p>
      <IconButton icon={CloseIcon} label="閉じる" type="button" onClick={onDismiss} />
    </div>
  );
}
