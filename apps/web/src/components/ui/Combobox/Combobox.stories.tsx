import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import { Combobox } from "./Combobox.tsx";

const fonts = [
  { value: "noto-sans-jp", label: "Noto Sans JP" },
  { value: "noto-serif-jp", label: "Noto Serif JP" },
  { value: "klee-one", label: "Klee One" },
  { value: "zen-maru-gothic", label: "Zen Maru Gothic" },
  { value: "shippori-mincho", label: "Shippori Mincho" },
];

function Chosen({ options }: { options: typeof fonts }) {
  const [value, setValue] = useState<string | null>("klee-one");
  return (
    <div className="w-80">
      <Combobox label="フォント" options={options} value={value} onChange={setValue} />
    </div>
  );
}

const meta = {
  component: Combobox,
  args: { label: "フォント", options: fonts, value: null, onChange: () => {} },
} satisfies Meta<typeof Combobox>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = { render: () => <Chosen options={fonts} /> };

/** More options than the list draws: the rest are counted under it. */
export const ManyOptions: Story = {
  render: () => (
    <Chosen
      options={Array.from({ length: 250 }, (_, i) => ({
        value: `font-${i}`,
        label: `Font ${i + 1}`,
      }))}
    />
  ),
};
