import {
  FloatingNode,
  FloatingPortal,
  autoUpdate,
  flip,
  offset as offsetBy,
  shift,
  useClick,
  useDismiss,
  useFloating,
  useFloatingNodeId,
  useInteractions,
  useMergeRefs,
  useRole,
} from "@floating-ui/react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { cloneElement, useState } from "react";

import { Nested } from "@/components/ui/Nested";

import { originFor, placementFor } from "./placement";
import type { PopoverProps } from "./type.ts";

const VIEWPORT_MARGIN = 8;

/**
 * Opens `children` next to `trigger` when the trigger is clicked, and closes
 * on a click outside or on Escape. It moves to the other side or slides along
 * the trigger to stay inside the viewport. It draws nothing of its own:
 * `children` bring their own surface and padding.
 */
function PopoverBody({
  trigger,
  direction = "bottom",
  align = "start",
  offset = 8,
  open: givenOpen,
  onOpenChange,
  defaultOpen = false,
  children,
}: PopoverProps) {
  const [ownOpen, setOwnOpen] = useState(defaultOpen);
  const open = givenOpen ?? ownOpen;
  const setOpen = (next: boolean) => {
    if (givenOpen === undefined) setOwnOpen(next);
    onOpenChange?.(next);
  };
  const nodeId = useFloatingNodeId();
  const { refs, floatingStyles, context, placement } = useFloating({
    nodeId,
    open,
    onOpenChange: setOpen,
    placement: placementFor(direction, align),
    whileElementsMounted: autoUpdate,
    middleware: [
      offsetBy(offset),
      flip({ padding: VIEWPORT_MARGIN }),
      shift({ padding: VIEWPORT_MARGIN }),
    ],
  });
  // The trigger keeps a ref of its own, so others can point at it too.
  const setReference = useMergeRefs([
    (node: Element | null) => refs.setReference(node),
    trigger.props.ref,
  ]);
  const setFloating = (node: HTMLElement | null) => refs.setFloating(node);
  const { getReferenceProps, getFloatingProps } = useInteractions([
    useClick(context),
    // Escape is taken where the key is pressed, so the innermost open part closes first.
    useDismiss(context, { capture: { escapeKey: true } }),
    useRole(context),
  ]);

  return (
    <>
      {cloneElement(trigger, {
        type: "button",
        ...getReferenceProps(trigger.props),
        ref: setReference,
      })}
      <FloatingNode id={nodeId}>
        <FloatingPortal>
          <MotionConfig reducedMotion="user">
            <AnimatePresence>
              {open ? (
                <div
                  ref={setFloating}
                  style={floatingStyles}
                  className="z-30"
                  {...getFloatingProps()}
                >
                  <motion.div
                    style={{ transformOrigin: originFor(placement) }}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ type: "spring", bounce: 0.25, duration: 0.3 }}
                  >
                    {children}
                  </motion.div>
                </div>
              ) : null}
            </AnimatePresence>
          </MotionConfig>
        </FloatingPortal>
      </FloatingNode>
    </>
  );
}

export function Popover(props: PopoverProps) {
  return (
    <Nested>
      <PopoverBody {...props} />
    </Nested>
  );
}
