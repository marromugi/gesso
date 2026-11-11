import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

/** Where `pnpm --filter @gesso/api dev` serves the API (`dev.port` in apps/api/wrangler.jsonc). */
const apiDevOrigin = "http://localhost:8787";

export default defineConfig({
  plugins: [tanstackRouter({ target: "react", autoCodeSplitting: true }), react(), tailwindcss()],
  resolve: { tsconfigPaths: true },
  server: {
    proxy: {
      "/api": {
        target: apiDevOrigin,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
  test: {
    // The base `fetchApi` calls, as in `.env.development`; story tests answer it through MSW.
    env: { VITE_API_BASE_URL: "/api" },
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "happy-dom",
          include: ["src/**/*.test.{ts,tsx}"],
        },
      },
      {
        extends: true,
        // Runs every story, with its `play` function, in Chromium.
        plugins: [storybookTest({ configDir: ".storybook" })],
        test: {
          name: "storybook",
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({}),
            instances: [{ browser: "chromium" }],
          },
        },
      },
    ],
  },
});
