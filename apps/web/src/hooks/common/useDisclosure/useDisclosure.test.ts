import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";

import { useDisclosure } from "./useDisclosure.ts";

afterEach(() => {
  cleanup();
});

test("opens and closes, by name or by the next state", () => {
  const { result } = renderHook(() => useDisclosure());
  expect(result.current.isOpen).toBe(false);
  act(() => result.current.open());
  expect(result.current.isOpen).toBe(true);
  act(() => result.current.close());
  expect(result.current.isOpen).toBe(false);
  act(() => result.current.setOpen(true));
  expect(result.current.isOpen).toBe(true);
});

test("setOpen is the same function on every render, and can close too", () => {
  const { result, rerender } = renderHook(() => useDisclosure(true));
  expect(result.current.isOpen).toBe(true);
  const first = result.current.setOpen;
  rerender();
  expect(result.current.setOpen).toBe(first);
  act(() => result.current.setOpen(false));
  expect(result.current.isOpen).toBe(false);
});
