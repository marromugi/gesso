import { defineConfig } from "orval";

export default defineConfig({
  gesso: {
    input: "./node_modules/@gesso/api/openapi.json",
    output: {
      target: "./src/lib/api/generated/gesso.ts",
      client: "react-query",
      httpClient: "fetch",
      override: {
        mutator: { path: "./src/lib/api/fetchApi/fetchApi.ts", name: "fetchApi" },
        fetch: { includeHttpResponseReturnType: false },
      },
      mock: { path: "./src/lib/apiMocks/generated", generators: [{ type: "msw" }] },
    },
  },
});
