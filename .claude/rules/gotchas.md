# Project Gotchas

## Overview

Project quirks and common pitfalls when developing in the TenT Technical Dashboard monorepo.

## Quirks & Pitfalls

- **Stale file index:** Glob/search can surface files not on disk (removed routes, old `__tests__/`, `vercel.json`). Verify with `find` or `ls` before assuming a file exists.
- **Backend proxy:** Backend uses `proxy.ts` (Next.js 16 proxy convention), NOT `middleware.ts`. Do not create middleware.
- **Proxy filename:** Next.js 16 requires the file to be named `proxy.ts` with `export default async function proxy` — renaming the handler while keeping `middleware.ts` still triggers the deprecation warning.
- **Public routes in proxy:** Public paths are listed inline in `proxy.ts` (not `publicAuthPaths` helpers). Add new public routes there.
- **Database target:** `docker-compose.yml` may reference MySQL but the project uses PostgreSQL. Ignore MySQL references.
- **Package names:** Actual DB package is `packages/db` (`@repo/db`), not `packages/database`.
- **DB scripts:** No root `db:*` scripts — run via `yarn workspace @repo/db db:generate|db:migrate|db:seed|db:reset`.
- **Prisma config:** Root `prisma.config.ts` and `packages/db/prisma.config.ts` both exist; schema lives under `packages/db/src/prisma/`.
- **Allowed hosts:** `allowedHosts` in `proxy.ts` must include any dev hostname you use.
- **Timesheets:** Prisma schema has `Timesheet` / `TimesheetEntry` models; backend API routes are not implemented yet.
- **localStorage auth cache:** `fetchWithAuth` reads `x-user-id` from `localStorage` as a client-side helper — cookies remain the auth source of truth.
- **Turbo config:** Env vars must be declared in `turbo.jsonc` `global.env` (`envMode: strict`).
- **Turbo env lint:** `eslint-plugin-turbo` checks `global.env` — `passThroughEnv` alone is insufficient for `turbo/no-undeclared-env-vars`.
- **Package manager:** Repo uses yarn workspaces (`yarn.lock`); older docs/specs may still say pnpm — use yarn commands from [CLAUDE.md](../../CLAUDE.md).
