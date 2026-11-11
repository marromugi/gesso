import { useState } from "react";

/** Whether something that opens and closes, as a menu or a modal, is open. */
export type Disclosure = {
  isOpen: boolean;
  /** For an `onOpenChange` that hands over the next state. The same function on every render. */
  setOpen: (open: boolean) => void;
  open: () => void;
  close: () => void;
};

/** The open state of a menu, modal, or panel; closed at first unless `initial` says so. */
export function useDisclosure(initial = false): Disclosure {
  const [isOpen, setOpen] = useState(initial);
  return { isOpen, setOpen, open: () => setOpen(true), close: () => setOpen(false) };
}
