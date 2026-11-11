import type { Meta, StoryObj } from "@storybook/react-vite";

import { Button } from "@/components/ui/Button";
import { ToastRegion } from "@/components/ui/ToastRegion";
import { toastError, toastNotice } from "@/lib/ui/toast";

import { Toast } from "./Toast.tsx";

const meta = {
  component: Toast,
  args: {
    tone: "error",
    visible: true,
    onDismiss: () => {},
    role: "alert",
    "aria-live": "assertive",
    children: "フォントを読み込めませんでした。",
  },
} satisfies Meta<typeof Toast>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Error: Story = {};

export const Notice: Story = {
  args: { tone: "notice", role: "status", "aria-live": "polite", children: "新しい版があります。" },
};

function Raised() {
  return (
    <div className="flex gap-3 p-6">
      <Button type="button" onClick={() => toastError("フォントを読み込めませんでした。")}>
        エラー
      </Button>
      <Button type="button" tone="neutral" onClick={() => toastNotice("新しい版があります。")}>
        お知らせ
      </Button>
      <ToastRegion />
    </div>
  );
}

/** Raised from anywhere, shown at the bottom center, gone after five seconds. */
export const FromAnywhere: Story = { render: () => <Raised /> };
