import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MotionGlobalConfig } from "motion/react";
import { useState } from "react";
import { afterEach, beforeAll, expect, test } from "vitest";

import { Combobox } from "./Combobox.tsx";

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});

afterEach(() => {
  cleanup();
});

const fonts = [
  { value: "lora", label: "Lora" },
  { value: "noto-serif-jp", label: "Noto Serif JP" },
  { value: "noto-sans-jp", label: "Noto Sans JP" },
];

/** A combobox that keeps its choice, reporting each change in `changes`. */
function Chosen({ options, changes }: { options: typeof fonts; changes: (string | null)[] }) {
  const [value, setValue] = useState<string | null>(null);
  return (
    <Combobox
      label="フォント"
      options={options}
      value={value}
      onChange={(next) => {
        changes.push(next);
        setValue(next);
      }}
    />
  );
}

test("typing narrows the list, and the arrow keys and Enter choose", async () => {
  const changes: (string | null)[] = [];
  render(<Chosen options={fonts} changes={changes} />);
  const input = screen.getByLabelText("フォント");
  await act(async () => {
    fireEvent.change(input, { target: { value: "noto" } });
  });
  expect(screen.getAllByRole("option").map((row) => row.textContent)).toEqual([
    "Noto Serif JP",
    "Noto Sans JP",
  ]);
  await act(async () => {
    fireEvent.keyDown(input, { key: "ArrowDown" });
  });
  await act(async () => {
    fireEvent.keyDown(input, { key: "Enter" });
  });
  expect(changes).toEqual(["noto-sans-jp"]);
  expect(input).toHaveProperty("value", "Noto Sans JP");
  expect(screen.queryByRole("option")).toBeNull();
});

test("clearing the text clears the choice", async () => {
  const changes: (string | null)[] = [];
  render(<Chosen options={fonts} changes={changes} />);
  const input = screen.getByLabelText("フォント");
  await act(async () => {
    fireEvent.change(input, { target: { value: "lora" } });
  });
  await act(async () => {
    fireEvent.click(screen.getByRole("option", { name: "Lora" }));
  });
  await act(async () => {
    fireEvent.change(input, { target: { value: "" } });
  });
  expect(changes).toEqual(["lora", null]);
});

test("draws a hundred matches at most, and counts the rest", async () => {
  const many = Array.from({ length: 250 }, (_, i) => ({ value: `f${i}`, label: `Font ${i}` }));
  render(<Chosen options={many} changes={[]} />);
  await act(async () => {
    fireEvent.click(screen.getByLabelText("フォント"));
  });
  expect(screen.getAllByRole("option")).toHaveLength(100);
  expect(screen.getByText("ほか 150 件。入力して絞り込めます。")).toBeTruthy();
});

test("leaving the control closes the list and drops the typed text", async () => {
  render(<Chosen options={fonts} changes={[]} />);
  const input = screen.getByLabelText("フォント");
  await act(async () => {
    fireEvent.change(input, { target: { value: "lo" } });
  });
  expect(screen.getAllByRole("option").map((row) => row.textContent)).toEqual(["Lora"]);
  await act(async () => {
    fireEvent.blur(input);
  });
  expect(screen.queryByRole("option")).toBeNull();
  expect(input).toHaveProperty("value", "");
});
