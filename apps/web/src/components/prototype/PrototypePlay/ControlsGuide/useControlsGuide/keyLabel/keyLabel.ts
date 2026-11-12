/** Keys whose `KeyboardEvent.code` reads better as a sign. */
const signs: Record<string, string> = {
  ArrowUp: "↑",
  ArrowDown: "↓",
  ArrowLeft: "←",
  ArrowRight: "→",
  Space: "Space",
  Enter: "Enter",
  Escape: "Esc",
  ShiftLeft: "Shift",
  ShiftRight: "Shift",
  ControlLeft: "Ctrl",
  ControlRight: "Ctrl",
  AltLeft: "Alt",
  AltRight: "Alt",
};

/**
 * A key as a person reads it, from its `KeyboardEvent.code` as `controls.json` gives it:
 * `KeyA` is `A`, `Digit1` is `1`, `ArrowLeft` is `←`; a code it doesn't know stays as it is.
 */
export function keyLabel(code: string): string {
  const sign = signs[code];
  if (sign !== undefined) return sign;
  const letter = /^Key([A-Z])$/.exec(code)?.[1];
  if (letter !== undefined) return letter;
  const digit = /^(?:Digit|Numpad)(\d)$/.exec(code)?.[1];
  if (digit !== undefined) return digit;
  return code;
}
