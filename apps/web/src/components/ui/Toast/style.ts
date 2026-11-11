import { tv } from "@/lib/ui/tv";

export const toastCard = tv({
  base: [
    // layout
    "pointer-events-auto flex max-w-sm items-center gap-3",
    // shape
    "rounded-container border border-edge container-p-3",
    // color
    "bg-surface-raised shadow-float",
    // typography
    "text-sm",
    // motion
    "transition duration-200 ease-out motion-reduce:transition-none",
  ],
  variants: {
    tone: { error: "text-error", notice: "" },
    visible: { true: "translate-y-0 opacity-100", false: "translate-y-2 opacity-0" },
  },
});
