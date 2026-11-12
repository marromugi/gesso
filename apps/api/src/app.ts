import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import {
  authRoutePrefix,
  endBearerSession,
  getAuth,
  readSessionUser,
  toPublicAuthRequest,
} from "./auth/index.ts";
import { prototypeRoutes, versionRoutes } from "./prototypes/index.ts";

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

const User = z
  .object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    image: z.string().nullable(),
  })
  .openapi("User");

const Me = z.object({ user: z.union([User, z.null()]) }).openapi("Me");

const getMe = createRoute({
  method: "get",
  path: "/me",
  operationId: "getMe",
  responses: {
    200: {
      description: "The signed-in user, or `null` when the request carries no valid session.",
      content: { "application/json": { schema: Me } },
    },
  },
});

const deleteBearerSession = createRoute({
  method: "delete",
  path: "/session",
  operationId: "deleteBearerSession",
  responses: {
    204: { description: "The session sent as `Authorization: Bearer` has ended (or had already)." },
    401: { description: "The request carries no `Authorization: Bearer` token." },
  },
});

export const app = new OpenAPIHono<{ Bindings: Env }>()
  .openapi(getHealth, (c) => c.json({ status: "ok" } as const, 200))
  .openapi(getMe, async (c) => c.json({ user: await readSessionUser(c) }, 200))
  .openapi(deleteBearerSession, async (c) =>
    (await endBearerSession(c)) ? c.body(null, 204) : c.body(null, 401),
  )
  .route("/prototypes", prototypeRoutes)
  .route("/prototypes", versionRoutes);

app.on(
  "POST",
  [`${authRoutePrefix}/sign-in/*`, `${authRoutePrefix}/device/code`],
  async (c, next) => {
    // Each sign-in that is started writes its OAuth state or device code to D1, with or without a
    // session.
    const client = c.req.header("cf-connecting-ip") ?? "unknown";
    const { success } = await c.env.SIGN_IN_RATE_LIMIT.limit({ key: client });
    if (!success) return c.text("Too Many Requests", 429);
    return next();
  },
);

app.on(["GET", "POST"], `${authRoutePrefix}/*`, (c) =>
  getAuth(c.env).handler(toPublicAuthRequest(c.req.raw, c.env.AUTH_BASE_URL)),
);

/** Builds the OpenAPI 3.1 document for every route registered on `app`. */
export function buildOpenApiDocument() {
  return app.getOpenAPI31Document({
    openapi: "3.1.0",
    info: { title: "gesso API", version: "0.0.0" },
  });
}
