import { tv } from "@/lib/ui/tv";

/** The look of a list of options that opens from a control: the panel. */
export const optionList = tv({
  base: [
    // layout
    "flex flex-col",
    // shape
    "rounded-container border border-edge container-p-1 around-control-py-2",
    // color
    "bg-surface-raised",
    // typography
    "text-sm",
  ],
});

/** One row in a list of options. */
export const optionRow = tv({
  base: [
    // layout
    "flex w-full cursor-pointer items-center justify-between gap-3",
    // shape
    "rounded-control px-3 control-py-2",
    // typography
    "text-left",
    // motion
    "transition duration-160 ease-out",
    // focus and hover
    "outline-none hover:bg-edge focus-visible:bg-edge",
  ],
  variants: {
    /** The row the keyboard is on. */
    active: { yes: "bg-edge", no: "" },
  },
  defaultVariants: { active: "no" },
});
