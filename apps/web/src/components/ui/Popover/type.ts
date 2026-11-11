import type { ReactElement, ReactNode, Ref } from "react";

import type { Align, Direction } from "./placement";

/**
 * Whoever passes `open` holds the state, so it must also take the changes.
 * Without `open` the popover holds the state itself.
 */
type OpenState =
  | { open: boolean; onOpenChange: (open: boolean) => void; defaultOpen?: undefined }
  | { open?: undefined; onOpenChange?: (open: boolean) => void; defaultOpen?: boolean };

export type PopoverProps = {
  /** One element that passes the props it is given on to a button. Its own `ref` is kept. */
  trigger: ReactElement<{ ref?: Ref<Element> } & Record<string, unknown>>;
  direction?: Direction;
  align?: Align;
  offset?: number;
  children: ReactNode;
} & OpenState;
