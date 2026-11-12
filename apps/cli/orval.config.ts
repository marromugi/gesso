import { defineConfig } from "orval";

export default defineConfig({
  gesso: {
    input: "./node_modules/@gesso/api/openapi.json",
    output: {
      target: "./src/generated/api.ts",
      client: "fetch",
      httpClient: "fetch",
      override: {
        mutator: { path: "./src/api/request.ts", name: "request" },
        // Each call answers with its status and the body typed for that status.
        fetch: { includeHttpResponseReturnType: true },
      },
    },
  },
});
