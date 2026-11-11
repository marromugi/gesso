import type { ReactNode } from "react";

export type ToastProps = {
  tone: "error" | "notice";
  /** False while it leaves, so it can fade out before it is removed. */
  visible: boolean;
  onDismiss: () => void;
  /** How screen readers announce it: errors at once, notices when there is a pause. */
  role: "alert" | "status";
  "aria-live": "assertive" | "polite" | "off";
  children: ReactNode;
};
