# Project Gotchas

## Overview

Project quirks and common pitfalls when developing in the TenT Technical Dashboard monorepo.

## Quirks & Pitfalls

- **Stale file index:** Glob/search can surface files not on disk (removed routes, old `__tests__/`, `vercel.json`). Verify with `find` or `ls` before assuming a file exists.
- **Backend proxy:** Backend uses `proxy.ts` (Next.js 16 proxy convention), NOT `middleware.ts`. Do not create middleware.
- **Public routes in proxy:** Public paths are listed inline in `proxy.ts` (not `publicAuthPaths` helpers). Add new public routes there.
- **Database target:** `docker-compose.yml` may reference MySQL but the project uses PostgreSQL. Ignore MySQL references.
- **Package names:** Actual DB package is `packages/db` (`@repo/db`), not `packages/database`.
- **Allowed hosts:** `allowedHosts` in `proxy.ts` must include any dev hostname you use.
- **Timesheets:** Prisma schema has `Timesheet` / `TimesheetEntry` models; backend API routes are not implemented yet.
- **localStorage auth cache:** `fetchWithAuth` reads `x-user-id` from `localStorage` as a client-side helper — cookies remain the auth source of truth.
- **Turbo config:** Env vars must be declared in `turbo.jsonc` (`envMode: strict`).
