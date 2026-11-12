import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { type SignedInVariables, requireUser, unauthorizedResponse } from "../auth/index.ts";
import { getDb } from "../db/index.ts";
import { createPrototype, listPrototypes } from "./prototypeStore.ts";

/** The longest name a prototype takes, in characters. */
const nameMaxLength = 100;

const Prototype = z
  .object({
    id: z.string(),
    name: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi("Prototype");

const PrototypeList = z.object({ prototypes: z.array(Prototype) }).openapi("PrototypeList");

const NewPrototype = z
  .object({ name: z.string().trim().min(1).max(nameMaxLength) })
  .openapi("NewPrototype");

const listPrototypesRoute = createRoute({
  method: "get",
  path: "/",
  operationId: "listPrototypes",
  middleware: [requireUser] as const,
  responses: {
    200: {
      description: "The signed-in user's prototypes, newest first.",
      content: { "application/json": { schema: PrototypeList } },
    },
    401: unauthorizedResponse,
  },
});

const createPrototypeRoute = createRoute({
  method: "post",
  path: "/",
  operationId: "createPrototype",
  middleware: [requireUser] as const,
  request: {
    body: { required: true, content: { "application/json": { schema: NewPrototype } } },
  },
  responses: {
    201: {
      description: "The prototype, created.",
      content: { "application/json": { schema: Prototype } },
    },
    400: { description: "The body is not a valid new prototype." },
    401: unauthorizedResponse,
  },
});

/** Prototypes of the signed-in user, mounted at `/prototypes`. */
export const prototypeRoutes = new OpenAPIHono<{ Bindings: Env; Variables: SignedInVariables }>()
  .openapi(listPrototypesRoute, async (c) => {
    const prototypes = await listPrototypes(getDb(c.env.DB), c.var.user.id);
    return c.json({ prototypes }, 200);
  })
  .openapi(createPrototypeRoute, async (c) => {
    const prototype = await createPrototype(
      getDb(c.env.DB),
      c.var.user.id,
      c.req.valid("json"),
      new Date(),
    );
    return c.json(prototype, 201);
  });
