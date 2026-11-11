import { tv } from "@/lib/ui/tv";

export const button = tv({
  base: [
    // layout
    "inline-flex cursor-pointer items-center justify-center gap-2",
    // shape
    "rounded-control border px-4 control-py-2",
    // typography
    "text-sm font-semibold",
    // motion
    "transition duration-160 ease-out active:scale-97",
    // focus
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
    // state
    "disabled:pointer-events-none disabled:opacity-50 aria-disabled:cursor-default aria-disabled:opacity-50",
  ],
  variants: {
    tone: {
      primary: "border-on-accent/30 bg-accent text-on-accent hover:brightness-110",
      neutral: "border-edge hover:bg-edge",
    },
  },
  defaultVariants: { tone: "primary" },
});
