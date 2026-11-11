import type { Meta, StoryObj } from "@storybook/react-vite";

import { AlignCenterIcon, CloseIcon, DiceIcon, GearIcon } from "./glyphs.tsx";
import { Icon } from "./Icon.tsx";

const meta = {
  component: Icon,
  args: { icon: CloseIcon },
} satisfies Meta<typeof Icon>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Close: Story = {};

export const Large: Story = { args: { size: "lg" } };

export const Dice: Story = { args: { icon: DiceIcon } };

/** One of the three for an image's alignment; left and right are drawn the same way. */
export const AlignCenter: Story = { args: { icon: AlignCenterIcon } };

export const Gear: Story = { args: { icon: GearIcon, size: "lg" } };
