# Wave 1: Account Settings + Project Management — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire up the Settings page (profile + password) and build full Project Management (CRUD + explicit membership with role-based access).

**Architecture:** Frontend-only for Settings (backend routes already exist). Project Management requires a Prisma schema migration (new `ProjectMember` join table), six new/updated backend routes with DB-level role enforcement, and a new Projects page with two Dialog components on the web. All web API calls use `fetchWithAuth`; all backend handlers read `x-user-id` from headers injected by `proxy.ts`.

**Tech Stack:** Next.js 16 App Router, Prisma 7 + PostgreSQL, TanStack Query v5, TanStack Form (react-form-nextjs), @repo/ui (Radix UI + Tailwind), Zod, bcryptjs, TypeScript 5.9, Yarn workspaces + Turborepo.

> **Note on testing:** This repo has no vitest/jest harness (`yarn test` is a no-op). Verification uses TypeScript (`tsc --noEmit`) + ESLint + manual browser testing. Each task ends with a `tsc` check as the compile-time equivalent of a test pass.

---

## File Map

### New files
| File | Responsibility |
|------|---------------|
| `apps/web/hooks/use-user-queries.ts` | `useCurrentUser`, `useUpdateProfile`, `useChangePassword` hooks |
| `apps/web/actions/projects.ts` | Fetch helpers for all project + member endpoints |
| `apps/web/hooks/use-project-queries.ts` | TanStack Query hooks for projects + members |
| `apps/web/components/project-form-modal.tsx` | Create / edit project dialog |
| `apps/web/components/project-members-modal.tsx` | View / add / remove project members dialog |
| `apps/web/app/projects/page.tsx` | Projects list page (protected) |
| `apps/backend/app/project/[id]/route.ts` | GET / PATCH / DELETE single project |
| `apps/backend/app/project/[id]/members/route.ts` | POST add member |
| `apps/backend/app/project/[id]/members/[memberId]/route.ts` | DELETE remove member |

### Modified files
| File | What changes |
|------|-------------|
| `packages/db/src/prisma/schema.prisma` | Add `ProjectMember` model + relations |
| `apps/backend/app/auth/me/route.ts` | Add `role` to Prisma select |
| `apps/backend/app/project/route.ts` | Add `POST`; update `GET` for role-filtered response |
| `apps/backend/common/ZodSchema.ts` | Add `createProjectSchema`, `updateProjectSchema`, `addMemberSchema` |
| `apps/web/types.ts` | Add `role` to `User`; add `ProjectDetail`, `ProjectMember` types |
| `apps/web/lib/query-keys.ts` | Add `user.me`, `projects.detail(id)` |
| `apps/web/actions/user.ts` | Add `updateProfile`, `changePassword` helpers |
| `apps/web/app/settings/page.tsx` | Rewrite with two live TanStack Forms |
| `apps/web/components/app-sidebar.tsx` | Add Projects nav entry |

---

## Task 1: Schema — Add ProjectMember model

**Files:**
- Modify: `packages/db/src/prisma/schema.prisma`

- [ ] **Step 1.1: Add `ProjectMember` model and relations to schema**

  Open `packages/db/src/prisma/schema.prisma`. After the `TimesheetEntry` model, add:

  ```prisma
  /// Explicit membership record linking a user to a project.
  model ProjectMember {
    userId    String
    projectId String

    user    User    @relation("UserProjectMemberships", fields: [userId], references: [id], onDelete: Cascade)
    project Project @relation("ProjectMembers", fields: [projectId], references: [id], onDelete: Cascade)

    createdAt DateTime @default(now())

    @@id([userId, projectId])
    @@index([projectId])
  }
  ```

  On the `User` model, add inside the relations block (after `managedProjects`):

  ```prisma
  projectMemberships ProjectMember[] @relation("UserProjectMemberships")
  ```

  On the `Project` model, add inside the relations block (after `timesheetLogs`):

  ```prisma
  members ProjectMember[] @relation("ProjectMembers")
  ```

- [ ] **Step 1.2: Run migration and regenerate client**

  ```bash
  yarn workspace @repo/db db:migrate
  # When prompted for a migration name, enter: add_project_member
  yarn workspace @repo/db db:generate
  ```

  Expected: migration file created in `packages/db/src/prisma/migrations/`, client regenerated.

- [ ] **Step 1.3: Typecheck to verify schema compiles**

  ```bash
  yarn workspace backend exec tsc --noEmit
  ```

  Expected: No errors.

- [ ] **Step 1.4: Commit**

  ```bash
  git add packages/db/src/prisma/ packages/db/src/generated/
  git commit -m "feat(db): add ProjectMember join table"
  ```

---

## Task 2: Backend — Add `role` to `GET /auth/me`

**Files:**
- Modify: `apps/backend/app/auth/me/route.ts`

- [ ] **Step 2.1: Add `role` to the Prisma select**

  In `apps/backend/app/auth/me/route.ts`, update the `select` block:

  ```ts
  const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
          id: true,
          email: true,
          username: true,
          firstName: true,
          lastName: true,
          profilePic: true,
          role: true,          // ← add this
          createdAt: true,
          updatedAt: true
      }
  });
  ```

- [ ] **Step 2.2: Typecheck**

  ```bash
  yarn workspace backend exec tsc --noEmit
  ```

  Expected: No errors.

- [ ] **Step 2.3: Commit**

  ```bash
  git add apps/backend/app/auth/me/route.ts
  git commit -m "feat(backend): include role in GET /auth/me response"
  ```

---

## Task 3: Frontend — Update types and query keys

**Files:**
- Modify: `apps/web/types.ts`
- Modify: `apps/web/lib/query-keys.ts`

- [ ] **Step 3.1: Add `role` and new types to `apps/web/types.ts`**

  At the top of the `User` interface, add `role`:

  ```ts
  export interface User {
      id: string;
      email?: string;
      username?: string;
      firstName?: string | null;
      lastName?: string | null;
      profilePic?: string | null;
      refreshToken?: string | null;
      role?: "ADMIN" | "MANAGER" | "EMPLOYEE";
  }
  ```

  After the existing types, append:

  ```ts
  export interface ProjectMemberUser {
      id: string;
      username: string;
      firstName: string | null;
      lastName: string | null;
      email: string;
  }

  export interface ProjectDetail {
      id: string;
      name: string;
      description: string | null;
      managerId: string;
      createdAt: string;
      members: ProjectMemberUser[];
  }
  ```

