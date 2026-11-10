import { defineConfig } from "orval";

export default defineConfig({
  gesso: {
    input: "./node_modules/@gesso/api/openapi.json",
    output: {
      target: "./src/lib/api/generated/gesso.ts",
      client: "fetch",
      override: {
        mutator: { path: "./src/lib/api/fetchApi/fetchApi.ts", name: "fetchApi" },
        fetch: { includeHttpResponseReturnType: false },
      },
    },
  },
});
