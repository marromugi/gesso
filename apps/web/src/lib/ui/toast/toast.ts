import { toast } from "react-hot-toast";

/**
 * Tells the person that something went wrong, for a while at the edge of the
 * screen, and has screen readers say it at once. The same text again replaces
 * the one showing instead of stacking.
 */
export function toastError(text: string): void {
  toast.error(text, { id: text, ariaProps: { role: "alert", "aria-live": "assertive" } });
}

/** Tells the person something they should know, in the same place as errors. */
export function toastNotice(text: string): void {
  toast(text, { id: text });
}

/** react-hot-toast marks its container with this attribute. */
const TOASTER = "[data-rht-toaster]";

/**
 * The toast containers on the page, for a dialog that shuts out the rest of
 * the page to let in: so a toast raised while it is open is read out and can
 * be reached.
 */
export function toasterElements(): Element[] {
  return Array.from(document.querySelectorAll(TOASTER));
}

/** False for a press on a toast, so a dialog does not close when a toast is put away. */
export function isOutsideToasts(event: Event): boolean {
  return !(event.target instanceof Element && event.target.closest(TOASTER) !== null);
}