- [ ] **Step 3.2: Extend query keys in `apps/web/lib/query-keys.ts`**

  Replace the file contents with:

  ```ts
  export const queryKeys = {
      user: {
          me: ["user", "me"] as const,
      },
      weeks: {
          all: ["weeks"] as const,
          list: (page: number, pageSize: number, scope?: string, projectId?: string) =>
              [...queryKeys.weeks.all, "list", page, pageSize, scope ?? "default", projectId ?? "all"] as const,
          detail: (weekStart: string, scope?: string, projectId?: string) =>
              [...queryKeys.weeks.all, "detail", weekStart, scope ?? "default", projectId ?? "all"] as const,
      },
      projects: {
          all: ["projects"] as const,
          detail: (id: string) => ["projects", id] as const,
      },
  } as const;
  ```

- [ ] **Step 3.3: Typecheck**

  ```bash
  yarn workspace web exec tsc --noEmit
  ```

  Expected: No errors.

- [ ] **Step 3.4: Commit**

  ```bash
  git add apps/web/types.ts apps/web/lib/query-keys.ts
  git commit -m "feat(web): add role to User type, ProjectDetail type, extend query keys"
  ```

---

## Task 4: Frontend — Settings actions and hooks

**Files:**
- Modify: `apps/web/actions/user.ts`
- Create: `apps/web/hooks/use-user-queries.ts`

- [ ] **Step 4.1: Add `updateProfile` and `changePassword` to `apps/web/actions/user.ts`**

  Replace the entire file:

  ```ts
  import { User, UserResponse } from "@/types";
  import { fetchWithAuth } from "@/utils/api";

  export const getUsers = async (): Promise<UserResponse> =>
      fetchWithAuth(`/user`, { method: "GET" });

  export const getCurrentUser = (): Promise<{ user: User }> =>
      fetchWithAuth(`/auth/me`, { method: "GET" });

  export const updateProfile = (
      userId: string,
      data: { firstName?: string; lastName?: string; username?: string }
  ): Promise<{ message: string }> =>
      fetchWithAuth(`/user/${userId}`, {
          method: "PUT",
          body: JSON.stringify(data),
      });

  export const changePassword = (
      userId: string,
      data: { oldPassword: string; password: string }
  ): Promise<{ message: string }> =>
      fetchWithAuth(`/user/${userId}/password`, {
          method: "PUT",
          body: JSON.stringify(data),
      });
  ```

  > Note: `getUsers` no longer uses `toast.promise` — the old implementation showed toasts on every load, which is bad UX. Errors will surface via TanStack Query's `onError`.

- [ ] **Step 4.2: Create `apps/web/hooks/use-user-queries.ts`**

  ```ts
  "use client";

  import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
  import { changePassword, getCurrentUser, updateProfile } from "@/actions/user";
  import { queryKeys } from "@/lib/query-keys";

  export function useCurrentUser() {
      return useQuery({
          queryKey: queryKeys.user.me,
          queryFn: getCurrentUser,
          select: (data) => data.user,
      });
  }

  export function useUpdateProfile() {
      const queryClient = useQueryClient();
      return useMutation({
          mutationFn: ({ userId, data }: { userId: string; data: { firstName?: string; lastName?: string; username?: string } }) =>
              updateProfile(userId, data),
          onSuccess: () => {
              queryClient.invalidateQueries({ queryKey: queryKeys.user.me });
          },
      });
  }

  export function useChangePassword() {
      return useMutation({
          mutationFn: ({ userId, data }: { userId: string; data: { oldPassword: string; password: string } }) =>
              changePassword(userId, data),
      });
  }
  ```

- [ ] **Step 4.3: Typecheck**

  ```bash
  yarn workspace web exec tsc --noEmit
  ```

  Expected: No errors.

- [ ] **Step 4.4: Commit**

  ```bash
  git add apps/web/actions/user.ts apps/web/hooks/use-user-queries.ts
  git commit -m "feat(web): add updateProfile/changePassword actions and user hooks"
  ```

---

## Task 5: Frontend — Rewrite Settings page

**Files:**
- Modify: `apps/web/app/settings/page.tsx`

