import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { type SignedInVariables, requireUser, unauthorizedResponse } from "../auth/index.ts";
import { getDb } from "../db/index.ts";
import {
  hashPattern,
  isFilePath,
  maxFileSize,
  maxPathLength,
  versionFilesProblem,
} from "./versionFiles.ts";
import {
  createVersion,
  getVersion,
  listVersions,
  readFileContent,
  saveFileContent,
} from "./versionStore.ts";

const Hash = z.string().regex(hashPattern).openapi({ description: "SHA-256 as lowercase hex." });

const PrototypeParams = z.object({ prototypeId: z.string() });
const FileParams = PrototypeParams.extend({ hash: Hash });
const VersionParams = PrototypeParams.extend({ number: z.coerce.number().int().min(1) });

const NotFound = z.object({ error: z.literal("not_found") }).openapi("NotFound");

const notFoundResponse = {
  description: "The signed-in user has no such prototype, version, or file.",
  content: { "application/json": { schema: NotFound } },
} as const;

const PrototypeVersion = z
  .object({ number: z.number().int(), createdAt: z.string() })
  .openapi("PrototypeVersion");

const PrototypeVersionList = z
  .object({ versions: z.array(PrototypeVersion) })
  .openapi("PrototypeVersionList");

const VersionFileEntry = z
  .object({ path: z.string(), hash: Hash, size: z.number().int() })
  .openapi("VersionFileEntry");

const PrototypeVersionDetail = PrototypeVersion.extend({
  files: z.array(VersionFileEntry),
}).openapi("PrototypeVersionDetail");

const NewVersionFile = z.object({
  path: z.string().max(maxPathLength).refine(isFilePath, {
    message: "a relative path with no empty, `.` or `..` segment",
  }),
  hash: Hash,
});

const NewPrototypeVersion = z
  .object({
    files: z.array(NewVersionFile).superRefine((files, context) => {
      const problem = versionFilesProblem(files);
      if (problem !== null) context.addIssue({ code: "custom", message: problem });
    }),
  })
  .openapi("NewPrototypeVersion");

const MissingContent = z
  .object({ error: z.literal("missing_content"), hashes: z.array(Hash) })
  .openapi("MissingContent");

const HashMismatch = z
  .object({ error: z.literal("hash_mismatch"), actual: Hash })
  .openapi("HashMismatch");

const putFileContentRoute = createRoute({
  method: "put",
  path: "/{prototypeId}/files/{hash}",
  operationId: "putPrototypeFileContent",
  middleware: [requireUser] as const,
  request: {
    params: FileParams,
    body: {
      required: true,
      content: { "application/octet-stream": { schema: z.string().openapi({ format: "binary" }) } },
    },
  },
  responses: {
    204: { description: "The content is saved under its hash (or already was)." },
    400: {
      description: "The content's SHA-256 is not the hash in the path.",
      content: { "application/json": { schema: HashMismatch } },
    },
    401: unauthorizedResponse,
    404: notFoundResponse,
    411: { description: "The request has no Content-Length." },
    413: { description: `The content is larger than ${maxFileSize} bytes.` },
  },
});

const getFileContentRoute = createRoute({
  method: "get",
  path: "/{prototypeId}/files/{hash}",
  operationId: "getPrototypeFileContent",
  middleware: [requireUser] as const,
  request: { params: FileParams },
  responses: {
    200: {
      description: "The content, as a download: it is never run on this origin.",
      content: { "application/octet-stream": { schema: z.string().openapi({ format: "binary" }) } },
    },
    401: unauthorizedResponse,
    404: notFoundResponse,
  },
});

const listVersionsRoute = createRoute({
  method: "get",
  path: "/{prototypeId}/versions",
  operationId: "listPrototypeVersions",
  middleware: [requireUser] as const,
  request: { params: PrototypeParams },
  responses: {
    200: {
      description: "The prototype's versions, newest first.",
      content: { "application/json": { schema: PrototypeVersionList } },
    },
    401: unauthorizedResponse,
    404: notFoundResponse,
  },
});

