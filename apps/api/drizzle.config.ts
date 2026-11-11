import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  // Only the tables this file exports; Better Auth's come from its own migrations.
  schema: "./src/db/schema.ts",
  // The same directory wrangler applies to D1. A timestamp prefix sorts these after the
  // `0001_` migration already applied and in the order they were made.
  out: "./migrations",
  migrations: { prefix: "timestamp" },
});
