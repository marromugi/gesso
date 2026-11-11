import { QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MotionGlobalConfig } from "motion/react";
import { afterEach, beforeAll, beforeEach, expect, test, vi } from "vitest";
import { createQueryClient } from "@/lib/api";
import { NewPrototype } from "./NewPrototype.tsx";

const sent: unknown[] = [];

/** Stands in for the API: records what is posted and answers as `POST /prototypes` does. */
async function fakeApi(_url: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  sent.push(typeof init?.body === "string" ? JSON.parse(init.body) : init?.body);
  return Response.json(
    {
      id: "p1",
      name: "二段ジャンプ",
      createdAt: "2026-11-11T00:00:00.000Z",
      updatedAt: "2026-11-11T00:00:00.000Z",
    },
    { status: 201 },
  );
}

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(fakeApi));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  sent.length = 0;
});

function openForm() {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <NewPrototype />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "新しいプロトタイプ" }));
}

test("a name of only spaces is refused before anything is sent", async () => {
  openForm();
  fireEvent.change(screen.getByLabelText("名前"), { target: { value: "   " } });
  fireEvent.click(screen.getByRole("button", { name: "作る" }));

  expect(await screen.findByText("1〜100 文字で入力してください")).toBeTruthy();
  expect(sent).toEqual([]);
});

test("the trimmed name is sent, and the form closes", async () => {
  openForm();
  fireEvent.change(screen.getByLabelText("名前"), { target: { value: "  二段ジャンプ " } });
  fireEvent.click(screen.getByRole("button", { name: "作る" }));

  await waitFor(() => {
    expect(sent).toEqual([{ name: "二段ジャンプ" }]);
  });
  await waitFor(() => {
    expect(screen.queryByLabelText("名前")).toBeNull();
  });
});