const createVersionRoute = createRoute({
  method: "post",
  path: "/{prototypeId}/versions",
  operationId: "createPrototypeVersion",
  middleware: [requireUser] as const,
  request: {
    params: PrototypeParams,
    body: { required: true, content: { "application/json": { schema: NewPrototypeVersion } } },
  },
  responses: {
    201: {
      description: "The prototype's next version, made from the files.",
      content: { "application/json": { schema: PrototypeVersionDetail } },
    },
    400: { description: "The body is not a valid list of files." },
    401: unauthorizedResponse,
    404: notFoundResponse,
    409: {
      description: "Some content has not been uploaded yet; upload these and send again.",
      content: { "application/json": { schema: MissingContent } },
    },
  },
});

const getVersionRoute = createRoute({
  method: "get",
  path: "/{prototypeId}/versions/{number}",
  operationId: "getPrototypeVersion",
  middleware: [requireUser] as const,
  request: { params: VersionParams },
  responses: {
    200: {
      description: "The version with its files, sorted by path.",
      content: { "application/json": { schema: PrototypeVersionDetail } },
    },
    401: unauthorizedResponse,
    404: notFoundResponse,
  },
});

const notFound = { error: "not_found" } as const;

/**
 * Versions of the signed-in user's prototypes and the file content they are made of, mounted at
 * `/prototypes`. A version is made by uploading each file's content under its hash, then listing
 * the paths and hashes.
 */
export const versionRoutes = new OpenAPIHono<{ Bindings: Env; Variables: SignedInVariables }>()
  .openapi(putFileContentRoute, async (c) => {
    const { prototypeId, hash } = c.req.valid("param");
    const length = c.req.header("content-length");
    if (length === undefined) return c.body(null, 411);
    if (Number(length) > maxFileSize) return c.body(null, 413);
    const content = await c.req.arrayBuffer();
    if (content.byteLength > maxFileSize) return c.body(null, 413);
    const result = await saveFileContent(
      getDb(c.env.DB),
      c.env.PROTOTYPE_FILES,
      c.var.user.id,
      prototypeId,
      hash,
      content,
      new Date(),
    );
    if (result.kind === "notFound") return c.json(notFound, 404);
    if (result.kind === "hashMismatch") {
      return c.json({ error: "hash_mismatch", actual: result.actual } as const, 400);
    }
    return c.body(null, 204);
  })
  .openapi(getFileContentRoute, async (c) => {
    const { prototypeId, hash } = c.req.valid("param");
    const content = await readFileContent(
      getDb(c.env.DB),
      c.env.PROTOTYPE_FILES,
      c.var.user.id,
      prototypeId,
      hash,
    );
    if (!content) return c.json(notFound, 404);
    return c.body(content.body, 200, {
      "content-type": "application/octet-stream",
      // Prototype code must not run with this origin's session.
      "content-disposition": "attachment",
      "x-content-type-options": "nosniff",
      // Content under a hash never changes.
      "cache-control": "private, max-age=31536000, immutable",
    });
  })
  .openapi(listVersionsRoute, async (c) => {
    const { prototypeId } = c.req.valid("param");
    const versions = await listVersions(getDb(c.env.DB), c.var.user.id, prototypeId);
    if (!versions) return c.json(notFound, 404);
    return c.json({ versions }, 200);
  })
  .openapi(createVersionRoute, async (c) => {
    const { prototypeId } = c.req.valid("param");
    const result = await createVersion(
      getDb(c.env.DB),
      c.var.user.id,
      prototypeId,
      c.req.valid("json").files,
      new Date(),
    );
    if (result.kind === "notFound") return c.json(notFound, 404);
    if (result.kind === "missingContent") {
      return c.json({ error: "missing_content", hashes: result.hashes } as const, 409);
    }
    return c.json(result.version, 201);
  })
  .openapi(getVersionRoute, async (c) => {
    const { prototypeId, number } = c.req.valid("param");
    const version = await getVersion(getDb(c.env.DB), c.var.user.id, prototypeId, number);
    if (!version) return c.json(notFound, 404);
    return c.json(version, 200);
  });
