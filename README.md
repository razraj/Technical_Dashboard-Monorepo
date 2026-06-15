# TenT Technical Dashboard

Turborepo monorepo for a timesheet and team dashboard. The **web** app is the user-facing UI; the **backend** app is the API layer and sole database accessor. Shared packages hold the database client, UI components, and tooling configs.

## Setup instructions

### Prerequisites

- **Node.js** ≥ 22.13.0
- **Yarn** 4 (via Corepack: `corepack enable`)
- **PostgreSQL** (local instance or hosted, e.g. Neon)

### 1. Install dependencies

```sh
yarn install
```

### 2. Configure environment

Create a root `.env` file with at least:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/tent
JWT_SECRET=your-long-random-secret
```

Optional but commonly used in development:

```env
DEFAULT_PASSWORD=password123
WEB_URL=http://localhost:3001
```

Copy the root env into each workspace:

```sh
yarn env:cp
```

This writes `.env` to `apps/backend`, `apps/web`, and `packages/db`.

### 3. Prepare the database

```sh
yarn workspace @repo/db db:generate
yarn workspace @repo/db db:migrate
yarn workspace @repo/db db:seed
```

The seed is idempotent and creates demo users (see [Assumptions & notes](#assumptions--notes)).

### 4. Run locally

Start both apps:

```sh
yarn dev
```

Or run them individually:

```sh
yarn workspace backend dev   # http://localhost:3000
yarn workspace web dev       # http://localhost:3001
```

Open **http://localhost:3001** in the browser. The web app rewrites `/api/*` to the backend on port 3000.

### 5. Verify (optional)

```sh
yarn lint
yarn check-types
yarn workspace web test:e2e   # Playwright; requires dev servers or PW_SKIP_WEBSERVER
```

## Repository layout

| Path | Description |
|------|-------------|
| `apps/web` | Next.js frontend (port **3001**) |
| `apps/backend` | Next.js API + auth gate via `proxy.ts` (port **3000**) |
| `packages/db` | Prisma schema, migrations, and PostgreSQL client (`@repo/db`) |
| `packages/ui` | Shared React components (Radix UI + Tailwind) |
| `packages/eslint-config` | Shared ESLint config |
| `packages/typescript-config` | Shared TypeScript config |

## Dependencies & patterns

**Prefer workspace packages** (`@repo/ui`, `@repo/db`, shared configs) before adding duplicate npm deps to individual apps.

| Layer | Standard libraries |
|-------|-------------------|
| Web server state | `@tanstack/react-query` — hooks in `apps/web/hooks/`, keys in `apps/web/lib/query-keys.ts` |
| Web forms | `@tanstack/react-form-nextjs` + `@repo/ui` Field components |
| Web UI | `@repo/ui` components and styles |
| Backend data | `@repo/db` (backend only) |

See [.claude/rules/workspace-dependencies.md](.claude/rules/workspace-dependencies.md) for import examples, anti-patterns, and when to create a new package.

## Frameworks & libraries

### Monorepo & tooling

- [Turborepo](https://turbo.build/) — task orchestration and caching
- [Yarn workspaces](https://yarnpkg.com/features/workspaces) (v4)
- [TypeScript](https://www.typescriptlang.org/) 5.9
- [ESLint](https://eslint.org/) + [Prettier](https://prettier.io)

### Apps

- [Next.js](https://nextjs.org/) 16 (App Router) — both `web` and `backend`
- [React](https://react.dev/) 19

### Web (`apps/web`)

- [TanStack Query](https://tanstack.com/query) — server state / data fetching
- [TanStack Form](https://tanstack.com/form) — forms
- [Tailwind CSS](https://tailwindcss.com/) 4
- [Lucide React](https://lucide.dev/) — icons
- [next-themes](https://github.com/pacocoursey/next-themes) — theme switching
- [Playwright](https://playwright.dev/) — end-to-end tests

### Backend (`apps/backend`)

- [Prisma](https://www.prisma.io/) 7 + `@prisma/adapter-pg` — PostgreSQL ORM
- [Zod](https://zod.dev/) — request validation
- [jose](https://github.com/panva/jose) — JWT sign/verify
- [bcryptjs](https://github.com/dcodeIO/bcrypt.js) — password hashing
- [Resend](https://resend.com/) / Nodemailer — transactional email (production vs dev)

### Shared UI (`packages/ui`)

- [Radix UI](https://www.radix-ui.com/) — accessible primitives
- [class-variance-authority](https://cva.style/) + [tailwind-merge](https://github.com/dcastil/tailwind-merge) — component styling
- [Sonner](https://sonner.emilkowal.ski/) — toasts

## Assumptions & notes

### Architecture

- **Only the backend talks to the database.** The web app must not import Prisma or `@repo/db` directly.
- **Browser traffic flows through the web origin:** `Browser → apps/web → /api/* rewrite → apps/backend`. Do not call the backend origin directly from client code; use `fetchWithAuth()` / `fetchWithoutAuth()` from `apps/web/utils/api.ts`.
- **Auth is JWT-in-cookie, not server-side sessions.** Login sets httpOnly cookies `auth_token` (access) and `refresh_token`. The backend `proxy.ts` verifies the access token and injects `x-user-id` for protected routes. Protected handlers read `x-user-id` from headers — they do not re-parse cookies.

### Environment

- **Source of truth:** root `.env`, copied with `yarn env:cp`.
- **Required:** `DATABASE_URL`, `JWT_SECRET` (must match across web and backend).
- **Production:** web and backend deploy as **separate Vercel projects**. Set the web project's backend rewrite target via `DATABASE_HOST` (or equivalent public API origin). Email in production uses `RESEND_API_KEY`.
- **New env vars:** declare them in `turbo.json` `global.env` if consumed by Turbo tasks.

### Development defaults

- Web: **http://localhost:3001**
- Backend: **http://localhost:3000**
- Seed password: `DEFAULT_PASSWORD` env var, or `password123` if unset.
- Seed users: `dave@example.com` (manager), `eve@example.com` (employee).

### Database

- PostgreSQL is the only supported database. Schema and migrations live in `packages/db`.
- After schema changes: `yarn workspace @repo/db db:migrate` then `yarn workspace @repo/db db:generate`.

### Testing

- `yarn test` at the repo root is currently a no-op.
- E2E tests live in `apps/web/e2e/` and run via `yarn workspace web test:e2e`.

### Documentation

- Workspace deps & web patterns: `.claude/rules/workspace-dependencies.md`
- Web app guide: `apps/web/README.md`
- Agent specs and plans: `docs/superpowers/`
- Contributor constraints and auth flow: `.claude/rules/`
- Quick command reference for agents: `CLAUDE.md`