- [ ] **Step 5.1: Rewrite `apps/web/app/settings/page.tsx`**

  ```tsx
  "use client";

  import { useEffect } from "react";
  import { useForm } from "@tanstack/react-form-nextjs";
  import { AppSidebar } from "@/components/app-sidebar";
  import { AuthGuard } from "@/components/auth-guard";
  import { useCurrentUser, useUpdateProfile, useChangePassword } from "@/hooks/use-user-queries";
  import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage } from "@repo/ui/components/breadcrumb";
  import { Button } from "@repo/ui/components/button";
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/components/card";
  import { Field, FieldGroup, FieldLabel } from "@repo/ui/components/field";
  import { Input } from "@repo/ui/components/input";
  import { Separator } from "@repo/ui/components/separator";
  import { SidebarInset, SidebarProvider, SidebarTrigger } from "@repo/ui/components/sidebar";
  import { toast } from "@repo/ui/components";

  function ProfileForm({ userId, defaultValues }: { userId: string; defaultValues: { firstName: string; lastName: string; username: string } }) {
      const updateProfile = useUpdateProfile();

      const form = useForm({
          defaultValues,
          onSubmit: async ({ value }) => {
              try {
                  await updateProfile.mutateAsync({ userId, data: value });
                  toast.success("Profile updated");
              } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Failed to update profile");
              }
          },
      });

      return (
          <form
              onSubmit={(e) => {
                  e.preventDefault();
                  void form.handleSubmit();
              }}
          >
              <FieldGroup>
                  <form.Field name="firstName">
                      {(field) => (
                          <Field>
                              <FieldLabel htmlFor="firstName">First Name</FieldLabel>
                              <Input
                                  id="firstName"
                                  value={field.state.value}
                                  onChange={(e) => field.handleChange(e.target.value)}
                                  placeholder="Enter your first name"
                              />
                          </Field>
                      )}
                  </form.Field>
                  <form.Field name="lastName">
                      {(field) => (
                          <Field>
                              <FieldLabel htmlFor="lastName">Last Name</FieldLabel>
                              <Input
                                  id="lastName"
                                  value={field.state.value}
                                  onChange={(e) => field.handleChange(e.target.value)}
                                  placeholder="Enter your last name"
                              />
                          </Field>
                      )}
                  </form.Field>
                  <form.Field name="username">
                      {(field) => (
                          <Field>
                              <FieldLabel htmlFor="username">Username</FieldLabel>
                              <Input
                                  id="username"
                                  value={field.state.value}
                                  onChange={(e) => field.handleChange(e.target.value)}
                                  placeholder="Enter your username"
                              />
                          </Field>
                      )}
                  </form.Field>
              </FieldGroup>
              <div className="mt-4 flex justify-end">
                  <form.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting]}>
                      {([canSubmit, isSubmitting]) => (
                          <Button type="submit" disabled={!canSubmit || updateProfile.isPending}>
                              {isSubmitting || updateProfile.isPending ? "Saving..." : "Save Changes"}
                          </Button>
                      )}
                  </form.Subscribe>
              </div>
          </form>
      );
  }

  function ChangePasswordForm({ userId }: { userId: string }) {
      const changePassword = useChangePassword();

      const form = useForm({
          defaultValues: { oldPassword: "", password: "", confirmPassword: "" },
          onSubmit: async ({ value }) => {
              if (value.password !== value.confirmPassword) {
                  toast.error("Passwords do not match");
                  return;
              }
              try {
                  await changePassword.mutateAsync({
                      userId,
                      data: { oldPassword: value.oldPassword, password: value.password },
                  });
                  toast.success("Password changed");
                  form.reset();
              } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Failed to change password");
              }
          },
      });

      return (
          <form
              onSubmit={(e) => {
                  e.preventDefault();
                  void form.handleSubmit();
              }}
          >
              <FieldGroup>
                  <form.Field
                      name="oldPassword"
                      validators={{ onChange: ({ value }) => (value ? undefined : "Current password is required") }}
                  >
                      {(field) => (
                          <Field>
                              <FieldLabel htmlFor="oldPassword">Current Password</FieldLabel>
                              <Input
                                  id="oldPassword"
                                  type="password"
                                  value={field.state.value}
                                  onChange={(e) => field.handleChange(e.target.value)}
                                  placeholder="••••••••"
                              />
                          </Field>
                      )}
                  </form.Field>
                  <form.Field
                      name="password"
                      validators={{ onChange: ({ value }) => (value.length >= 8 ? undefined : "Must be at least 8 characters") }}
                  >
                      {(field) => (
                          <Field>
                              <FieldLabel htmlFor="newPassword">New Password</FieldLabel>
                              <Input
                                  id="newPassword"
                                  type="password"
                                  value={field.state.value}
                                  onChange={(e) => field.handleChange(e.target.value)}
                                  placeholder="••••••••"
                              />
                          </Field>
                      )}
                  </form.Field>
                  <form.Field
                      name="confirmPassword"
                      validators={{ onChange: ({ value }) => (value ? undefined : "Please confirm your password") }}
                  >
                      {(field) => (
                          <Field>
                              <FieldLabel htmlFor="confirmPassword">Confirm New Password</FieldLabel>
                              <Input
                                  id="confirmPassword"
                                  type="password"
                                  value={field.state.value}
                                  onChange={(e) => field.handleChange(e.target.value)}
                                  placeholder="••••••••"
                              />
                          </Field>
                      )}
                  </form.Field>
              </FieldGroup>
              <div className="mt-4 flex justify-end">
                  <form.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting]}>
                      {([canSubmit, isSubmitting]) => (
                          <Button type="submit" disabled={!canSubmit || changePassword.isPending}>
                              {isSubmitting || changePassword.isPending ? "Updating..." : "Change Password"}
                          </Button>
                      )}
                  </form.Subscribe>
              </div>
          </form>
      );
  }

  export default function SettingsPage() {
      const { data: user, isLoading } = useCurrentUser();

      return (
          <AuthGuard requireUnauthenticated={false}>
              <SidebarProvider>
                  <AppSidebar />
                  <SidebarInset>
                      <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
                          <div className="flex items-center gap-2 px-4">
                              <SidebarTrigger className="-ml-1" />
                              <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
                              <Breadcrumb>
                                  <BreadcrumbList>
                                      <BreadcrumbItem>
                                          <BreadcrumbPage>Settings</BreadcrumbPage>
                                      </BreadcrumbItem>
                                  </BreadcrumbList>
                              </Breadcrumb>
                          </div>
                      </header>

                      <div className="flex flex-1 flex-col gap-6 p-6 max-w-2xl">
                          <Card>
                              <CardHeader>
                                  <CardTitle>Profile</CardTitle>
                                  <CardDescription>Update your display name and username.</CardDescription>
                              </CardHeader>
                              <CardContent>
                                  {isLoading || !user ? (
                                      <p className="text-sm text-muted-foreground">Loading...</p>
                                  ) : (
                                      <ProfileForm
                                          userId={user.id}
                                          defaultValues={{
                                              firstName: user.firstName ?? "",
                                              lastName: user.lastName ?? "",
                                              username: user.username ?? "",
                                          }}
                                      />
                                  )}
                              </CardContent>
                          </Card>

                          <Card>
                              <CardHeader>
                                  <CardTitle>Change Password</CardTitle>
                                  <CardDescription>Enter your current password and choose a new one.</CardDescription>
                              </CardHeader>
                              <CardContent>
                                  {!user ? (
                                      <p className="text-sm text-muted-foreground">Loading...</p>
                                  ) : (
                                      <ChangePasswordForm userId={user.id} />
                                  )}
                              </CardContent>
                          </Card>
                      </div>
                  </SidebarInset>
              </SidebarProvider>
          </AuthGuard>
      );
  }
  ```

- [ ] **Step 5.2: Typecheck**

  ```bash
  yarn workspace web exec tsc --noEmit
  ```

  Expected: No errors.

- [ ] **Step 5.3: Manual verification — Settings page**

  Start dev servers: `yarn dev`

  Log in as `eve@example.com`. Go to `/settings`.

  - Profile section should be pre-filled with the user's current name and username.
  - Edit first name, click Save → toast "Profile updated" appears.
  - Change Password: enter wrong current password → toast "Invalid current password".
  - Enter correct current password + matching new passwords → toast "Password changed". Fields clear.
  - Enter new password shorter than 8 chars → field-level error "Must be at least 8 characters".

- [ ] **Step 5.4: Commit**

  ```bash
  git add apps/web/app/settings/page.tsx
  git commit -m "feat(web): wire up Settings page with live Profile and Change Password forms"
  ```

---

## Task 6: Backend — Zod schemas for project routes

**Files:**
- Modify: `apps/backend/common/ZodSchema.ts`

- [ ] **Step 6.1: Add project schemas**

  Append to `apps/backend/common/ZodSchema.ts`:

  ```ts
  export const createProjectSchema = z.object({
      name: z.string().min(1, "Project name is required").max(100),
      description: z.string().max(500).optional(),
  });

  export const updateProjectSchema = z
      .object({
          name: z.string().min(1).max(100).optional(),
          description: z.string().max(500).optional(),
      })
      .refine((data) => Object.keys(data).length > 0, {
          message: "At least one field is required",
      });

  export const addMemberSchema = z.object({
      userId: z.string().min(1, "userId is required"),
  });
  ```

