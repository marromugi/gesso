import { sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Better Auth's tables, declared only as far as the app's tables refer to them. Better Auth's
 * own migrations create them (`pnpm --filter @gesso/api auth:migration <name>`).
 *
 * drizzle-kit writes migrations only for the tables `schema.ts` exports, so these must never be
 * exported from there: drizzle-kit would then create `user` again.
 */
export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
});

export const account = sqliteTable("account", {
  id: text("id").primaryKey(),
  /** The user's ID at the provider: GitHub's numeric user ID for GitHub. */
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId").notNull(),
});
