import { sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Better Auth's tables, declared only as far as the app's tables refer to them. Better Auth
 * creates them (`pnpm --filter @gesso/api auth:migration`), so drizzle-kit does not read this
 * file.
 */
export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
});