- [ ] **Step 6.2: Typecheck**

  ```bash
  yarn workspace backend exec tsc --noEmit
  ```

- [ ] **Step 6.3: Commit**

  ```bash
  git add apps/backend/common/ZodSchema.ts
  git commit -m "feat(backend): add Zod schemas for project CRUD and member management"
  ```

---

## Task 7: Backend — Update `GET /project` + add `POST /project`

**Files:**
- Modify: `apps/backend/app/project/route.ts`

- [ ] **Step 7.1: Rewrite `apps/backend/app/project/route.ts`**

  ```ts
  import prisma from "@/lib/db";
  import { createProjectSchema } from "@/common/ZodSchema";
  import { NextRequest, NextResponse } from "next/server";

  async function getCallerRole(userId: string) {
      const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { role: true },
      });
      return user?.role ?? null;
  }

  export async function GET(req: NextRequest) {
      try {
          const callerId = req.headers.get("x-user-id");
          if (!callerId) {
              return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
          }

          const role = await getCallerRole(callerId);
          if (!role) {
              return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
          }

          let projects;
          if (role === "EMPLOYEE") {
              // Only return projects where this user is a member
              const memberships = await prisma.projectMember.findMany({
                  where: { userId: callerId },
                  include: {
                      project: {
                          select: { id: true, name: true, deletedAt: true },
                      },
                  },
              });
              projects = memberships
                  .filter((m) => m.project.deletedAt === null)
                  .map((m) => ({ id: m.project.id, name: m.project.name }));
          } else {
              // MANAGER and ADMIN see all active projects
              projects = await prisma.project.findMany({
                  where: { deletedAt: null },
                  select: { id: true, name: true },
                  orderBy: { name: "asc" },
              });
          }

          return NextResponse.json({ projects }, { status: 200 });
      } catch (error) {
          console.error("GET /project error:", error);
          return NextResponse.json({ message: "Error fetching projects" }, { status: 500 });
      }
  }

  export async function POST(req: NextRequest) {
      try {
          const callerId = req.headers.get("x-user-id");
          if (!callerId) {
              return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
          }

          const role = await getCallerRole(callerId);
          if (role !== "MANAGER" && role !== "ADMIN") {
              return NextResponse.json({ error: "Forbidden" }, { status: 403 });
          }

          const raw = await req.json();
          const parsed = createProjectSchema.safeParse(raw);
          if (!parsed.success) {
              return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
          }

          const project = await prisma.project.create({
              data: {
                  name: parsed.data.name,
                  description: parsed.data.description,
                  managerId: callerId,
                  // Auto-add creator as a member
                  members: {
                      create: { userId: callerId },
                  },
              },
              select: { id: true, name: true, description: true, managerId: true, createdAt: true },
          });

          return NextResponse.json({ project }, { status: 201 });
      } catch (error) {
          console.error("POST /project error:", error);
          return NextResponse.json({ error: "Error creating project" }, { status: 500 });
      }
  }
  ```

- [ ] **Step 7.2: Typecheck**

  ```bash
  yarn workspace backend exec tsc --noEmit
  ```

  Expected: No errors.

- [ ] **Step 7.3: Commit**

  ```bash
  git add apps/backend/app/project/route.ts
  git commit -m "feat(backend): role-filtered GET /project + POST /project (manager/admin only)"
  ```

---

## Task 8: Backend — GET / PATCH / DELETE `/project/[id]`

**Files:**
- Create: `apps/backend/app/project/[id]/route.ts`

- [ ] **Step 8.1: Create `apps/backend/app/project/[id]/route.ts`**

  ```ts
  import prisma from "@/lib/db";
  import { updateProjectSchema } from "@/common/ZodSchema";
  import { NextRequest, NextResponse } from "next/server";

  async function getCallerRole(userId: string) {
      const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { role: true },
      });
      return user?.role ?? null;
  }

  type RouteContext = { params: Promise<{ id: string }> };

  export async function GET(req: NextRequest, { params }: RouteContext) {
      try {
          const callerId = req.headers.get("x-user-id");
          if (!callerId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

          const { id } = await params;

          const project = await prisma.project.findFirst({
              where: { id, deletedAt: null },
              select: {
                  id: true,
                  name: true,
                  description: true,
                  managerId: true,
                  createdAt: true,
                  members: {
                      select: {
                          user: {
                              select: {
                                  id: true,
                                  username: true,
                                  firstName: true,
                                  lastName: true,
                                  email: true,
                              },
                          },
                      },
                  },
              },
          });

          if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

          const role = await getCallerRole(callerId);
          const isMember = project.members.some((m) => m.user.id === callerId);
          if (role === "EMPLOYEE" && !isMember) {
              return NextResponse.json({ error: "Forbidden" }, { status: 403 });
          }

          const response = {
              ...project,
              members: project.members.map((m) => m.user),
          };

          return NextResponse.json({ project: response }, { status: 200 });
      } catch (error) {
          console.error("GET /project/[id] error:", error);
          return NextResponse.json({ error: "Internal server error" }, { status: 500 });
      }
  }

  export async function PATCH(req: NextRequest, { params }: RouteContext) {
      try {
          const callerId = req.headers.get("x-user-id");
          if (!callerId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

          const { id } = await params;
          const role = await getCallerRole(callerId);

          const project = await prisma.project.findFirst({
              where: { id, deletedAt: null },
              select: { managerId: true },
          });
          if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

          const isOwner = project.managerId === callerId;
          if (!isOwner && role !== "ADMIN") {
              return NextResponse.json({ error: "Forbidden" }, { status: 403 });
          }

          const raw = await req.json();
          const parsed = updateProjectSchema.safeParse(raw);
          if (!parsed.success) {
              return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
          }

          const updated = await prisma.project.update({
              where: { id },
              data: parsed.data,
              select: { id: true, name: true, description: true, managerId: true, updatedAt: true },
          });

          return NextResponse.json({ project: updated }, { status: 200 });
      } catch (error) {
          console.error("PATCH /project/[id] error:", error);
          return NextResponse.json({ error: "Internal server error" }, { status: 500 });
      }
  }

  export async function DELETE(req: NextRequest, { params }: RouteContext) {
      try {
          const callerId = req.headers.get("x-user-id");
          if (!callerId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

          const { id } = await params;
          const role = await getCallerRole(callerId);

          const project = await prisma.project.findFirst({
              where: { id, deletedAt: null },
              select: { managerId: true },
          });
          if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

          const isOwner = project.managerId === callerId;
          if (!isOwner && role !== "ADMIN") {
              return NextResponse.json({ error: "Forbidden" }, { status: 403 });
          }

          await prisma.project.update({
              where: { id },
              data: { deletedAt: new Date() },
          });

          return NextResponse.json({ message: "Project deleted" }, { status: 200 });
      } catch (error) {
          console.error("DELETE /project/[id] error:", error);
          return NextResponse.json({ error: "Internal server error" }, { status: 500 });
      }
  }
  ```

