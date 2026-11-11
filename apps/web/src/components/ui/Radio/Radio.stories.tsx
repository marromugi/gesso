import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import { Radio } from "./Radio.tsx";

const meta = {
  component: Radio,
  args: { name: "language", value: "ja", label: "日本語" },
} satisfies Meta<typeof Radio>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Checked: Story = { args: { checked: true, onChange: () => {} } };

export const Disabled: Story = { args: { disabled: true } };

function Group() {
  const [value, setValue] = useState("ja");
  return (
    <fieldset className="flex flex-col gap-3">
      {[
        { value: "ja", label: "日本語" },
        { value: "en", label: "English" },
      ].map((option) => (
        <Radio
          key={option.value}
          name="language"
          value={option.value}
          label={option.label}
          checked={value === option.value}
          onChange={() => setValue(option.value)}
        />
      ))}
    </fieldset>
  );
}

/** Choosing one moves the dot to it. */
export const InGroup: Story = { render: () => <Group /> };
