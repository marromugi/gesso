/**
 * A playable experiment that checks a game mechanic or a level, without the artwork. It
 * belongs to the person who made it and stands on its own, apart from any project.
 */
export type Prototype = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type NewPrototype = Pick<Prototype, "name">;

/** The owner's prototypes, newest first. */
export async function listPrototypes(db: D1Database, ownerId: string): Promise<Prototype[]> {
  const { results } = await db
    .prepare(
      `select "id", "name", "createdAt", "updatedAt"
       from "prototype" where "ownerId" = ? order by "createdAt" desc, "id" desc`,
    )
    .bind(ownerId)
    .all<Prototype>();
  return results;
}

/** Records a new prototype for `ownerId`. */
export async function createPrototype(
  db: D1Database,
  ownerId: string,
  input: NewPrototype,
  now: Date,
): Promise<Prototype> {
  const at = now.toISOString();
  const prototype: Prototype = {
    id: crypto.randomUUID(),
    name: input.name,
    createdAt: at,
    updatedAt: at,
  };
  await db
    .prepare(
      `insert into "prototype" ("id", "ownerId", "name", "createdAt", "updatedAt")
       values (?, ?, ?, ?, ?)`,
    )
    .bind(prototype.id, ownerId, prototype.name, prototype.createdAt, prototype.updatedAt)
    .run();
  return prototype;
}
