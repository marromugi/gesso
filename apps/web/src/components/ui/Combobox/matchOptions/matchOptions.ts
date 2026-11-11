/** One choice in a combobox. `label` is what typing matches and what the control shows. */
export type Option = { value: string; label: string };

/** The options whose label contains what was typed, ignoring case and outer spaces. */
export function matchOptions(options: readonly Option[], typed: string): Option[] {
  const wanted = typed.trim().toLowerCase();
  return options.filter((option) => option.label.toLowerCase().includes(wanted));
}
