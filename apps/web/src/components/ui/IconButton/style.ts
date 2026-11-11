import { tv } from "@/lib/ui/tv";

export const iconButton = tv({
  base: [
    // layout
    "inline-flex size-8 cursor-pointer items-center justify-center",
    // shape
    "rounded-full border border-edge",
    // color
    "bg-surface-raised hover:bg-edge",
    // motion
    "transition duration-160 ease-out active:scale-97",
    // focus
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
    // state
    "disabled:pointer-events-none disabled:opacity-50",
  ],
});
