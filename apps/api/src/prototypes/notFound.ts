import { z } from "@hono/zod-openapi";

const NotFound = z.object({ error: z.literal("not_found") }).openapi("NotFound");

/** The 404 a prototype route answers when the signed-in user has no such thing. */
export const notFoundResponse = {
  description: "The signed-in user has no such prototype, version, or file.",
  content: { "application/json": { schema: NotFound } },
} as const;

/** The body of `notFoundResponse`. */
export const notFound = { error: "not_found" } as const;
