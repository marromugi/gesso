import { tv } from "@/lib/ui/tv";

export const icon = tv({
  base: "shrink-0",
  variants: {
    // `xl` sets only the height, so a glyph that is not square keeps its shape.
    size: { sm: "size-3", md: "size-4", lg: "size-5", xl: "h-6 w-auto" },
  },
  defaultVariants: { size: "md" },
});
