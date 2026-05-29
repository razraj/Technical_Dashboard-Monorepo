# Workspace Dependencies & Web Patterns

Guidance for adding dependencies and shared code in this monorepo. **Prefer existing workspace packages** before installing duplicate npm packages in individual apps.

## Workspace packages

| Package | Purpose | Consumed by |
|---------|---------|-------------|
| `@repo/ui` | Shared React components, toast, Tailwind styles, `cn` utility | `apps/web` |
| `@repo/db` | Prisma client, schema types, enums | `apps/backend` only |
| `@repo/eslint-config` | Shared ESLint presets | All workspaces |
| `@repo/typescript-config` | Shared `tsconfig` bases | All workspaces |

### Adding a workspace dependency

In the consuming workspace's `package.json`:

```json
{
  "dependencies": {
    "@repo/ui": "*"
  }
}
```

Then run `yarn install` from the repo root. Import using the package exports:

```ts
import { Button } from "@repo/ui/components/button";
import { cn } from "@repo/ui/lib/utils";
import { toast } from "@repo/ui/components";
```

### When to create a new `packages/*` workspace

- Code is shared by **two or more apps**, or
- Shared hooks/utilities need their own npm dependencies and should not be duplicated

Keep app-specific libraries in the app when only one app needs them (e.g. TanStack Query/Form in `apps/web` today).

---

## Web app patterns

### Server state — TanStack Query

Use **`@tanstack/react-query`** for API/server state. Do not use raw `useEffect` + `useState` for fetch/cache flows when React Query fits.

| Concern | Location |
|---------|----------|
| Provider | `apps/web/components/providers.tsx` (`QueryClientProvider`) |
| Query keys | `apps/web/lib/query-keys.ts` — centralize all keys here |
| Data hooks | `apps/web/hooks/` — e.g. `use-timesheet-queries.ts` |
| Fetch logic | `apps/web/actions/` — server actions or helpers used as `queryFn` |

Example hook pattern:

```ts
"use client";

import { useQuery } from "@tanstack/react-query";
import { getWeeks } from "@/actions/timesheet";
import { queryKeys } from "@/lib/query-keys";

export function useWeeks(page: number, pageSize: number) {
  return useQuery({
    queryKey: queryKeys.weeks.list(page, pageSize),
    queryFn: () => getWeeks(page, pageSize),
  });
}
```

Mutations should invalidate related keys via `useQueryClient()` and `queryKeys.*`.

### Forms — TanStack Form

Use **`@tanstack/react-form-nextjs`** for all forms. Pair with `@repo/ui` field primitives — do not introduce alternate form libraries.

| Concern | Location |
|---------|----------|
| Form hook | `useForm` from `@tanstack/react-form-nextjs` |
| UI | `@repo/ui/components/field`, `input`, `button`, etc. |
| Submit | Server actions in `apps/web/actions/` |
| Errors | `toast` from `@repo/ui/components` |

Reference implementations: `login-form.tsx`, `signup-form.tsx`, `add-entry-modal.tsx`.

```tsx
import { useForm } from "@tanstack/react-form-nextjs";
import { Field, FieldGroup, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { Button } from "@repo/ui/components/button";
import { toast } from "@repo/ui/components";
```

### UI components — `@repo/ui`

- Import components from `@repo/ui/components/*` — do not copy-paste into `apps/web`.
- Global styles: `import "@repo/ui/globals.css"` in `apps/web/app/layout.tsx`.
- New shadcn-style components: add to `packages/ui` (see `packages/ui/components.json`), then consume from web.
- Icons: `lucide-react` is fine in `apps/web` for page-level icons; prefer reusing `@repo/ui` components that already bundle what you need.

---

## Backend patterns

- **Database:** `@repo/db` only — via `apps/backend/lib/db.ts`. Never import from `apps/web`.
- **Validation:** Zod schemas in `apps/backend/common/ZodSchema.ts` (extend for new routes).

---

## Anti-patterns

| Avoid | Prefer |
|-------|--------|
| `@repo/db` or Prisma in `apps/web` | Server actions + backend API |
| Duplicating Radix/Tailwind primitives in `apps/web` | `@repo/ui` components |
| `useEffect` fetch loops for list/detail pages | TanStack Query hooks |
| `react-hook-form` or ad-hoc form state | `@tanstack/react-form-nextjs` + `@repo/ui` Field |
| Same npm package in multiple apps when shared code needs it | Hoist to `packages/*` |

---

## Related docs

- [README.md](../../README.md) — setup and repo layout
- [apps/web/README.md](../../apps/web/README.md) — web-specific dev entry
- [architectural-decisions.md](architectural-decisions.md) — hard constraints
