create table "prototype" (
  "id" text not null primary key,
  "ownerId" text not null references "user" ("id") on delete cascade,
  "title" text not null,
  "question" text not null,
  "kind" text not null check ("kind" in ('mechanic', 'level')),
  "status" text not null check ("status" in ('building', 'testing', 'adopted', 'dropped')),
  "createdAt" text not null,
  "updatedAt" text not null
);

create index "prototype_ownerId_createdAt_idx" on "prototype" ("ownerId", "createdAt");
