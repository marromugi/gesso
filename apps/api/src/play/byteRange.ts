/**
 * The one byte range a `Range` header asks for, as R2 takes it, or `null` for no header, more than
 * one range, or one that can't be read: the whole file is sent then, which HTTP allows.
 */
export function parseByteRange(header: string | null): R2Range | null {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header?.trim() ?? "");
  if (!match) return null;
  const [, first = "", last = ""] = match;
  if (first === "" && last === "") return null;
  if (first === "") return Number(last) > 0 ? { suffix: Number(last) } : null;
  const offset = Number(first);
  if (last === "") return { offset };
  const end = Number(last);
  return end >= offset ? { offset, length: end - offset + 1 } : null;
}

/** Where a range of a file of `size` bytes starts and ends, both inclusive. */
export function rangeBounds(range: R2Range, size: number): { start: number; end: number } {
  if ("suffix" in range) {
    return { start: Math.max(size - range.suffix, 0), end: size - 1 };
  }
  const start = range.offset ?? 0;
  const length = range.length ?? size - start;
  return { start, end: Math.min(start + length, size) - 1 };
}
