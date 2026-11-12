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
        operations: {
          // A play URL is fetched whenever a version is shown, though the API makes a new token
          // each time, so it is a query.
          createPrototypePlayUrl: { query: { useQuery: true, useMutation: false } },
        },
      },
      mock: { path: "./src/lib/apiMocks/generated", generators: [{ type: "msw" }] },
    },
  },
  gessoSchemas: {
    input: "./node_modules/@gesso/api/openapi.json",
    output: {
      target: "./src/lib/api/generated/gesso.valibot.ts",
      client: "valibot",
    },
  },
});
