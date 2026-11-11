import {
  FloatingFocusManager,
  FloatingNode,
  FloatingOverlay,
  FloatingPortal,
  useDismiss,
  useFloating,
  useFloatingNodeId,
  useInteractions,
  useRole,
} from "@floating-ui/react";
import { clsx } from "clsx";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useId } from "react";

import { CloseIcon } from "@/components/ui/Icon";
import { IconButton } from "@/components/ui/IconButton";
import { Nested } from "@/components/ui/Nested";
import { isOutsideToasts, toasterElements } from "@/lib/ui/toast";

import { modal } from "./style.ts";
import type { ModalProps } from "./type.ts";

/**
 * A dialog over the page that keeps the focus inside it until it closes, then
 * hands the focus back to where it was. On opening, the focus goes to the
 * dialog itself, not to a control in it. A press outside it, Escape, or its
 * close button closes it.
 */
function ModalBody({ title, open, onOpenChange, returnFocus, height, children }: ModalProps) {
  const titleId = useId();
  const nodeId = useFloatingNodeId();
  const { refs, context } = useFloating({ nodeId, open, onOpenChange });
  const setFloating = (node: HTMLElement | null) => refs.setFloating(node);
  const { getFloatingProps } = useInteractions([
    useDismiss(context, { capture: { escapeKey: true }, outsidePress: isOutsideToasts }),
    useRole(context, { role: "dialog" }),
  ]);

  // The close button casts a shadow, so it reads as lying over whatever it overlaps.
  const close = (
    <span className="inline-flex rounded-full shadow-float">
      <IconButton
        icon={CloseIcon}
        label="閉じる"
        type="button"
        onClick={() => onOpenChange(false)}
      />
    </span>
  );

  return (
    <FloatingNode id={nodeId}>
      <FloatingPortal>
        <MotionConfig reducedMotion="user">
          <AnimatePresence>
            {open ? (
              <FloatingOverlay
                lockScroll
                className={clsx(
                  // layout
                  "z-20 grid place-items-center",
                  // spacing: clear of the notch and the home indicator
                  "px-6 pt-[calc(--spacing(6)+var(--spacing-safe-top))] pb-[calc(--spacing(6)+var(--spacing-safe-bottom))]",
                )}
              >
                <motion.div
                  aria-hidden
                  className="absolute inset-0 bg-scrim"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.16 }}
                />
                <FloatingFocusManager
                  context={context}
                  modal
                  // A toast raised while this is open stays readable and reachable.
                  getInsideElements={toasterElements}
                  returnFocus={returnFocus ?? true}
                  initialFocus={refs.floating}
                >
                  <motion.div
                    ref={setFloating}
                    aria-modal
                    aria-labelledby={titleId}
                    className={modal({ height })}
                    initial={{ opacity: 0, scale: 0.94 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.94 }}
                    transition={{ type: "spring", bounce: 0.2, duration: 0.3 }}
                    {...getFloatingProps()}
                  >
                    <div className="flex min-h-8 items-center justify-between gap-3">
                      <h2 id={titleId} className="text-base font-semibold">
                        {title}
                      </h2>
                      {close}
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto pt-4">{children}</div>
                  </motion.div>
                </FloatingFocusManager>
              </FloatingOverlay>
            ) : null}
          </AnimatePresence>
        </MotionConfig>
      </FloatingPortal>
    </FloatingNode>
  );
}

export function Modal(props: ModalProps) {
  return (
    <Nested>
      <ModalBody {...props} />
    </Nested>
  );
}
