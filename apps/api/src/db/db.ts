import { type DrizzleD1Database, drizzle } from "drizzle-orm/d1";

export type Db = DrizzleD1Database;

/** Drizzle over the Worker's D1 binding. */
export function getDb(d1: D1Database): Db {
  return drizzle(d1);
}
