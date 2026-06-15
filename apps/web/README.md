# Web app (`apps/web`)

Next.js 16 frontend (port **3001**). Browser entry point for the dashboard — all API traffic goes to `/api/*`, which rewrites to the backend.

## Dev

```sh
yarn workspace web dev          # http://localhost:3001
yarn workspace web test:e2e     # Playwright
```

Requires backend on port 3000 and env copied via `yarn env:cp` from the root. See [README.md](../../README.md) for full setup.

## Dependencies — use workspace packages first

| Need | Use |
|------|-----|
| UI components, toast, styles | `@repo/ui` |
| Server/API state | `@tanstack/react-query` |
| Forms | `@tanstack/react-form-nextjs` + `@repo/ui` Field components |
| API calls | `fetchWithAuth` / `fetchWithoutAuth` from `@/utils/api` |
| TypeScript / ESLint config | `@repo/typescript-config`, `@repo/eslint-config` |

Full conventions: [.claude/rules/workspace-dependencies.md](../../.claude/rules/workspace-dependencies.md).

**Do not** import `@repo/db` or Prisma from this app.

## Project layout

| Path | Purpose |
|------|---------|
| `app/` | Next.js App Router pages |
| `actions/` | Server actions (auth, timesheet, user) — used as React Query `queryFn` / form submit |
| `hooks/` | TanStack Query hooks (e.g. `use-timesheet-queries.ts`) |
| `lib/query-keys.ts` | Centralized React Query key factory |
| `components/` | App-specific components; compose `@repo/ui` primitives |
| `utils/api.ts` | Authenticated fetch helpers |
| `e2e/` | Playwright tests |

## Patterns

### Server state (TanStack Query)

1. Add query keys to `lib/query-keys.ts`.
2. Add fetch logic in `actions/` if not already present.
3. Expose a hook in `hooks/` using `useQuery` / `useMutation`.
4. Wrap the app in `QueryClientProvider` via `components/providers.tsx` (already done).

### Forms (TanStack Form)

1. `useForm` from `@tanstack/react-form-nextjs`.
2. Render with `@repo/ui/components/field`, `input`, `button`.
3. Submit via server actions; surface errors with `toast` from `@repo/ui/components`.

See `components/login-form.tsx` and `components/add-entry-modal.tsx`.

### UI

Import from `@repo/ui/components/*`. Add reusable primitives to `packages/ui`, not here.
