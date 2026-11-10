import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/** Where `pnpm --filter @gesso/api dev` serves the API (`dev.port` in apps/api/wrangler.jsonc). */
const apiDevOrigin = "http://localhost:8787";

export default defineConfig({
  plugins: [tanstackRouter({ target: "react", autoCodeSplitting: true }), react()],
  resolve: { tsconfigPaths: true },
  server: {
    proxy: {
      "/api": {
        target: apiDevOrigin,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