- [ ] **Step 8.2: Typecheck**

  ```bash
  yarn workspace backend exec tsc --noEmit
  ```

- [ ] **Step 8.3: Commit**

  ```bash
  git add apps/backend/app/project/
  git commit -m "feat(backend): GET/PATCH/DELETE /project/[id] with role enforcement"
  ```

---

## Task 9: Backend — Member management routes

**Files:**
- Create: `apps/backend/app/project/[id]/members/route.ts`
- Create: `apps/backend/app/project/[id]/members/[memberId]/route.ts`

- [ ] **Step 9.1: Create `apps/backend/app/project/[id]/members/route.ts`**

  ```ts
  import prisma from "@/lib/db";
  import { addMemberSchema } from "@/common/ZodSchema";
  import { NextRequest, NextResponse } from "next/server";

  async function getCallerRole(userId: string) {
      const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { role: true },
      });
      return user?.role ?? null;
  }

  type RouteContext = { params: Promise<{ id: string }> };

  export async function POST(req: NextRequest, { params }: RouteContext) {
      try {
          const callerId = req.headers.get("x-user-id");
          if (!callerId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

          const { id: projectId } = await params;
          const role = await getCallerRole(callerId);

          const project = await prisma.project.findFirst({
              where: { id: projectId, deletedAt: null },
              select: { managerId: true },
          });
          if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

          const isOwner = project.managerId === callerId;
          if (!isOwner && role !== "ADMIN") {
              return NextResponse.json({ error: "Forbidden" }, { status: 403 });
          }

          const raw = await req.json();
          const parsed = addMemberSchema.safeParse(raw);
          if (!parsed.success) {
              return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
          }

          // Verify the target user exists
          const targetUser = await prisma.user.findFirst({
              where: { id: parsed.data.userId, isDeleted: false },
              select: { id: true },
          });
          if (!targetUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

          try {
              await prisma.projectMember.create({
                  data: { userId: parsed.data.userId, projectId },
              });
          } catch {
              // P2002 = unique constraint violation = already a member
              return NextResponse.json({ error: "User is already a member of this project" }, { status: 409 });
          }

          return NextResponse.json({ message: "Member added" }, { status: 201 });
      } catch (error) {
          console.error("POST /project/[id]/members error:", error);
          return NextResponse.json({ error: "Internal server error" }, { status: 500 });
      }
  }
  ```

- [ ] **Step 9.2: Create `apps/backend/app/project/[id]/members/[memberId]/route.ts`**

  ```ts
  import prisma from "@/lib/db";
  import { NextRequest, NextResponse } from "next/server";

  async function getCallerRole(userId: string) {
      const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { role: true },
      });
      return user?.role ?? null;
  }

  type RouteContext = { params: Promise<{ id: string; memberId: string }> };

  export async function DELETE(req: NextRequest, { params }: RouteContext) {
      try {
          const callerId = req.headers.get("x-user-id");
          if (!callerId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

          const { id: projectId, memberId } = await params;
          const role = await getCallerRole(callerId);

          const project = await prisma.project.findFirst({
              where: { id: projectId, deletedAt: null },
              select: { managerId: true },
          });
          if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

          const isOwner = project.managerId === callerId;
          if (!isOwner && role !== "ADMIN") {
              return NextResponse.json({ error: "Forbidden" }, { status: 403 });
          }

          await prisma.projectMember.delete({
              where: { userId_projectId: { userId: memberId, projectId } },
          });

          return NextResponse.json({ message: "Member removed" }, { status: 200 });
      } catch (error) {
          console.error("DELETE /project/[id]/members/[memberId] error:", error);
          return NextResponse.json({ error: "Internal server error" }, { status: 500 });
      }
  }
  ```

- [ ] **Step 9.3: Typecheck**

  ```bash
  yarn workspace backend exec tsc --noEmit
  ```

- [ ] **Step 9.4: Commit**

  ```bash
  git add apps/backend/app/project/
  git commit -m "feat(backend): add POST /project/[id]/members and DELETE /project/[id]/members/[memberId]"
  ```

---

## Task 10: Frontend — Project actions and hooks

**Files:**
- Create: `apps/web/actions/projects.ts`
- Create: `apps/web/hooks/use-project-queries.ts`

- [ ] **Step 10.1: Create `apps/web/actions/projects.ts`**

  ```ts
  import { ProjectDetail } from "@/types";
  import { fetchWithAuth } from "@/utils/api";

  export interface CreateProjectPayload {
      name: string;
      description?: string;
  }

  export interface UpdateProjectPayload {
      name?: string;
      description?: string;
  }

  export const getProject = (id: string): Promise<{ project: ProjectDetail }> =>
      fetchWithAuth(`/project/${id}`, { method: "GET" });

  export const createProject = (data: CreateProjectPayload): Promise<{ project: { id: string; name: string } }> =>
      fetchWithAuth(`/project`, { method: "POST", body: JSON.stringify(data) });

  export const updateProject = (
      id: string,
      data: UpdateProjectPayload
  ): Promise<{ project: { id: string; name: string } }> =>
      fetchWithAuth(`/project/${id}`, { method: "PATCH", body: JSON.stringify(data) });

  export const deleteProject = (id: string): Promise<{ message: string }> =>
      fetchWithAuth(`/project/${id}`, { method: "DELETE" });

  export const addMember = (projectId: string, userId: string): Promise<{ message: string }> =>
      fetchWithAuth(`/project/${projectId}/members`, {
          method: "POST",
          body: JSON.stringify({ userId }),
      });

  export const removeMember = (projectId: string, memberId: string): Promise<{ message: string }> =>
      fetchWithAuth(`/project/${projectId}/members/${memberId}`, { method: "DELETE" });
  ```

