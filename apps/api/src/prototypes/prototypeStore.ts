/** What a prototype is for: a game mechanic, or a level (a stage). */
export const prototypeKinds = ["mechanic", "level"] as const;
export type PrototypeKind = (typeof prototypeKinds)[number];

/** Where a prototype stands: being built, being played, then adopted or dropped. */
export const prototypeStatuses = ["building", "testing", "adopted", "dropped"] as const;
export type PrototypeStatus = (typeof prototypeStatuses)[number];

/**
 * A playable experiment that checks one question about the game, without the artwork. It
 * belongs to the person who made it and stands on its own, apart from any project.
 */
export type Prototype = {
  id: string;
  title: string;
  /** What playing it is meant to find out. */
  question: string;
  kind: PrototypeKind;
  status: PrototypeStatus;
  createdAt: string;
  updatedAt: string;
};

export type NewPrototype = Pick<Prototype, "title" | "question" | "kind">;

type PrototypeRow = Prototype & { ownerId: string };

/** The owner's prototypes, newest first. */
export async function listPrototypes(db: D1Database, ownerId: string): Promise<Prototype[]> {
  const { results } = await db
    .prepare(
      `select "id", "title", "question", "kind", "status", "createdAt", "updatedAt"
       from "prototype" where "ownerId" = ? order by "createdAt" desc, "id" desc`,
    )
    .bind(ownerId)
    .all<Prototype>();
  return results;
}

/** Records a new prototype for `ownerId`. It starts as being built. */
export async function createPrototype(
  db: D1Database,
  ownerId: string,
  input: NewPrototype,
  now: Date,
): Promise<Prototype> {
  const at = now.toISOString();
  const row: PrototypeRow = {
    id: crypto.randomUUID(),
    ownerId,
    title: input.title,
    question: input.question,
    kind: input.kind,
    status: "building",
    createdAt: at,
    updatedAt: at,
  };
  await db
    .prepare(
      `insert into "prototype" ("id", "ownerId", "title", "question", "kind", "status", "createdAt", "updatedAt")
       values (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      row.id,
      row.ownerId,
      row.title,
      row.question,
      row.kind,
      row.status,
      row.createdAt,
      row.updatedAt,
    )
    .run();
  const { ownerId: _owner, ...prototype } = row;
  return prototype;
}
