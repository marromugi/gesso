import type { Meta, StoryObj } from "@storybook/react-vite";

import { Button } from "./Button.tsx";

const meta = {
  component: Button,
  args: { children: "保存" },
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Disabled: Story = { args: { disabled: true } };

export const Neutral: Story = { args: { tone: "neutral", children: "キャンセル" } };
