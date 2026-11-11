import {
  autoUpdate,
  flip,
  offset,
  shift,
  size,
  useDismiss,
  useFloating,
  useFloatingNodeId,
  useInteractions,
  useListNavigation,
  useRole,
} from "@floating-ui/react";
import type { UseInteractionsReturn } from "@floating-ui/react";
import { useRef } from "react";
import type { CSSProperties } from "react";

const VIEWPORT_MARGIN = 8;

export type OptionPanel = {
  nodeId: string | undefined;
  /** Give it the row's index and pass the result as the row's `ref`. */
  setRow: (index: number) => (node: HTMLElement | null) => void;
  setControl: (node: HTMLInputElement | null) => void;
  setPanel: (node: HTMLElement | null) => void;
  panelStyles: CSSProperties;
  getControlProps: UseInteractionsReturn["getReferenceProps"];
  getPanelProps: UseInteractionsReturn["getFloatingProps"];
  getRowProps: UseInteractionsReturn["getItemProps"];
};

/**
 * Ties a text control to the list of options that opens under it: where the
 * list sits, that it is at least as wide as the control, closing on Escape
 * or a press outside, and moving through the rows with the arrow keys while
 * the focus stays in the control.
 */
export function useOptionPanel({
  open,
  onOpenChange,
  active,
  onNavigate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  active: number | null;
  onNavigate: (active: number | null) => void;
}): OptionPanel {
  const rows = useRef<(HTMLElement | null)[]>([]);
  const nodeId = useFloatingNodeId();
  const { refs, floatingStyles, context } = useFloating<HTMLInputElement>({
    nodeId,
    open,
    onOpenChange,
    placement: "bottom-start",
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(4),
      flip({ padding: VIEWPORT_MARGIN }),
      shift({ padding: VIEWPORT_MARGIN }),
      size({
        apply: ({ rects, elements }) => {
          elements.floating.style.minWidth = `${rects.reference.width}px`;
        },
      }),
    ],
  });
  const { getReferenceProps, getFloatingProps, getItemProps } = useInteractions([
    useRole(context, { role: "listbox" }),
    useDismiss(context, { capture: { escapeKey: true } }),
    useListNavigation(context, {
      listRef: rows,
      activeIndex: active,
      onNavigate,
      virtual: true,
      loop: true,
    }),
  ]);

  return {
    nodeId,
    setRow: (index) => (node) => {
      rows.current[index] = node;
    },
    setControl: (node) => refs.setReference(node),
    setPanel: (node) => refs.setFloating(node),
    panelStyles: floatingStyles,
    getControlProps: getReferenceProps,
    getPanelProps: getFloatingProps,
    getRowProps: getItemProps,
  };
}
