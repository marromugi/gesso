import type { Preview } from "@storybook/react-vite";
import { QueryClientProvider } from "@tanstack/react-query";
import {
  RouterContextProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from "@tanstack/react-router";
import { type ReactNode, useState } from "react";
import { createQueryClient } from "@/lib/api";
import "../src/styles.css";

/** Gives each story its own QueryClient, as `main.tsx` gives one to the app. */
function StoryQueryClient({ children }: { children: ReactNode }) {
  const [client] = useState(createQueryClient);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

/**
 * Gives each story a router of its own at `/`, so that links render. Following a link changes
 * only the router's location; the story keeps the props it was given.
 */
function StoryRouter({ children }: { children: ReactNode }) {
  const [router] = useState(() =>
    createRouter({
      routeTree: createRootRoute(),
      history: createMemoryHistory({ initialEntries: ["/"] }),
    }),
  );
  return <RouterContextProvider router={router}>{children}</RouterContextProvider>;
}

const preview: Preview = {
  decorators: [
    (Story) => (
      <StoryQueryClient>
        <StoryRouter>
          <Story />
        </StoryRouter>
      </StoryQueryClient>
    ),
  ],
};

export default preview;
