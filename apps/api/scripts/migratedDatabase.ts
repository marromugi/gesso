import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

export const migrationsDir = resolve(import.meta.dirname, "../migrations");

/** The `.sql` files in `migrations/`, in the order wrangler applies them. */
export function migrationFiles(): string[] {
  return readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => entry.name)
    .toSorted();
}

/** An in-memory SQLite database with every migration applied, as D1 has after a deploy. */
export function migratedDatabase(): DatabaseSync {
  const database = new DatabaseSync(":memory:");
  for (const file of migrationFiles()) {
    database.exec(readFileSync(resolve(migrationsDir, file), "utf8"));
  }
  return database;
}
