import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";

const Health = z.object({ status: z.literal("ok") }).openapi("Health");

const getHealth = createRoute({
  method: "get",
  path: "/health",
  operationId: "getHealth",
  responses: {
    200: {
      description: "The API is up.",
      content: { "application/json": { schema: Health } },
    },
  },
});

export const app = new OpenAPIHono<{ Bindings: Env }>().openapi(getHealth, (c) =>
  c.json({ status: "ok" } as const, 200),
);

/** Builds the OpenAPI 3.1 document for every route registered on `app`. */
export function buildOpenApiDocument() {
  return app.getOpenAPI31Document({
    openapi: "3.1.0",
    info: { title: "gesso API", version: "0.0.0" },
  });
}
