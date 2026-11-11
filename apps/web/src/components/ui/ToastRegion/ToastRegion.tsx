import { resolveValue, toast, Toaster } from "react-hot-toast";

import { Toast } from "@/components/ui/Toast";

/**
 * Where toasts appear, at the bottom center. Mount it once, near the root;
 * `toastError` and `toastNotice` from `@/lib/ui/toast` show them.
 */
export function ToastRegion() {
  return (
    <Toaster
      position="bottom-center"
      // Clear of the home indicator on phones; 16px from the edge elsewhere.
      containerStyle={{ bottom: "calc(16px + var(--spacing-safe-bottom))" }}
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
