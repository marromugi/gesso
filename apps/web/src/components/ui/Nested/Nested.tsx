import { FloatingTree, useFloatingParentNodeId } from "@floating-ui/react";

import type { NestedProps } from "./type.ts";

/**
 * Lets floating parts that open from inside one another know of each other,
 * so that a press in an inner one does not count as a press outside the
 * outer one. The outermost part starts the tree; the ones inside join it.
 */
export function Nested({ children }: NestedProps) {
  return useFloatingParentNodeId() === null ? <FloatingTree>{children}</FloatingTree> : children;
}
