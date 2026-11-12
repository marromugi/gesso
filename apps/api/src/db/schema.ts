import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { user } from "./authTables.ts";

/**
 * The app's D1 tables. Changing them needs a migration: run
 * `pnpm --filter @gesso/api db:migration <name>` and commit what it writes to `migrations/`.
 * `pnpm build` fails while the two disagree (`scripts/db-schema.ts`).
 *
 * Export only the app's tables from this file; Better Auth's stay in `authTables.ts`.
 */

export const prototype = sqliteTable(
  "prototype",
  {
    id: text("id").primaryKey(),
    ownerId: text("ownerId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: text("createdAt").notNull(),
    updatedAt: text("updatedAt").notNull(),
  },
  (table) => [index("prototype_ownerId_createdAt_idx").on(table.ownerId, table.createdAt)],
);

/**
 * File content uploaded for a prototype, kept in R2 under `prototypes/<prototypeId>/<hash>`.
 * Versions refer to it by hash, so content that doesn't change between versions is stored once.
 */
export const prototypeFileContent = sqliteTable(
  "prototypeFileContent",
  {
    prototypeId: text("prototypeId")
      .notNull()
      .references(() => prototype.id, { onDelete: "cascade" }),
    /** SHA-256 of the content, as lowercase hex. */
    hash: text("hash").notNull(),
    /** In bytes. */
    size: integer("size").notNull(),
    createdAt: text("createdAt").notNull(),
  },
  (table) => [primaryKey({ columns: [table.prototypeId, table.hash] })],
);

/** A snapshot of a prototype's files, which never change once made, with a note about it. */
export const prototypeVersion = sqliteTable(
  "prototypeVersion",
  {
    id: text("id").primaryKey(),
    prototypeId: text("prototypeId")
      .notNull()
      .references(() => prototype.id, { onDelete: "cascade" }),
    /** 1 for a prototype's first version, then one more for each version after. */
    number: integer("number").notNull(),
    /** The git commit the version was made from, when the client sent one. */
    sourceCommit: text("sourceCommit"),
    /** The branch that commit was on, when it was on one. */
    sourceBranch: text("sourceBranch"),
    /** What the person noticed playing it, for whoever works on the next version; "" for none. */
    note: text("note").notNull().default(""),
    /** When the note was last written; `null` until it is. */
    noteUpdatedAt: text("noteUpdatedAt"),
    createdAt: text("createdAt").notNull(),
  },
  (table) => [
    uniqueIndex("prototypeVersion_prototypeId_number_idx").on(table.prototypeId, table.number),
  ],
);

/** One file of a version: where it sits and which content it has. */
export const prototypeVersionFile = sqliteTable(
  "prototypeVersionFile",
  {
    versionId: text("versionId")
      .notNull()
      .references(() => prototypeVersion.id, { onDelete: "cascade" }),
    path: text("path").notNull(),
    hash: text("hash").notNull(),
  },
  (table) => [primaryKey({ columns: [table.versionId, table.path] })],
);

/**
 * Lets whoever holds `token` play one version until `expiresAt`, from the play Worker
 * (`src/play`), which has no session to check.
 */
export const prototypePlayToken = sqliteTable(
  "prototypePlayToken",
  {
    token: text("token").primaryKey(),
    versionId: text("versionId")
      .notNull()
      .references(() => prototypeVersion.id, { onDelete: "cascade" }),
    expiresAt: text("expiresAt").notNull(),
    createdAt: text("createdAt").notNull(),
  },
  (table) => [index("prototypePlayToken_expiresAt_idx").on(table.expiresAt)],
);
