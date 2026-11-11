import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { user } from "./authTables.ts";

/**
 * The app's D1 tables. Changing them needs a migration: run
 * `pnpm --filter @gesso/api db:migration <name>` and commit what it writes to `migrations/`.
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
