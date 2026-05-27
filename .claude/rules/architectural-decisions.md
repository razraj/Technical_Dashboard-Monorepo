# Architectural Decisions & Hard Constraints

These rules describe **non-negotiable architectural constraints** for this repo. Treat them as authoritative and **do not propose or implement conflicting changes** unless:

- The user explicitly states they want to break a specific rule, **and**
- The change and its implications are clearly called out in the response.

For deployment topology details, see §7 Deployment Topology below.

---

## 0. Current Codebase Scope

Verify against disk before assuming features exist (`find apps/backend/app -type f`).

| Area | Status |
|---|---|
| Auth routes | `/auth/login`, `/auth/logout`, `/auth/me`, `/auth/refresh` |
| User routes | `/user`, `/user/[userId]`, `/user/[userId]/password` |
| Timesheets | Prisma models only — API planned in `docs/superpowers/` |
| Queues / webhooks / files / history | Not in current codebase |

---

## 1. Monorepo Structure & Boundaries

- **Preserve the monorepo layout.** Keep `apps/backend`, `apps/web`, and `packages/*` as separate concerns. Do not merge backend and web into one app or move backend code into `apps/web`.
- **Cross-boundary access:**
  - `apps/backend` is the **only** layer that talks to the database via `@repo/db`.
  - `apps/web` must **never** import Prisma or DB clients directly.
  - Shared code must live in `packages/*` (e.g. `@repo/db`, `@repo/ui`, `@repo/config-eslint`, `@repo/config-typescript`) — do not copy-paste between apps.
- **Tooling:** Use **pnpm** (10.20.0) and the existing Turborepo pipeline. Do not introduce yarn/npm lockfiles or change workspace tooling.
- **Shared configs:** ESLint and TypeScript configs live in `packages/config-*` and are applied via workspace settings — do not inline large config blocks per app.
- **Turbo `envMode: strict`:** Every env var consumed by a task must be declared in [turbo.jsonc](../../turbo.jsonc).

## 2. Database & Data Access

- **PostgreSQL is the source of truth.** Wired through `packages/db` and Prisma 7. Do **not** reintroduce MySQL or alternative databases — even if `docker-compose.yml` or older docs reference MySQL, ignore them.
- **Single Prisma package.** All schema, migrations, and client generation stay in `packages/db`:
  - Schema: [packages/db/src/prisma/schema.prisma](../../packages/db/src/prisma/schema.prisma)
  - Generated client: `packages/db/src/generated/client`
  - Uses `@prisma/adapter-pg` + `prisma.config.ts` (no `url` in schema).
- **Backend imports the shared client.** Use `@repo/db` via `apps/backend/lib/db.ts` — do not instantiate standalone Prisma clients.
- **Schema changes:** edit schema → `pnpm db:migrate` → `pnpm db:generate`. Never hand-edit migrations after they're applied.
- **Neon-compatible:** Connection uses `DATABASE_URL`; Neon's pooler URL is the standard production target.

## 3. Auth, Cookies & Proxy

- **Server-verified JWTs in HTTP-only cookies are the single source of truth.** Cookies: `auth_token`, `refresh_token`. Never move primary auth state into `localStorage`, `sessionStorage`, or client-only state — those are best-effort caches at most.
- **Backend is the auth authority.** Only the backend issues, verifies, or refreshes JWTs. The web app may proxy auth requests but must not implement independent token semantics.
- **`proxy.ts` is the central auth gate.** It validates the cookie (via `jose`) and injects `x-user-id` for protected routes.
  - This is **Next.js 16 proxy convention** — do **not** create a `middleware.ts`. They are not interchangeable.
  - New protected backend routes must read `x-user-id` from request headers — do not re-parse cookies or trust client-provided user IDs.
  - Public routes are listed inline in [apps/backend/proxy.ts](../../apps/backend/proxy.ts) — add new public paths there.
  - `allowedHosts` in `proxy.ts` must include any new dev hostname.
- **Web auth traffic:** Browser calls `/api/auth/*` on the web origin; `apps/web/next.config.js` rewrites to the backend in dev. Backend login sets cookies on the response. For split Vercel deployments, ensure production rewrites target `API_URL` and cookie domains are correct.

## 4. Web ↔ Backend Traffic Flow

- **Canonical path:** Browser → `apps/web` → `/api/...` → rewrite (via `apps/web/next.config.js`) → `apps/backend`. Do not have browser code call the backend origin directly.
- **Web API calls** must go through `fetchWithAuth()` / `fetchWithoutAuth()` from `@/utils/api` — they handle the rewrite + cookie semantics correctly.
- **Shared `JWT_SECRET`** between web and backend is required so tokens verify consistently across both Vercel projects.

## 5. Error Handling

- **Follow existing error shapes and HTTP status codes** for new endpoints. Do not invent incompatible response formats.
- **Normalize errors at boundaries** — avoid throwing untyped errors across the web/backend boundary.

## 6. Environment Variables

- **Required everywhere:** `DATABASE_URL`, `JWT_SECRET` (must match across web + backend).
- **Source of truth:** root `.env`, distributed to apps via `pnpm env:cp` (copies to `apps/backend/.env`, `apps/web/.env`, `packages/db/.env`).
- **Vercel:** set per-project in the Vercel dashboard. Backend needs DB + auth secrets; web needs `API_URL` + `JWT_SECRET`.

## 7. Deployment Topology

- **Two Vercel projects:** `apps/web` and `apps/backend` deploy independently. Web production `API_URL` must be the public backend origin.
- **Database:** Neon PostgreSQL, accessed via the pooler URL in production for serverless cold-start friendliness.
- Deployment diagram: if a detailed diagram is created, store it in `/docs/` (root) as a Markdown or image file.

---

## 8. Documentation Folder Convention

**Three possible locations — one forbidden:**

| Folder | Status | Use for |
|---|---|---|
| `/docs/` (root) | ✅ exists | Repo-wide: architecture overviews, deployment diagrams, cross-app decisions, **all superpowers output (specs + plans)** |
| `apps/backend/docs/` | optional | Backend-specific: Postman collections, API design notes, anything scoped to `apps/backend` |
| `apps/web/docs/` | ❌ do not create | No web-specific docs folder — see routing rules below |

**Routing rules for new documentation:**

- **Backend-scoped** (API routes, DB schema, auth logic) → `apps/backend/docs/` or root `/docs/` if cross-cutting
- **Web-scoped** (UI flows, component decisions, auth UX) → root `/docs/` if architectural, or inline in `README.md` inside `apps/web/`
- **Cross-cutting** (affects multiple apps or packages, deployment topology, monorepo conventions) → `/docs/` (root)
- **Package-scoped** (DB schema decisions, UI component specs, package-level API) → inline in `packages/<name>/README.md`; do not create a `docs/` inside `packages/*`.
- **`apps/web/` must never get its own `docs/` folder.**
- **`superpowers/` only lives at `/docs/superpowers/`** (root). All agent-generated specs and plans go here regardless of which app is being worked on.

---

## Changing These Rules

If a task seems to require breaking one of these constraints, **stop and surface the conflict** to the user before proceeding. Architectural drift is much more expensive to undo than to prevent.

When updating [CLAUDE.md](../../CLAUDE.md), keep these rule files in sync.
