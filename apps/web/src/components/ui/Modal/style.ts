import { tv } from "@/lib/ui/tv";

/** The look of the dialog's panel. */
export const modal = tv({
  base: [
    // layout
    "relative flex max-h-full w-full max-w-2xl flex-col overflow-hidden",
    // shape
    "rounded-container border border-edge container-p-6",
    // color
    "bg-surface-raised",
    // focus
    "outline-none",
  ],
  variants: {
    /** As tall as its content, or as tall as the screen allows whatever the content. */
    height: { content: "", full: "h-full" },
  },
  defaultVariants: { height: "content" },
});