- [ ] **Step 10.2: Create `apps/web/hooks/use-project-queries.ts`**

  ```ts
  "use client";

  import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
  import {
      addMember,
      createProject,
      deleteProject,
      getProject,
      removeMember,
      updateProject,
      type CreateProjectPayload,
      type UpdateProjectPayload,
  } from "@/actions/projects";
  import { queryKeys } from "@/lib/query-keys";

  export function useProject(id: string) {
      return useQuery({
          queryKey: queryKeys.projects.detail(id),
          queryFn: () => getProject(id),
          select: (data) => data.project,
          enabled: Boolean(id),
      });
  }

  export function useCreateProject() {
      const queryClient = useQueryClient();
      return useMutation({
          mutationFn: (data: CreateProjectPayload) => createProject(data),
          onSuccess: () => {
              queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
          },
      });
  }

  export function useUpdateProject(id: string) {
      const queryClient = useQueryClient();
      return useMutation({
          mutationFn: (data: UpdateProjectPayload) => updateProject(id, data),
          onSuccess: () => {
              queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
              queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(id) });
          },
      });
  }

  export function useDeleteProject() {
      const queryClient = useQueryClient();
      return useMutation({
          mutationFn: (id: string) => deleteProject(id),
          onSuccess: () => {
              queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
          },
      });
  }

  export function useAddMember(projectId: string) {
      const queryClient = useQueryClient();
      return useMutation({
          mutationFn: (userId: string) => addMember(projectId, userId),
          onSuccess: () => {
              queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(projectId) });
          },
      });
  }

  export function useRemoveMember(projectId: string) {
      const queryClient = useQueryClient();
      return useMutation({
          mutationFn: (memberId: string) => removeMember(projectId, memberId),
          onSuccess: () => {
              queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(projectId) });
          },
      });
  }
  ```

- [ ] **Step 10.3: Typecheck**

  ```bash
  yarn workspace web exec tsc --noEmit
  ```

- [ ] **Step 10.4: Commit**

  ```bash
  git add apps/web/actions/projects.ts apps/web/hooks/use-project-queries.ts
  git commit -m "feat(web): add project actions and TanStack Query hooks"
  ```

---

## Task 11: Frontend — Project form modal

**Files:**
- Create: `apps/web/components/project-form-modal.tsx`

- [ ] **Step 11.1: Create `apps/web/components/project-form-modal.tsx`**

  ```tsx
  "use client";

  import { useEffect } from "react";
  import { useForm } from "@tanstack/react-form-nextjs";
  import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@repo/ui/components/dialog";
  import { Field, FieldGroup, FieldLabel } from "@repo/ui/components/field";
  import { Input } from "@repo/ui/components/input";
  import { Textarea } from "@repo/ui/components/textarea";
  import { Button } from "@repo/ui/components/button";
  import { toast } from "@repo/ui/components";
  import { useCreateProject, useUpdateProject } from "@/hooks/use-project-queries";

  type ProjectFormModalProps = {
      open: boolean;
      onOpenChange: (open: boolean) => void;
      /** If provided, the modal is in edit mode. */
      project?: { id: string; name: string; description: string | null };
  };

  export function ProjectFormModal({ open, onOpenChange, project }: ProjectFormModalProps) {
      const isEdit = Boolean(project);
      const createProject = useCreateProject();
      const updateProject = useUpdateProject(project?.id ?? "");

      const form = useForm({
          defaultValues: { name: "", description: "" },
          onSubmit: async ({ value }) => {
              try {
                  if (isEdit && project) {
                      await updateProject.mutateAsync({ name: value.name, description: value.description || undefined });
                      toast.success("Project updated");
                  } else {
                      await createProject.mutateAsync({ name: value.name, description: value.description || undefined });
                      toast.success("Project created");
                  }
                  onOpenChange(false);
              } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Something went wrong");
              }
          },
      });

      useEffect(() => {
          if (!open) return;
          form.reset({
              name: project?.name ?? "",
              description: project?.description ?? "",
          });
      }, [open, project, form]);

      const isPending = createProject.isPending || updateProject.isPending;

      return (
          <Dialog open={open} onOpenChange={onOpenChange}>
              <DialogContent className="sm:max-w-[480px]">
                  <DialogHeader>
                      <DialogTitle>{isEdit ? "Edit Project" : "New Project"}</DialogTitle>
                  </DialogHeader>
                  <form
                      className="py-4"
                      onSubmit={(e) => {
                          e.preventDefault();
                          void form.handleSubmit();
                      }}
                  >
                      <FieldGroup>
                          <form.Field
                              name="name"
                              validators={{ onChange: ({ value }) => (value.trim() ? undefined : "Project name is required") }}
                          >
                              {(field) => (
                                  <Field>
                                      <FieldLabel htmlFor="project-name">Project Name *</FieldLabel>
                                      <Input
                                          id="project-name"
                                          value={field.state.value}
                                          onChange={(e) => field.handleChange(e.target.value)}
                                          placeholder="e.g. Website Redesign"
                                      />
                                  </Field>
                              )}
                          </form.Field>
                          <form.Field name="description">
                              {(field) => (
                                  <Field>
                                      <FieldLabel htmlFor="project-description">Description</FieldLabel>
                                      <Textarea
                                          id="project-description"
                                          value={field.state.value}
                                          onChange={(e) => field.handleChange(e.target.value)}
                                          placeholder="Optional project description"
                                          className="resize-none"
                                          rows={3}
                                      />
                                  </Field>
                              )}
                          </form.Field>
                      </FieldGroup>
                      <DialogFooter className="mt-4 flex gap-2">
                          <form.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting]}>
                              {([canSubmit, isSubmitting]) => (
                                  <Button type="submit" disabled={!canSubmit || isPending} className="flex-1">
                                      {isSubmitting || isPending ? "Saving..." : isEdit ? "Save Changes" : "Create Project"}
                                  </Button>
                              )}
                          </form.Subscribe>
                          <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
                              Cancel
                          </Button>
                      </DialogFooter>
                  </form>
              </DialogContent>
          </Dialog>
      );
  }
  ```

- [ ] **Step 11.2: Typecheck**

  ```bash
  yarn workspace web exec tsc --noEmit
  ```

- [ ] **Step 11.3: Commit**

  ```bash
  git add apps/web/components/project-form-modal.tsx
  git commit -m "feat(web): add ProjectFormModal for create/edit projects"
  ```

---

## Task 12: Frontend — Project members modal

**Files:**
- Create: `apps/web/components/project-members-modal.tsx`

