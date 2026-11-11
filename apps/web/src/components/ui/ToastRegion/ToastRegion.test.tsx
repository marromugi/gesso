import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MotionGlobalConfig } from "motion/react";
import { toast } from "react-hot-toast";
import { afterEach, beforeAll, expect, test } from "vitest";

import { Modal } from "@/components/ui/Modal";
import { toastError, toastNotice } from "@/lib/ui/toast";

import { ToastRegion } from "./ToastRegion.tsx";

// The test DOM cancels the modal's animations by rejecting a promise nothing awaits.
beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});

afterEach(() => {
  act(() => toast.remove());
  cleanup();
});

test("an error shows once however often it is raised, is announced at once, and can be put away", async () => {
  render(<ToastRegion />);
  act(() => {
    toastError("保存できませんでした。");
    toastError("保存できませんでした。");
  });
  const shown = await screen.findAllByText("保存できませんでした。");
  expect(shown).toHaveLength(1);
  expect(shown[0]?.getAttribute("role")).toBe("alert");
  fireEvent.click(screen.getByRole("button", { name: "閉じる" }));
  await waitFor(() =>
    expect(screen.getByText("保存できませんでした。").parentElement?.className).toContain(
      "opacity-0",
    ),
  );
});

test("a notice is announced politely", async () => {
  render(<ToastRegion />);
  act(() => toastNotice("新しい版があります。"));
  expect((await screen.findByText("新しい版があります。")).getAttribute("role")).toBe("status");
});

test("a toast raised while a modal is open is read out, and putting it away leaves the modal open", async () => {
  let open = true;
  render(
    <>
      <Modal
        title="設定"
        open
        onOpenChange={(next) => {
          open = next;
        }}
      >
        <p>中身</p>
      </Modal>
      <ToastRegion />
    </>,
  );
  await screen.findByRole("dialog", { name: "設定" });
  act(() => toastError("フォントを読み込めませんでした。"));
  const shown = await screen.findByText("フォントを読み込めませんでした。");
  await waitFor(() => expect(shown.closest('[aria-hidden="true"]')).toBeNull());
  const close = shown.parentElement?.querySelector("button");
  if (!close) throw new Error("the toast has no close button");
  fireEvent.pointerDown(close);
  fireEvent.mouseDown(close);
  fireEvent.click(close);
  expect(open).toBe(true);
});
