import type { Preview } from "@storybook/react-vite";
import { QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { createQueryClient } from "@/lib/api";

/** Gives each story its own QueryClient, as `main.tsx` gives one to the app. */
function StoryQueryClient({ children }: { children: ReactNode }) {
  const [client] = useState(createQueryClient);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const preview: Preview = {
  decorators: [
    (Story) => (
      <StoryQueryClient>
        <Story />
      </StoryQueryClient>
    ),
  ],
};

export default preview;