- [ ] **Step 12.1: Create `apps/web/components/project-members-modal.tsx`**

  ```tsx
  "use client";

  import { useState } from "react";
  import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@repo/ui/components/dialog";
  import { Button } from "@repo/ui/components/button";
  import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/components/select";
  import { toast } from "@repo/ui/components";
  import { useProject, useAddMember, useRemoveMember } from "@/hooks/use-project-queries";
  import { useQuery } from "@tanstack/react-query";
  import { getUsers } from "@/actions/user";
  import { queryKeys } from "@/lib/query-keys";
  import { Trash2Icon, UserPlusIcon } from "lucide-react";
  import { ProjectMemberUser } from "@/types";

  type ProjectMembersModalProps = {
      open: boolean;
      onOpenChange: (open: boolean) => void;
      projectId: string;
      isManagerOrAdmin: boolean;
  };

  export function ProjectMembersModal({ open, onOpenChange, projectId, isManagerOrAdmin }: ProjectMembersModalProps) {
      const [selectedUserId, setSelectedUserId] = useState("");
      const { data: project, isLoading } = useProject(projectId);
      const { data: usersData } = useQuery({
          queryKey: ["users", "all"],
          queryFn: getUsers,
          enabled: isManagerOrAdmin && open,
      });
      const addMember = useAddMember(projectId);
      const removeMember = useRemoveMember(projectId);

      const memberIds = new Set(project?.members.map((m: ProjectMemberUser) => m.id) ?? []);
      const availableUsers = (usersData?.users ?? []).filter((u) => !memberIds.has(u.id));

      async function handleAddMember() {
          if (!selectedUserId) return;
          try {
              await addMember.mutateAsync(selectedUserId);
              setSelectedUserId("");
              toast.success("Member added");
          } catch (error) {
              toast.error(error instanceof Error ? error.message : "Failed to add member");
          }
      }

      async function handleRemoveMember(memberId: string) {
          try {
              await removeMember.mutateAsync(memberId);
              toast.success("Member removed");
          } catch (error) {
              toast.error(error instanceof Error ? error.message : "Failed to remove member");
          }
      }

      return (
          <Dialog open={open} onOpenChange={onOpenChange}>
              <DialogContent className="sm:max-w-[480px]">
                  <DialogHeader>
                      <DialogTitle>Project Members — {project?.name}</DialogTitle>
                  </DialogHeader>

                  <div className="py-2 space-y-4">
                      {isLoading ? (
                          <p className="text-sm text-muted-foreground">Loading...</p>
                      ) : (
                          <ul className="space-y-2">
                              {(project?.members ?? []).map((member: ProjectMemberUser) => (
                                  <li key={member.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                                      <div>
                                          <p className="text-sm font-medium">
                                              {[member.firstName, member.lastName].filter(Boolean).join(" ") || member.username}
                                          </p>
                                          <p className="text-xs text-muted-foreground">{member.email}</p>
                                      </div>
                                      {isManagerOrAdmin && (
                                          <Button
                                              variant="ghost"
                                              size="icon"
                                              className="text-destructive hover:text-destructive"
                                              onClick={() => handleRemoveMember(member.id)}
                                              disabled={removeMember.isPending}
                                          >
                                              <Trash2Icon className="size-4" />
                                          </Button>
                                      )}
                                  </li>
                              ))}
                              {(project?.members ?? []).length === 0 && (
                                  <p className="text-sm text-muted-foreground">No members yet.</p>
                              )}
                          </ul>
                      )}

                      {isManagerOrAdmin && (
                          <div className="flex gap-2 pt-2 border-t">
                              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                                  <SelectTrigger className="flex-1">
                                      <SelectValue placeholder="Select user to add" />
                                  </SelectTrigger>
                                  <SelectContent>
                                      {availableUsers.map((u) => (
                                          <SelectItem key={u.id} value={u.id}>
                                              {[u.firstName, u.lastName].filter(Boolean).join(" ") || u.username} ({u.email})
                                          </SelectItem>
                                      ))}
                                  </SelectContent>
                              </Select>
                              <Button
                                  onClick={handleAddMember}
                                  disabled={!selectedUserId || addMember.isPending}
                                  size="icon"
                              >
                                  <UserPlusIcon className="size-4" />
                              </Button>
                          </div>
                      )}
                  </div>
              </DialogContent>
          </Dialog>
      );
  }
  ```

- [ ] **Step 12.2: Typecheck**

  ```bash
  yarn workspace web exec tsc --noEmit
  ```

- [ ] **Step 12.3: Commit**

  ```bash
  git add apps/web/components/project-members-modal.tsx
  git commit -m "feat(web): add ProjectMembersModal for viewing and managing project members"
  ```

---

## Task 13: Frontend — Projects page

**Files:**
- Create: `apps/web/app/projects/page.tsx`

