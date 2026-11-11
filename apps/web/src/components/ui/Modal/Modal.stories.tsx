import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import { Button } from "@/components/ui/Button";

import { Modal } from "./Modal.tsx";

const meta = {
  component: Modal,
  parameters: { layout: "fullscreen" },
  args: {
    title: "プロジェクトを削除",
    open: true,
    onOpenChange: () => {},
    children: <p>このプロジェクトのタスクもすべて消えます。</p>,
  },
} satisfies Meta<typeof Modal>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** As tall as the screen allows, however little it holds. */
export const FullHeight: Story = { args: { height: "full" } };

function Opened() {
  const [open, setOpen] = useState(false);
  return (
    <div className="p-6">
      <Button type="button" onClick={() => setOpen(true)}>
        開く
      </Button>
      <Modal title="プロジェクトを削除" open={open} onOpenChange={setOpen}>
        <p>外を押すか、Escape か、閉じるボタンで閉じます。</p>
      </Modal>
    </div>
  );
}

/** Opens from a button, and gives the focus back to it on closing. */
export const FromButton: Story = { render: () => <Opened /> };
