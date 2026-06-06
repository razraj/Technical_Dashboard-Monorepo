# Wave 1: Account Settings + Project Management

**Date:** 2026-06-06  
**Scope:** Two independent feature areas delivered together as Wave 1.  
**Wave 2 (deferred):** Manager Utilization Dashboard + Admin User Invite.

---

## Background

TenT is a Turborepo monorepo (`apps/web` + `apps/backend`) with JWT httpOnly cookie auth, TanStack Query/Form on the web, and Prisma + PostgreSQL on the backend. Wave 1 completes the account settings page (profile + password) and builds the full project management system (CRUD + explicit membership).

---

## Feature 1 — Account Settings

### Context

- `PUT /user/{userId}` already exists: updates `firstName`, `lastName`, `username`, `profilePic`.
- `PUT /user/{userId}/password` already exists: verifies `oldPassword`, hashes and saves `newPassword`.
- The Settings page (`apps/web/app/settings/page.tsx`) has a static UI shell — Save button is disabled.
- No frontend actions, hooks, or query keys exist for the current user profile yet.

### Changes

#### `apps/web/actions/user.ts`

Add two new fetch helpers (alongside existing `getUsers`):

- `updateProfile(userId: string, data: { firstName?: string; lastName?: string; username?: string })` → `PUT /user/{userId}` via `fetchWithAuth`
- `changePassword(userId: string, data: { oldPassword: string; password: string })` → `PUT /user/{userId}/password` via `fetchWithAuth`

#### `apps/web/hooks/use-user-queries.ts` (new file)

Three hooks:

- `useCurrentUser()` — `useQuery` on `queryKeys.user.me`; fetches `GET /user/{userId}` (pre-existing route)
- `useUpdateProfile()` — `useMutation` wrapping `updateProfile`; invalidates `queryKeys.user.me` on success
- `useChangePassword()` — `useMutation` wrapping `changePassword`; no cache invalidation needed

#### `apps/web/lib/query-keys.ts`

Add `user` namespace:

```ts
user: {
  me: ["user", "me"] as const,
}
```

#### `apps/web/app/settings/page.tsx`

Rewrite to two live TanStack Form sections:

1. **Profile** — Fields: `firstName`, `lastName`, `username`. Pre-populated from `useCurrentUser()`. On submit calls `useUpdateProfile().mutateAsync`. Toast success/error.
2. **Change Password** — Fields: `currentPassword`, `newPassword`, `confirmNewPassword`. Client-side validator ensures `newPassword === confirmNewPassword` before submit. On submit calls `useChangePassword().mutateAsync`. Clears fields on success. Toast success/error.

Both forms follow the existing TanStack Form + `@repo/ui` Field component pattern (reference: `login-form.tsx`, `add-entry-modal.tsx`).

#### Minimal backend change: `apps/backend/app/auth/me/route.ts`

Add `role: true` to the Prisma `select` block so `GET /auth/me` returns the user's role.  
Update `apps/web/types.ts` `User` interface to include `role?: "ADMIN" | "MANAGER" | "EMPLOYEE"`.  
This powers role-conditional UI (Create Project button, member management controls) without an extra round-trip.

---

## Feature 2 — Project Management

### Context

- `GET /project` exists but returns all active projects with no role awareness and no membership filter.
- No `POST`, `PATCH`, `DELETE` project routes exist.
- No `ProjectMember` model exists in the schema.
- `proxy.ts` injects only `x-user-id` — role must be looked up from DB by each protected handler.

### 2a — Schema (`packages/db/src/prisma/schema.prisma`)

Add `ProjectMember` join table:

```prisma
model ProjectMember {
  userId    String
  projectId String

  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())

  @@id([userId, projectId])
  @@index([projectId])
}
```

Add relations on existing models:

- `User`: add `projectMemberships ProjectMember[]`
- `Project`: add `members ProjectMember[]`

Migration command after schema edit:

```sh
yarn workspace @repo/db db:migrate
yarn workspace @repo/db db:generate
```

### 2b — Backend (`apps/backend/app/project/`)

All protected routes read `x-user-id` from headers and look up the caller's `role` from the DB on each request. This is intentional — no role claim is stored in the JWT.

**Helper**: `getUserRole(userId: string): Promise<Role>` — thin Prisma lookup; shared across the new route handlers.

**Updated `GET /project` (`route.ts`)**:
- `EMPLOYEE`: return only projects where a `ProjectMember` row exists for `(callerId, projectId)`.
- `MANAGER` / `ADMIN`: return all active (`deletedAt: null`) projects.
- Response shape unchanged (`{ projects: { id, name }[] }`) so `AddEntryModal` requires no update.

