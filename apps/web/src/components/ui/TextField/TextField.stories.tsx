import type { Meta, StoryObj } from "@storybook/react-vite";

import { TextField } from "./TextField.tsx";

const meta = {
  component: TextField,
  args: { name: "projectName", label: "プロジェクト名" },
} satisfies Meta<typeof TextField>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithError: Story = { args: { error: "プロジェクト名を入力してください。" } };
