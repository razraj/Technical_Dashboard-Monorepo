# TenT Technical Dashboard — Monorepo

Turborepo monorepo (yarn workspaces, Node ≥22) with two Next.js apps (`apps/web` and `apps/backend`) and shared packages.

> **Hard constraints:** Every file under [`.claude/rules/`](.claude/rules/) is auto-loaded as a default rule and is **non-negotiable** without explicit user approval. Before proposing any change that could conflict with an existing rule, read the relevant rule file first and surface the conflict.
>
> **Keep in sync:** When updating this file, also update [`.claude/rules/`](.claude/rules/) if any rule content is affected.

<!-- claude-rules: .claude/rules/*.md -->

## Quick Reference Commands

- **Install**: `yarn install`
- **Dev**: `yarn dev` (all) or `yarn workspace backend dev` / `yarn workspace web dev`
- **Build**: `yarn build`
- **Lint/Format**: `yarn lint` / `yarn format`
- **Database** (`@repo/db`): `yarn workspace @repo/db db:generate|db:migrate|db:seed|db:reset`
- **Env**: `yarn env:cp`

## Current Codebase Snapshot

- **Backend routes (today):** auth (`/auth/login`, `/auth/logout`, `/auth/me`, `/auth/refresh`) + user CRUD — verify with `find apps/backend/app -type f`
- **Timesheets:** Prisma models exist; backend API not implemented yet — see `docs/superpowers/specs/2026-05-27-replace-scan-with-timesheet-design.md`
- **Tests:** no vitest harness configured; `yarn test` is currently a no-op
- **Rules:** `.claude/rules/` only — `.cursor/rules/` removed

## Verification Habits

- `find apps/backend/app -type f` — list actual backend routes (prefer over glob when unsure)
- `yarn workspace web exec tsc --noEmit` — typecheck web app
- `yarn workspace backend exec tsc --noEmit` — typecheck backend
- `yarn workspace backend lint` / `yarn workspace web lint` — per-app lint when turbo filter fails
- Read `.claude/rules/*.md` before architectural changes — surface conflicts to the user

## Environment & Secrets

- **Required**: `DATABASE_URL` (PostgreSQL), `JWT_SECRET` (shared between backend and web).
- **Source of truth**: root `.env`, distributed to apps via `yarn env:cp`.
- **Production web:** set `API_URL` to the public backend origin (not `DATABASE_HOST`).

## Dev Quirks

- **Web → backend rewrite:** `apps/web/next.config.js` proxies `/api/*` to `http://localhost:3000` in dev
- **Turbo config:** `turbo.jsonc` with `envMode: strict` — declare new env vars there
- **Turbo env lint:** `turbo/no-undeclared-env-vars` needs vars in `global.env`, not only `passThroughEnv`
- **Backend auth gate:** `apps/backend/proxy.ts` (Next.js 16 proxy) — never add `middleware.ts`
- **Next.js 16 proxy file:** must be named `proxy.ts` with `export default async function proxy` — handler rename alone won't clear the deprecation warning
- **Prisma CLI config:** root `prisma.config.ts` points at `packages/db` schema/migrations; package also has `packages/db/prisma.config.ts`

## Documentation

- **Agent specs & plans**: `/docs/superpowers/` (root only)
- **Backend-specific docs**: `apps/backend/docs/`
- **Cross-cutting architecture**: `/docs/` (root)
- Do **not** create `apps/web/docs/` — web docs go inline in `apps/web/README.md` or root `/docs/`.

## Detailed Instructions

For specific guidelines, see:
- [Architectural Decisions & Constraints](.claude/rules/architectural-decisions.md)
- [Authentication & Routing Flow](.claude/rules/auth-flow.md)
- [Testing Guidelines](.claude/rules/testing.md)
- [Project Gotchas](.claude/rules/gotchas.md)