**New routes** (each in its own `route.ts` file under `app/project/[id]/` or `app/project/[id]/members/[memberId]/`):

| Method | Path | Who | Action |
|--------|------|-----|--------|
| `POST` | `/project` | MANAGER, ADMIN | Create project; creator auto-added as member |
| `GET` | `/project/[id]` | member, MANAGER, ADMIN | Get project detail + members list |
| `PATCH` | `/project/[id]` | owning MANAGER, ADMIN | Rename/update description |
| `DELETE` | `/project/[id]` | owning MANAGER, ADMIN | Soft-delete (`deletedAt = now()`) |
| `POST` | `/project/[id]/members` | owning MANAGER, ADMIN | Add a user by `userId` |
| `DELETE` | `/project/[id]/members/[memberId]` | owning MANAGER, ADMIN | Remove a user |

Request/response shapes follow existing conventions (Zod validation, `{ message }` errors, standard HTTP codes).

### 2c — Frontend (`apps/web`)

#### Sidebar (`components/app-sidebar.tsx`)

Add "Projects" nav entry (icon: `FolderKanban` from lucide-react) pointing to `/projects`.

#### New page: `app/projects/page.tsx`

- Protected by `<AuthGuard>`.
- Fetches project list via `useProjects()` (existing hook, already calls `GET /project`).
- Renders project cards in a grid: name, description, member count.
- "New Project" button visible only when `userRole` is `MANAGER` or `ADMIN` (role fetched via `useCurrentUser()`).

#### New component: `components/project-form-modal.tsx`

Dialog for create and edit. Fields: `name` (required), `description` (optional). Uses TanStack Form + `@repo/ui` Field components. On submit: `useCreateProject` or `useUpdateProject` mutation. Toast on success/error.

#### New component: `components/project-members-modal.tsx`

Dialog showing current members (avatar + name). "Add Member" dropdown (fetches all users via existing `GET /user`). "Remove" button per row. Visible to Manager/Admin only. Uses `useProjectMembers`, `useAddMember`, `useRemoveMember` mutations.

#### `actions/projects.ts` (new file)

Fetch helpers using `fetchWithAuth`:

- `getProjects()` — already in `actions/timesheet.ts`; keep as-is (existing call site)
- `getProject(id)` → `GET /project/{id}`
- `createProject(data)` → `POST /project`
- `updateProject(id, data)` → `PATCH /project/{id}`
- `deleteProject(id)` → `DELETE /project/{id}`
- `getProjectMembers(id)` → `GET /project/{id}` (members included in detail response)
- `addMember(projectId, userId)` → `POST /project/{id}/members`
- `removeMember(projectId, userId)` → `DELETE /project/{id}/members/{userId}`

#### `hooks/use-project-queries.ts` (new file)

Hooks: `useProject(id)`, `useCreateProject()`, `useUpdateProject()`, `useDeleteProject()`, `useAddMember()`, `useRemoveMember()`. All mutations invalidate `queryKeys.projects.all` and/or `queryKeys.projects.detail(id)`.

#### `lib/query-keys.ts`

Extend `projects` namespace:

```ts
projects: {
  all: ["projects"] as const,
  detail: (id: string) => ["projects", id] as const,
}
```

---

## Data Flow

```
Browser → apps/web (/api/project/*) → rewrite → apps/backend (/project/*)
         proxy.ts verifies JWT → injects x-user-id
         handler looks up role from DB → enforces RBAC
```

---

## Error Handling

- Role lookup fails (user deleted mid-session): return `401 Unauthorized`.
- Non-owner Manager tries to edit/delete project: return `403 Forbidden`.
- EMPLOYEE tries to `POST /project`: return `403 Forbidden`.
- Project not found or soft-deleted: return `404 Not Found`.
- Duplicate member add (unique constraint violation): return `409 Conflict`.

---

## Out of Scope for Wave 1

- Timesheet approval workflow (deferred)
- Manager team utilization dashboard (Wave 2)
- Admin user invite (Wave 2)
- Project-level reporting / export

---

## Verification Plan

1. **TypeScript**: `yarn workspace web exec tsc --noEmit` + `yarn workspace backend exec tsc --noEmit`
2. **Lint**: `yarn workspace web lint` + `yarn workspace backend lint`
3. **Manual**:
   - Log in as `eve@example.com` (EMPLOYEE): Settings form saves; password change works; Projects page shows only assigned projects; AddEntryModal dropdown shows only assigned projects.
   - Log in as `dave@example.com` (MANAGER): Can create project, edit, soft-delete, add/remove members; Projects page shows all projects.
   - Attempt `POST /project` as EMPLOYEE: expect `403`.
   - Add same member twice: expect `409`.
