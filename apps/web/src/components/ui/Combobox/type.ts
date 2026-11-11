import type { Option } from "./matchOptions";

export type ComboboxProps = {
  label: string;
  options: readonly Option[];
  /** The chosen option's value; `null` for none. */
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  /** Shown in the list when nothing matches. */
  empty?: string;
  disabled?: boolean;
  /**
   * Takes the focus when shown, with the chosen name selected, and opens the
   * list. For a combobox that appears because the person asked for it, as in
   * a popover.
   */
  focusOnMount?: boolean;
};
