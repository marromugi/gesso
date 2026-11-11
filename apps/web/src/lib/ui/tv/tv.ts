import { createTV } from "tailwind-variants";

export const tv = createTV({
  twMergeConfig: {
    extend: {
      theme: {
        radius: ["control", "container"],
        shadow: ["float"],
      },
    },
  },
});
