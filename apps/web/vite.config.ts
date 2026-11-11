import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
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
    environment: "happy-dom",
    include: ["src/**/*.test.{ts,tsx}"],
    // Tests stand in for the API with a fake fetch; this only has to be a valid base.
    env: { VITE_API_BASE_URL: "http://localhost/api" },
  },
});
