import { and, desc, eq } from "drizzle-orm";
import { type Db, tables } from "../db/index.ts";

const { prototype: prototypeTable } = tables;

/**
 * A playable experiment that checks a game mechanic or a level, without the artwork. It
 * belongs to the person who made it and stands on its own, apart from any project.
 */
export type Prototype = Omit<typeof prototypeTable.$inferSelect, "ownerId">;

export type NewPrototype = Pick<Prototype, "name">;

/** What is read for each prototype: every column but the owner. */
const prototypeColumns = {
  id: prototypeTable.id,
  name: prototypeTable.name,
  createdAt: prototypeTable.createdAt,
  updatedAt: prototypeTable.updatedAt,
};

/** The owner's prototypes, newest first. */
export async function listPrototypes(db: Db, ownerId: string): Promise<Prototype[]> {
  return db
    .select(prototypeColumns)
    .from(prototypeTable)
    .where(eq(prototypeTable.ownerId, ownerId))
    .orderBy(desc(prototypeTable.createdAt), desc(prototypeTable.id));
}

/** The owner's prototype, or `null` when there is no such prototype of theirs. */
export async function getPrototype(db: Db, ownerId: string, id: string): Promise<Prototype | null> {
  const [found] = await db
    .select(prototypeColumns)
    .from(prototypeTable)
    .where(and(eq(prototypeTable.id, id), eq(prototypeTable.ownerId, ownerId)));
  return found ?? null;
}

/** Records a new prototype for `ownerId`. */
export async function createPrototype(
  db: Db,
  ownerId: string,
  input: NewPrototype,
  now: Date,
): Promise<Prototype> {
  const at = now.toISOString();
  const [created] = await db
    .insert(prototypeTable)
    .values({ id: crypto.randomUUID(), ownerId, name: input.name, createdAt: at, updatedAt: at })
    .returning(prototypeColumns);
  if (!created) throw new Error("D1 returned no row for the prototype just inserted");
  return created;
}
