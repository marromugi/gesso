import { tv } from "@/lib/ui/tv";

/** The look shared by the controls a person types into. */
export const control = tv({
  base: [
    // layout
    "w-full",
    // shape
    "rounded-control border px-4 control-py-2",
    // typography
    "text-base placeholder:opacity-50",
    // color
    "bg-surface-raised hover:bg-surface focus:bg-surface-raised",
    // motion
    "transition duration-160 ease-out",
    // focus
    "outline-none",
  ],
  variants: {
    state: {
      default: "border-edge focus-visible:border-accent",
      error:
        "border-error focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-error",
    },
  },
  defaultVariants: { state: "default" },
});
