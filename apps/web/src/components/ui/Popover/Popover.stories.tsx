import type { Meta, StoryObj } from "@storybook/react-vite";

import { Button } from "@/components/ui/Button";

import { Popover } from "./Popover.tsx";

const meta: Meta<typeof Popover> = {
  component: Popover,
  args: {
    defaultOpen: true,
    trigger: <Button tone="neutral">開く</Button>,
    children: (
      <div className="rounded-container container-p-3 bg-surface-raised shadow-float">
        ポップオーバーの中身
      </div>
    ),
  },
  decorators: [
    (Story) => (
      <div className="flex h-96 items-center justify-center">
        <Story />
      </div>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof Popover>;

export const BottomStart: Story = {};

export const Closed: Story = { args: { defaultOpen: false } };

export const TopStart: Story = { args: { direction: "top", align: "start" } };

/** The trigger sits in the bottom-left corner, so the popover moves to stay in view. */
export const KeptInView: Story = {
  decorators: [
    (Story) => (
      <div className="fixed bottom-2 left-2">
        <Story />
      </div>
    ),
  ],
};
