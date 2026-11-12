#!/usr/bin/env node

// Help and errors read as plain text when the output isn't a terminal (Claude Code reads it).
// citty decides on colour once, when it is first loaded, so this comes before loading it.
if (!process.stdout.isTTY) process.env.NO_COLOR ??= "1";

const { defineCommand, runMain } = await import("citty");
const { login } = await import("./commands/login.ts");
const { logout } = await import("./commands/logout.ts");

const main = defineCommand({
  meta: { name: "gesso", description: "gesso にサインインする" },
  subCommands: { login, logout },
});

await runMain(main);
