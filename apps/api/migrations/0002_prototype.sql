create table "prototype" (
  "id" text not null primary key,
  "ownerId" text not null references "user" ("id") on delete cascade,
  "name" text not null,
  "createdAt" text not null,
  "updatedAt" text not null
);

create index "prototype_ownerId_createdAt_idx" on "prototype" ("ownerId", "createdAt");
