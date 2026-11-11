import { resolveValue, toast, Toaster } from "react-hot-toast";

import { Toast } from "@/components/ui/Toast";

/**
 * Where toasts appear, above the footer at the bottom center. Mount it once,
 * near the root; `toastError` and `toastNotice` from `@/lib/ui/toast` show them.
 */
export function ToastRegion() {
  return (
    <Toaster
      position="bottom-center"
      // Above the sticky footer (h-26, grown by the bottom safe-area inset) and its dice.
      containerStyle={{ bottom: "calc(112px + var(--spacing-safe-bottom))" }}
      toastOptions={{ duration: 5000 }}
    >
      {(shown) => (
        <Toast
          tone={shown.type === "error" ? "error" : "notice"}
          visible={shown.visible}
          onDismiss={() => toast.dismiss(shown.id)}
          {...shown.ariaProps}
        >
          {resolveValue(shown.message, shown)}
        </Toast>
      )}
    </Toaster>
  );
}
