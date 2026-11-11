import type { Meta, StoryObj } from "@storybook/react-vite";

import { CloseIcon } from "@/components/ui/Icon";

import { IconButton } from "./IconButton.tsx";

const meta = {
  component: IconButton,
  args: { icon: CloseIcon, label: "閉じる", type: "button" },
} satisfies Meta<typeof IconButton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
