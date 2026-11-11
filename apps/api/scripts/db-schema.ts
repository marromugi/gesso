/**
 * Fails when the tables `migrations/` creates differ from the Drizzle tables in
 * `src/db/schema.ts`: a schema change whose migration was not written
 * (`pnpm --filter @gesso/api db:migration <name>`), or a migration edited by hand.
 *
 * Applies every migration to an in-memory SQLite database and compares, for each table in the
 * schema, its columns (type, NOT NULL, primary key), indexes, and foreign keys.
 */
import { getTableConfig } from "drizzle-orm/sqlite-core";
import { SQLiteTable } from "drizzle-orm/sqlite-core";
import * as schema from "../src/db/schema.ts";
import { migratedDatabase } from "./migratedDatabase.ts";

const database = migratedDatabase();
const problems: string[] = [];

/** The rows a `pragma` returns, each value read as text. */
function pragma(statement: string): Record<string, string>[] {
  return database
    .prepare(statement)
    .all()
    .map((row) =>
      Object.fromEntries(Object.entries(row).map(([key, value]) => [key, String(value)])),
    );
}

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);
const byFrom = (a: { from: string }, b: { from: string }) => a.from.localeCompare(b.from);

/** Compares two descriptions of the same thing, noting a problem when they differ. */
function same(what: string, inMigrations: unknown, inSchema: unknown) {
  const a = JSON.stringify(inMigrations);
  const b = JSON.stringify(inSchema);
  if (a !== b) problems.push(`${what}\n  migrations: ${a}\n  schema.ts:  ${b}`);
}

const tables = Object.values(schema).filter((value) => value instanceof SQLiteTable);

for (const table of tables) {
  const config = getTableConfig(table);
  const name = config.name;

  const columns = pragma(`pragma table_info("${name}")`);
  if (columns.length === 0) {
    problems.push(`table ${name} is in schema.ts but no migration creates it`);
    continue;
  }
  same(
    `columns of ${name}`,
    columns
      .map((column) => ({
        name: column.name ?? "",
        type: (column.type ?? "").toLowerCase(),
        notNull: column.notnull === "1" || column.pk !== "0",
        primaryKey: column.pk !== "0",
      }))
      .toSorted(byName),
    config.columns
      .map((column) => ({
        name: column.name,
        type: column.getSQLType().toLowerCase(),
        notNull: column.notNull || column.primary,
        primaryKey: column.primary,
      }))
      .toSorted(byName),
  );

  const indexes = pragma(`pragma index_list("${name}")`)
    .filter((index) => index.origin === "c")
    .map((index) => ({
      name: index.name ?? "",
      unique: index.unique === "1",
      columns: pragma(`pragma index_info("${index.name}")`).map((column) => column.name),
    }))
    .toSorted(byName);
  same(
    `indexes of ${name}`,
    indexes,
    config.indexes
      .map((index) => ({
        name: index.config.name,
        unique: index.config.unique,
        columns: index.config.columns.map((column) => ("name" in column ? column.name : "?")),
      }))
      .toSorted(byName),
  );

  same(
    `foreign keys of ${name}`,
    pragma(`pragma foreign_key_list("${name}")`)
      .map((key) => ({
        from: key.from ?? "",
        table: key.table,
        to: key.to,
        onDelete: (key.on_delete ?? "").toLowerCase(),
      }))
      .toSorted(byFrom),
    config.foreignKeys
      .flatMap((key) => {
        const reference = key.reference();
        return reference.columns.map((column, at) => ({
          from: column.name,
          table: getTableConfig(reference.foreignTable).name,
          to: reference.foreignColumns[at]?.name ?? "?",
          onDelete: (key.onDelete ?? "no action").toLowerCase(),
        }));
      })
      .toSorted(byFrom),
  );
}

if (problems.length > 0) {
  console.error(
    `migrations/ and src/db/schema.ts disagree. Run \`pnpm --filter @gesso/api db:migration <name>\`.\n\n${problems.join("\n\n")}`,
  );
  process.exit(1);
}
