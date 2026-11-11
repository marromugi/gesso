/**
 * Keeps the D1 migrations in `migrations/` in step with what Better Auth needs.
 *
 * Applies every migration to an in-memory SQLite database, then asks Better Auth what is missing.
 * - `node scripts/auth-schema.ts check`: fails when something is missing.
 * - `node scripts/auth-schema.ts write <name>`: writes the missing SQL as the next migration.
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { getMigrations } from "better-auth/db/migration";
import { authOptions } from "../src/auth/authOptions.ts";

const migrationsDir = resolve(import.meta.dirname, "../migrations");

/** Stand-in values: the schema does not depend on them. */
const placeholderEnv = {
  AUTH_BASE_URL: "http://localhost/api/auth",
  BETTER_AUTH_SECRET: "placeholder-secret-for-schema-generation-only",
  GITHUB_CLIENT_ID: "placeholder",
  GITHUB_CLIENT_SECRET: "placeholder",
};

const migrationFiles = readdirSync(migrationsDir, { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
  .map((entry) => entry.name)
  .toSorted();

const database = new DatabaseSync(":memory:");
for (const file of migrationFiles) {
  database.exec(readFileSync(resolve(migrationsDir, file), "utf8"));
}

const { toBeCreated, toBeAdded, compileMigrations } = await getMigrations({
  ...authOptions(placeholderEnv),
  database,
});
const missing = toBeCreated.length > 0 || toBeAdded.length > 0;

const [command, name] = process.argv.slice(2);
if (command === "check") {
  if (missing) {
    console.error(
      "migrations/ lacks tables or columns Better Auth needs. Run `pnpm --filter @gesso/api auth:migration <name>`.",
    );
    process.exit(1);
  }
} else if (command === "write" && name) {
  if (!missing) {
    console.log("migrations/ already has everything Better Auth needs.");
  } else {
    const number = String(migrationFiles.length + 1).padStart(4, "0");
    const path = resolve(migrationsDir, `${number}_${name}.sql`);
    writeFileSync(path, `${(await compileMigrations()).trim()}\n`);
    console.log(`Wrote ${path}`);
  }
} else {
  console.error("Usage: node scripts/auth-schema.ts check | write <name>");
  process.exit(2);
}