- [ ] **Step 13.1: Create `apps/web/app/projects/page.tsx`**

  ```tsx
  "use client";

  import { useState } from "react";
  import { AppSidebar } from "@/components/app-sidebar";
  import { AuthGuard } from "@/components/auth-guard";
  import { ProjectFormModal } from "@/components/project-form-modal";
  import { ProjectMembersModal } from "@/components/project-members-modal";
  import { useCurrentUser } from "@/hooks/use-user-queries";
  import { useDeleteProject } from "@/hooks/use-project-queries";
  import { useProjects } from "@/hooks/use-timesheet-queries";
  import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage } from "@repo/ui/components/breadcrumb";
  import { Button } from "@repo/ui/components/button";
  import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@repo/ui/components/card";
  import { Separator } from "@repo/ui/components/separator";
  import { SidebarInset, SidebarProvider, SidebarTrigger } from "@repo/ui/components/sidebar";
  import { toast } from "@repo/ui/components";
  import { FolderKanbanIcon, PlusIcon, Trash2Icon, UsersIcon, PencilIcon } from "lucide-react";
  import { Project } from "@/types";

  export default function ProjectsPage() {
      const { data: user } = useCurrentUser();
      const { data: projectsData, isLoading } = useProjects();
      const deleteProject = useDeleteProject();

      const [formModal, setFormModal] = useState<{ open: boolean; project?: Project }>({ open: false });
      const [membersModal, setMembersModal] = useState<{ open: boolean; projectId: string }>({
          open: false,
          projectId: "",
      });

      const isManagerOrAdmin = user?.role === "MANAGER" || user?.role === "ADMIN";
      const projects = projectsData?.projects ?? [];

      async function handleDelete(projectId: string, projectName: string) {
          if (!confirm(`Delete project "${projectName}"? This cannot be undone.`)) return;
          try {
              await deleteProject.mutateAsync(projectId);
              toast.success("Project deleted");
          } catch (error) {
              toast.error(error instanceof Error ? error.message : "Failed to delete project");
          }
      }

      return (
          <AuthGuard requireUnauthenticated={false}>
              <SidebarProvider>
                  <AppSidebar />
                  <SidebarInset>
                      <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
                          <div className="flex items-center gap-2 px-4">
                              <SidebarTrigger className="-ml-1" />
                              <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
                              <Breadcrumb>
                                  <BreadcrumbList>
                                      <BreadcrumbItem>
                                          <BreadcrumbPage>Projects</BreadcrumbPage>
                                      </BreadcrumbItem>
                                  </BreadcrumbList>
                              </Breadcrumb>
                          </div>
                      </header>

                      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
                          <div className="flex items-center justify-between">
                              <h1 className="text-xl font-semibold">Projects</h1>
                              {isManagerOrAdmin && (
                                  <Button onClick={() => setFormModal({ open: true })}>
                                      <PlusIcon className="size-4 mr-2" />
                                      New Project
                                  </Button>
                              )}
                          </div>

                          {isLoading ? (
                              <p className="text-sm text-muted-foreground">Loading projects...</p>
                          ) : projects.length === 0 ? (
                              <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground">
                                  <FolderKanbanIcon className="size-12 opacity-30" />
                                  <p className="text-sm">
                                      {isManagerOrAdmin
                                          ? "No projects yet. Create one to get started."
                                          : "You haven't been assigned to any projects yet."}
                                  </p>
                              </div>
                          ) : (
                              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                  {projects.map((project) => (
                                      <Card key={project.id} className="flex flex-col">
                                          <CardHeader>
                                              <CardTitle className="text-base">{project.name}</CardTitle>
                                              {project.description && (
                                                  <CardDescription className="line-clamp-2">{project.description}</CardDescription>
                                              )}
                                          </CardHeader>
                                          <CardContent className="flex-1" />
                                          <CardFooter className="flex gap-2 pt-0">
                                              <Button
                                                  variant="outline"
                                                  size="sm"
                                                  className="flex-1"
                                                  onClick={() =>
                                                      setMembersModal({ open: true, projectId: project.id })
                                                  }
                                              >
                                                  <UsersIcon className="size-4 mr-1.5" />
                                                  Members
                                              </Button>
                                              {isManagerOrAdmin && (
                                                  <>
                                                      <Button
                                                          variant="outline"
                                                          size="icon"
                                                          onClick={() => setFormModal({ open: true, project })}
                                                      >
                                                          <PencilIcon className="size-4" />
                                                      </Button>
                                                      <Button
                                                          variant="outline"
                                                          size="icon"
                                                          className="text-destructive hover:text-destructive"
                                                          onClick={() => handleDelete(project.id, project.name)}
                                                          disabled={deleteProject.isPending}
                                                      >
                                                          <Trash2Icon className="size-4" />
                                                      </Button>
                                                  </>
                                              )}
                                          </CardFooter>
                                      </Card>
                                  ))}
                              </div>
                          )}
                      </div>

                      <ProjectFormModal
                          open={formModal.open}
                          onOpenChange={(open) => setFormModal((s) => ({ ...s, open }))}
                          project={formModal.project}
                      />
                      <ProjectMembersModal
                          open={membersModal.open}
                          onOpenChange={(open) => setMembersModal((s) => ({ ...s, open }))}
                          projectId={membersModal.projectId}
                          isManagerOrAdmin={isManagerOrAdmin}
                      />
                  </SidebarInset>
              </SidebarProvider>
          </AuthGuard>
      );
  }
  ```

  > Note: `useProjects` in `use-timesheet-queries.ts` already calls `GET /project`. The updated backend now filters by membership for `EMPLOYEE` and returns all for `MANAGER`/`ADMIN`. No hook change needed — the query key stays the same.

- [ ] **Step 13.2: Typecheck**

  ```bash
  yarn workspace web exec tsc --noEmit
  ```

- [ ] **Step 13.3: Commit**

  ```bash
  git add apps/web/app/projects/
  git commit -m "feat(web): add Projects page with project cards, create/edit/delete, and member management"
  ```

---

## Task 14: Frontend — Add Projects to sidebar

**Files:**
- Modify: `apps/web/components/app-sidebar.tsx`

- [ ] **Step 14.1: Add Projects nav item to `app-sidebar.tsx`**

  Import `FolderKanban` from lucide-react (add to the existing import line):

  ```ts
  import {
      AudioWaveform,
      Command,
      FolderKanban,
      GalleryVerticalEnd,
      LucideIcon,
      Settings,
      Settings2,
      SquareTerminal
  } from "lucide-react";
  ```

  In the `navMain` array, add the Projects entry after Timesheets and before Settings:

  ```ts
  {
      title: "Projects",
      url: "/projects",
      icon: FolderKanban,
  },
  ```

- [ ] **Step 14.2: Typecheck**

  ```bash
  yarn workspace web exec tsc --noEmit
  ```

- [ ] **Step 14.3: Commit**

  ```bash
  git add apps/web/components/app-sidebar.tsx
  git commit -m "feat(web): add Projects entry to app sidebar"
  ```

---

## Task 15: Final verification

- [ ] **Step 15.1: Full TypeScript check — both apps**

  ```bash
  yarn workspace web exec tsc --noEmit
  yarn workspace backend exec tsc --noEmit
  ```

  Expected: No errors in either app.

- [ ] **Step 15.2: Lint — both apps**

  ```bash
  yarn workspace web lint
  yarn workspace backend lint
  ```

  Expected: No errors.

- [ ] **Step 15.3: Start dev servers and run manual test matrix**

  ```bash
  yarn dev
  ```

  Open `http://localhost:3001`.

  **As `eve@example.com` (EMPLOYEE):**
  - [ ] `/settings` → Profile form pre-populated → Save updates name → Toast success
  - [ ] `/settings` → Change Password → wrong current password → Toast error "Invalid current password"
  - [ ] `/settings` → Change Password → valid current + matching new → Toast success, fields clear
  - [ ] `/projects` → Shows only projects where Eve is a member
  - [ ] `/projects` → No "New Project" button visible
  - [ ] `AddEntryModal` project dropdown → only shows Eve's projects

  **As `dave@example.com` (MANAGER):**
  - [ ] `/projects` → Shows all active projects → "New Project" button visible
  - [ ] Create project → appears in list, creator auto-added as member
  - [ ] Edit project → name/description updates
  - [ ] Members modal → Can add Eve, can remove Eve
  - [ ] Delete project → confirm dialog → project disappears from list
  - [ ] `/settings` → Profile and password forms work the same

- [ ] **Step 15.4: Final commit (update CLAUDE.md codebase snapshot)**

  Update the "Backend routes (today)" section in `CLAUDE.md` to list the new project routes:

  ```markdown
  - **Project routes:** `/project` (GET list, POST create), `/project/[id]` (GET/PATCH/DELETE), `/project/[id]/members` (POST), `/project/[id]/members/[memberId]` (DELETE)
  ```

  ```bash
  git add CLAUDE.md
  git commit -m "docs: update CLAUDE.md with new project routes"
  ```
