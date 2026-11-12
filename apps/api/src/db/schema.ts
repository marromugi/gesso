/**
 * The app's D1 tables. Changing them needs a migration: run
 * `pnpm --filter @gesso/api db:migration <name>` and commit what it writes to `migrations/`.
 * `pnpm build` fails while the two disagree (`scripts/db-schema.ts`).
 *
 * Export only the app's tables from this file; Better Auth's stay in `authTables.ts`.
 */
