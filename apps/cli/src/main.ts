#!/usr/bin/env node

// Help and errors read as plain text when the output isn't a terminal (Claude Code reads it).
// citty decides on colour once, when it is first loaded, so this comes before loading it.
if (!process.stdout.isTTY) process.env.NO_COLOR ??= "1";

const { defineCommand, runMain } = await import("citty");
const { list } = await import("./commands/list.ts");
const { login } = await import("./commands/login.ts");
const { logout } = await import("./commands/logout.ts");
const { create } = await import("./commands/new.ts");
const { notes } = await import("./commands/notes.ts");
const { pull } = await import("./commands/pull.ts");
const { push } = await import("./commands/push.ts");
const { serve } = await import("./commands/serve.ts");
const { versions } = await import("./commands/versions.ts");

const main = defineCommand({
  meta: {
    name: "gesso",
    description: "プロトタイプの版を、gesso と手元の git のリポジトリの間でやりとりする",
  },
  subCommands: { login, logout, list, versions, notes, new: create, pull, push, serve },
});

await runMain(main);
