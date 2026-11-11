import { tv } from "@/lib/ui/tv";

/** The look of a radio: the circle, and the dot that grows in it once chosen. */
export const radio = tv({
  slots: {
    root: [
      // layout
      "flex cursor-pointer items-center gap-2",
      // state
      "has-disabled:pointer-events-none has-disabled:opacity-50",
    ],
    circle: "relative grid size-4 shrink-0 place-items-center",
    input: [
      // layout
      "peer absolute inset-0 m-0 cursor-pointer appearance-none",
      // shape
      "rounded-full border border-current/50",
      // color
      "checked:border-accent checked:bg-accent",
      // motion
      "transition duration-160 ease-out",
      // focus
      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
    ],
    dot: [
      // shape
      "pointer-events-none relative size-1.5 rounded-full",
      // color
      "bg-on-accent",
      // motion: overshoots a little before settling, like a spring
      "scale-0 transition duration-240 ease-[cubic-bezier(0.34,1.56,0.64,1)] peer-checked:scale-100",
      "motion-reduce:transition-none",
    ],
  },
});
