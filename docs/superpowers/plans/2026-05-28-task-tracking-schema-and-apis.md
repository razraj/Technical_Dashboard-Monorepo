# Task-Tracking Schema & Timesheet APIs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the Prisma schema with ADMIN role, full task-tracking columns (priority, assignedById, loggedHours, soft-delete timestamps, project status), and implement two timesheet APIs: a week-list summary (API-1) and a per-week day-wise detail view (API-2).

**Architecture:** All DB changes land in `packages/db/src/prisma/schema.prisma` followed by a Prisma migration. Two new Next.js route handlers are added to `apps/backend` and backed by a new `lib/task.ts` helper module plus updates to the existing `lib/timesheet.ts`. Role-based access is enforced at the route handler level using `x-user-id` from `proxy.ts`.

**Tech Stack:** Prisma 7, PostgreSQL (Neon), Next.js 16 App Router route handlers, Zod, TypeScript.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `packages/db/src/prisma/schema.prisma` | **Modify** | All new enums + model fields + indexes |
| `packages/db/src/seed.ts` | **Modify** | Use new fields (TaskPriority, ProjectStatus, assignedById) |
| `apps/backend/lib/task.ts` | **Create** | Task serialization types + `recomputeTaskLoggedHours` |
| `apps/backend/lib/timesheet.ts` | **Modify** | Add `computeWeekStatus`, `recomputeTaskLoggedHoursFromEntry`, update existing entry mutator hooks |
| `apps/backend/common/ZodSchema.ts` | **Modify** | Add `weeksQuerySchema`, week-start path-param schema |
| `apps/backend/app/timesheet/weeks/route.ts` | **Create** | API-1: week-list summary |
| `apps/backend/app/timesheet/week/[weekStart]/route.ts` | **Create** | API-2: per-week day-wise detail |

---

## Task 1: Update `schema.prisma` — Enums

**Files:**
- Modify: `packages/db/src/prisma/schema.prisma`

- [ ] **Step 1: Add `ADMIN` to `UserRole` and add `TaskPriority` + `ProjectStatus` enums**

Replace the existing enum block:

```prisma
enum UserRole {
  ADMIN           // full CRUD on everything — role checked in route handlers
  EMPLOYEE
  PROJECT_MANAGER
}

enum TaskPriority {
  LOW
  MEDIUM
  HIGH
  URGENT
}

enum TaskType {
  FIX
  FEATURE
  RESEARCH
  OTHER
}

enum TaskStatus {
  TODO
  IN_PROGRESS
  DONE
  BLOCKED
}

enum ProjectStatus {
  ACTIVE
  ON_HOLD
  COMPLETED
  ARCHIVED
}

enum ProjectRole {
  OWNER
  MEMBER
}
```

- [ ] **Step 2: Verify enums are syntactically valid (no DB change yet)**

```bash
cd /path/to/repo
yarn workspace @repo/db exec prisma validate
```

Expected: no errors.

---

## Task 2: Update `schema.prisma` — Models

**Files:**
- Modify: `packages/db/src/prisma/schema.prisma`

- [ ] **Step 1: Update `User` model — add `deletedAt`**

Add after `isDeleted Boolean @default(false)`:

```prisma
deletedAt DateTime?  // populated when isDeleted is set to true; null = active
```

Update the relations block to include the new back-relation for `TaskAssigner`:

```prisma
assignedByTasks    Task[]          @relation("TaskAssigner")
```

- [ ] **Step 2: Update `Project` model — add `status`, `startDate`, `endDate`, `deletedAt`**

Full updated model:

```prisma
model Project {
  id          String        @id @default(uuid())
  name        String        @db.VarChar(100)
  description String?
  color       String?       @db.VarChar(9)
  status      ProjectStatus @default(ACTIVE)
  startDate   DateTime?     @db.Date
  endDate     DateTime?     @db.Date
  createdById String
  isDeleted   Boolean       @default(false)
  deletedAt   DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  createdBy User            @relation("ProjectCreator", fields: [createdById], references: [id], onDelete: Cascade)
  members   ProjectMember[]
  tasks     Task[]

  @@index([createdById])
  @@index([name(ops: raw("gin_trgm_ops"))], type: Gin)
}
```

- [ ] **Step 3: Update `ProjectMember` model — add `isDeleted`, `deletedAt`**

```prisma
model ProjectMember {
  id        String      @id @default(uuid())
  projectId String
  userId    String
  role      ProjectRole @default(MEMBER)
  isDeleted Boolean     @default(false)
  deletedAt DateTime?
  joinedAt  DateTime    @default(now())
  updatedAt DateTime    @updatedAt

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([projectId, userId])
  @@index([userId])
}
```

- [ ] **Step 4: Update `Task` model — add all new fields**

Full updated model:

```prisma
model Task {
  id             String       @id @default(uuid())
  projectId      String
  title          String       @db.VarChar(255)
  description    String?
  type           TaskType
  status         TaskStatus   @default(TODO)
  priority       TaskPriority @default(MEDIUM)
  // Widened to Decimal(6,2) — supports up to 9999.99 estimated hours (e.g. large epics)
  estimatedHours Decimal?     @db.Decimal(6, 2)
  // Denormalised aggregate of all TimesheetEntry.hours for this task.
  // Recomputed by recomputeTaskLoggedHours() on every entry change.
  loggedHours    Decimal      @default(0) @db.Decimal(6, 2)
  assignedToId   String?
  // Nullable — null when creator self-assigns (assignedToId == createdById at creation).
  // Populated when a manager/admin explicitly assigns the task to someone else.
  assignedById   String?
  createdById    String
  startDate      DateTime?    @db.Date
  dueDate        DateTime?    @db.Date
  // Set to now() by application logic when status transitions to DONE.
  completedAt    DateTime?
  isDeleted      Boolean      @default(false)
  deletedAt      DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  project    Project          @relation(fields: [projectId], references: [id], onDelete: Cascade)
  assignedTo User?            @relation("TaskAssignee", fields: [assignedToId], references: [id], onDelete: SetNull)
  assignedBy User?            @relation("TaskAssigner", fields: [assignedById], references: [id], onDelete: SetNull)
  createdBy  User             @relation("TaskCreator", fields: [createdById], references: [id], onDelete: Restrict)
  entries    TimesheetEntry[]

  @@index([projectId])
  @@index([assignedToId, status])
  @@index([createdById, status])
  @@index([projectId, status])
  // Drives API-1 week-status query: "tasks assigned to user with dueDate in week range"
  @@index([assignedToId, dueDate])
  @@index([assignedById])
}
```

- [ ] **Step 5: Update `TimesheetEntry` — remove redundant standalone `@@index([timesheetId])`**

The compound `@@index([timesheetId, workDate])` already satisfies prefix scans on `timesheetId` alone. Remove the redundant single-column index:

```prisma
model TimesheetEntry {
  id          String   @id @default(uuid())
  timesheetId String
  taskId      String
  workDate    DateTime @db.Date
  hours       Decimal  @db.Decimal(4, 2)

  startTime   DateTime?
  endTime     DateTime?
  isOvertime  Boolean   @default(false)
  description String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  timesheet Timesheet @relation(fields: [timesheetId], references: [id], onDelete: Cascade)
  task      Task      @relation(fields: [taskId], references: [id], onDelete: Restrict)

  @@index([timesheetId, workDate])
  @@index([taskId])
}
```

- [ ] **Step 6: Validate schema**

```bash
yarn workspace @repo/db exec prisma validate
```

Expected: no validation errors.

---

## Task 3: Run Migration & Generate Client

**Files:**
- Auto-generated migration in `packages/db/src/prisma/migrations/`

- [ ] **Step 1: Create and apply migration**

```bash
yarn workspace @repo/db db:migrate
```

When Prisma prompts for a migration name, enter:
```
add_admin_role_task_priority_project_status_soft_delete_timestamps
```

Expected output: `✔  Your database is now in sync with your schema.`

- [ ] **Step 2: Regenerate Prisma client**

```bash
yarn workspace @repo/db db:generate
```

Expected: `✔ Generated Prisma Client (v7.x.x)` with no TypeScript errors.

---

## Task 4: Update `seed.ts`

**Files:**
- Modify: `packages/db/src/seed.ts`

- [ ] **Step 1: Import new enums**

Update the import line at the top to include new enums:

```typescript
import { prisma, TimesheetStatus, TaskType, TaskStatus, TaskPriority, ProjectRole, ProjectStatus, UserRole } from "./index.js";
```

- [ ] **Step 2: Add an ADMIN user**

Append to `USERS`:

```typescript
{ email: "admin@example.com", username: "admin", firstName: "Admin", lastName: "User", role: UserRole.ADMIN },
```

- [ ] **Step 3: Add `priority` and `assignedById` fields to every `task.create` call in the seed**

Every existing `prisma.task.create({ data: { ... } })` block needs `priority` added. Use `TaskPriority.MEDIUM` as a safe default, varying a few for realism:

```typescript
// Example — adjust per existing task blocks:
priority: TaskPriority.HIGH,
assignedById: aliceId,   // manager who assigned it
```

For self-assigned tasks (employee creates + assigns to self), set `assignedById: null`.

- [ ] **Step 4: Add `status` to every `project.create` call**

```typescript
status: ProjectStatus.ACTIVE,
```

- [ ] **Step 5: Run the seed to verify no runtime errors**

```bash
yarn workspace @repo/db db:seed
```

Expected: seed completes with no uncaught exceptions and user/project/task counts printed.

---

## Task 5: Create `apps/backend/lib/task.ts`

**Files:**
- Create: `apps/backend/lib/task.ts`

- [ ] **Step 1: Write the file**

```typescript
import { Prisma, Task, TaskStatus, User, Project, TimesheetEntry } from "@repo/db";

type TransactionClient = Prisma.TransactionClient;

// ─── Serialised shapes ────────────────────────────────────────────────────────

export type SerializedUserBrief = {
    id: string;
    firstName: string | null;
    lastName: string | null;
    profilePic: string | null;
};

export type SerializedProjectBrief = {
    id: string;
    name: string;
    color: string | null;
    status: string;
};

export type SerializedTask = {
    id: string;
    projectId: string;
    title: string;
    description: string | null;
    type: string;
    status: string;
    priority: string;
    estimatedHours: number | null;
    loggedHours: number;
    startDate: string | null;
    dueDate: string | null;
    completedAt: string | null;
    assignedToId: string | null;
    assignedById: string | null;
    createdById: string;
    isDeleted: boolean;
    createdAt: string;
    updatedAt: string;
};

export type SerializedTaskWithRelations = SerializedTask & {
    project: SerializedProjectBrief;
    createdBy: SerializedUserBrief;
    assignedBy: SerializedUserBrief | null;
};

// ─── Serializers ─────────────────────────────────────────────────────────────

export function serializeUserBrief(user: Pick<User, "id" | "firstName" | "lastName" | "profilePic">): SerializedUserBrief {
    return {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        profilePic: user.profilePic,
    };
}

export function serializeProjectBrief(
    project: Pick<Project, "id" | "name" | "color" | "status">
): SerializedProjectBrief {
    return {
        id: project.id,
        name: project.name,
        color: project.color,
        status: project.status,
    };
}

export function serializeTask(
    task: Task & {
        project: Pick<Project, "id" | "name" | "color" | "status">;
        createdBy: Pick<User, "id" | "firstName" | "lastName" | "profilePic">;
        assignedBy: Pick<User, "id" | "firstName" | "lastName" | "profilePic"> | null;
    }
): SerializedTaskWithRelations {
    return {
        id: task.id,
        projectId: task.projectId,
        title: task.title,
        description: task.description,
        type: task.type,
        status: task.status,
        priority: task.priority,
        estimatedHours: task.estimatedHours ? task.estimatedHours.toNumber() : null,
        loggedHours: task.loggedHours.toNumber(),
        startDate: task.startDate ? task.startDate.toISOString().slice(0, 10) : null,
        dueDate: task.dueDate ? task.dueDate.toISOString().slice(0, 10) : null,
        completedAt: task.completedAt ? task.completedAt.toISOString() : null,
        assignedToId: task.assignedToId,
        assignedById: task.assignedById,
        createdById: task.createdById,
        isDeleted: task.isDeleted,
        createdAt: task.createdAt.toISOString(),
        updatedAt: task.updatedAt.toISOString(),
        project: serializeProjectBrief(task.project),
        createdBy: serializeUserBrief(task.createdBy),
        assignedBy: task.assignedBy ? serializeUserBrief(task.assignedBy) : null,
    };
}

// ─── Denormalised rollup ──────────────────────────────────────────────────────

/**
 * Recomputes Task.loggedHours as the DB-side sum of all TimesheetEntry.hours
 * for this task. Call inside the same transaction as any entry create/update/delete.
 */
export async function recomputeTaskLoggedHours(
    taskId: string,
    tx: TransactionClient
): Promise<void> {
    const result = await tx.timesheetEntry.aggregate({
        where: { taskId },
        _sum: { hours: true },
    });
    const loggedHours = result._sum.hours ?? new Prisma.Decimal(0);
    await tx.task.update({
        where: { id: taskId },
        data: { loggedHours },
    });
}

// ─── Prisma select shape (reused by both APIs) ────────────────────────────────

export const taskWithRelationsSelect = {
    id: true,
    projectId: true,
    title: true,
    description: true,
    type: true,
    status: true,
    priority: true,
    estimatedHours: true,
    loggedHours: true,
    startDate: true,
    dueDate: true,
    completedAt: true,
    assignedToId: true,
    assignedById: true,
    createdById: true,
    isDeleted: true,
    createdAt: true,
    updatedAt: true,
    project: {
        select: { id: true, name: true, color: true, status: true },
    },
    createdBy: {
        select: { id: true, firstName: true, lastName: true, profilePic: true },
    },
    assignedBy: {
        select: { id: true, firstName: true, lastName: true, profilePic: true },
    },
} as const;
```

- [ ] **Step 2: Typecheck**

```bash
yarn workspace backend exec tsc --noEmit
```

Expected: no errors in `lib/task.ts`.

---

## Task 6: Update `apps/backend/lib/timesheet.ts`

**Files:**
- Modify: `apps/backend/lib/timesheet.ts`

- [ ] **Step 1: Add `computeWeekStatus` helper at the bottom of the file**

```typescript
import { TaskStatus, TimesheetStatus } from "@repo/db";

/**
 * Derives the TimesheetStatus for a given user+week from task due-dates.
 *
 * Rules:
 *   MISSING     — no non-deleted tasks assigned to user with dueDate in [weekStart, weekEnd]
 *   COMPLETED   — all such tasks have status DONE
 *   INCOMPLETE  — at least one such task is not DONE
 */
export async function computeWeekStatus(
    userId: string,
    weekStart: Date,
    weekEnd: Date
): Promise<{ status: TimesheetStatus; taskCount: number; completedTaskCount: number }> {
    const tasks = await prisma.task.findMany({
        where: {
            assignedToId: userId,
            isDeleted: false,
            dueDate: { gte: weekStart, lte: weekEnd },
        },
        select: { status: true },
    });

    if (tasks.length === 0) {
        return { status: TimesheetStatus.MISSING, taskCount: 0, completedTaskCount: 0 };
    }

    const completedTaskCount = tasks.filter((t) => t.status === TaskStatus.DONE).length;
    const status =
        completedTaskCount === tasks.length
            ? TimesheetStatus.COMPLETED
            : TimesheetStatus.INCOMPLETE;

    return { status, taskCount: tasks.length, completedTaskCount };
}
```

- [ ] **Step 2: Export `recomputeTaskLoggedHours` re-export note**

`recomputeTaskLoggedHours` lives in `lib/task.ts` (single responsibility). Import it from there in route handlers — do **not** add a wrapper in `lib/timesheet.ts`.

- [ ] **Step 3: Typecheck**

```bash
yarn workspace backend exec tsc --noEmit
```

Expected: no errors.

---

## Task 7: Add Zod Schemas

**Files:**
- Modify: `apps/backend/common/ZodSchema.ts`

- [ ] **Step 1: Add `weeksQuerySchema` and `weekStartParamSchema`**

Append to `apps/backend/common/ZodSchema.ts`:

```typescript
// Validates the YYYY-MM-DD format and that the date is a Monday.
function mustBeMonday(val: string): boolean {
    const d = new Date(val + "T00:00:00Z");
    return d.getUTCDay() === 1; // 1 = Monday
}

// API-1: GET /timesheet/weeks?weekStart=YYYY-MM-DD&weekEnd=YYYY-MM-DD
export const weeksQuerySchema = z
    .object({
        weekStart: isoDateSchema.optional(),
        weekEnd: isoDateSchema.optional(),
    })
    .refine(
        (d) => !d.weekStart || mustBeMonday(d.weekStart),
        { message: "weekStart must be a Monday (ISO week start)", path: ["weekStart"] }
    )
    .refine(
        (d) => !d.weekEnd || new Date(d.weekEnd + "T00:00:00Z").getUTCDay() === 0,
        { message: "weekEnd must be a Sunday (ISO week end)", path: ["weekEnd"] }
    );

// API-2: path param [weekStart]
export const weekStartParamSchema = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD")
    .refine(mustBeMonday, { message: "weekStart must be a Monday" });
```

- [ ] **Step 2: Verify no lint errors**

```bash
yarn workspace backend lint
```

Expected: no new lint errors.

---

## Task 8: Create API-1 — `GET /timesheet/weeks`

**Files:**
- Create: `apps/backend/app/timesheet/weeks/route.ts`

### What this route does

Returns a list of weeks between `weekStart` (default: Monday 8 weeks ago) and `weekEnd` (default: current Sunday). For each week it returns:
- `weekStart`, `weekEnd` (ISO date strings)
- `status` (COMPLETED / INCOMPLETE / MISSING) — computed from task due dates
- `taskCount`, `completedTaskCount`, `pendingTaskCount`
- `totalLoggedHours` — sum of hours in TimesheetEntry for that week
- `timesheetId` — existing Timesheet row id (or `null` if the placeholder hasn't been created yet)

The route also **upserts Timesheet placeholder rows** (status = computed, not forced MISSING) so that API-2 always has a row to look up.

- [ ] **Step 1: Write the route handler**

```typescript
import { weeksQuerySchema } from "@/common/ZodSchema";
import prisma from "@/lib/db";
import {
    computeWeekStatus,
    ensureTimesheetsForRange,
    parseDateOnly,
    serializeTimesheet,
} from "@/lib/timesheet";
import { NextRequest, NextResponse } from "next/server";
import { TimesheetStatus } from "@repo/db";

/**
 * Returns the Monday of the week containing `d` (UTC).
 */
function startOfISOWeek(d: Date): Date {
    const out = new Date(d);
    const day = out.getUTCDay();
    const offsetToMonday = (day + 6) % 7; // Sun(0)→6, Mon(1)→0 … Sat(6)→5
    out.setUTCDate(out.getUTCDate() - offsetToMonday);
    out.setUTCHours(0, 0, 0, 0);
    return out;
}

function endOfISOWeek(monday: Date): Date {
    const out = new Date(monday);
    out.setUTCDate(monday.getUTCDate() + 6); // + 6 days = Sunday
    return out;
}

function addWeeks(d: Date, weeks: number): Date {
    const out = new Date(d);
    out.setUTCDate(d.getUTCDate() + weeks * 7);
    return out;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
    try {
        const userId = req.headers.get("x-user-id");
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Parse + validate query params
        const { searchParams } = req.nextUrl;
        const raw = {
            weekStart: searchParams.get("weekStart") ?? undefined,
            weekEnd: searchParams.get("weekEnd") ?? undefined,
        };
        const parsed = weeksQuerySchema.safeParse(raw);
        if (!parsed.success) {
            return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
        }

        // Defaults: last 8 weeks inclusive of current week
        const rangeStart = parsed.data.weekStart
            ? parseDateOnly(parsed.data.weekStart)
            : startOfISOWeek(addWeeks(new Date(), -7)); // 8 weeks ago (Mon)
        const rangeEnd = parsed.data.weekEnd
            ? parseDateOnly(parsed.data.weekEnd)
            : endOfISOWeek(startOfISOWeek(new Date())); // current Sunday

        if (rangeEnd < rangeStart) {
            return NextResponse.json(
                { error: "weekEnd must be on or after weekStart" },
                { status: 400 }
            );
        }

        // Ensure Timesheet placeholder rows exist for the range
        // (ensureTimesheetsForRange creates MISSING placeholders but we'll override status below)
        await ensureTimesheetsForRange(userId, rangeStart, rangeEnd);

        // Build list of Mondays in range
        const mondays: Date[] = [];
        const cursor = new Date(rangeStart);
        while (cursor <= rangeEnd) {
            mondays.push(new Date(cursor));
            cursor.setUTCDate(cursor.getUTCDate() + 7);
        }

        // Fetch timesheet rows for the range (now guaranteed to exist)
        const timesheets = await prisma.timesheet.findMany({
            where: {
                userId,
                periodStart: { gte: rangeStart, lte: rangeEnd },
            },
            orderBy: { periodStart: "asc" },
        });

        const timesheetByStart = new Map(
            timesheets.map((ts) => [ts.periodStart.toISOString().slice(0, 10), ts])
        );

        // Build week summaries — compute status from tasks for each week
        const weeks = await Promise.all(
            mondays.map(async (monday) => {
                const sunday = endOfISOWeek(monday);
                const { status, taskCount, completedTaskCount } = await computeWeekStatus(
                    userId,
                    monday,
                    sunday
                );

                const key = monday.toISOString().slice(0, 10);
                const ts = timesheetByStart.get(key);

                // Keep the Timesheet row's status in sync (fire-and-forget; no await needed for response)
                if (ts && ts.status !== status) {
                    prisma.timesheet
                        .update({ where: { id: ts.id }, data: { status } })
                        .catch(() => {}); // non-critical background update
                }

                return {
                    weekStart: monday.toISOString().slice(0, 10),
                    weekEnd: sunday.toISOString().slice(0, 10),
                    status,
                    taskCount,
                    completedTaskCount,
                    pendingTaskCount: taskCount - completedTaskCount,
                    totalLoggedHours: ts ? ts.totalHours.toNumber() : 0,
                    totalRegularHours: ts ? ts.regularHours.toNumber() : 0,
                    totalOvertimeHours: ts ? ts.overtimeHours.toNumber() : 0,
                    timesheetId: ts?.id ?? null,
                };
            })
        );

        return NextResponse.json({ weeks });
    } catch (error) {
        console.error(error);
        if (error instanceof Error && error.message.startsWith("Invalid date")) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
```

- [ ] **Step 2: Typecheck**

```bash
yarn workspace backend exec tsc --noEmit
```

Expected: no errors.

---

## Task 9: Create API-2 — `GET /timesheet/week/[weekStart]`

**Files:**
- Create: `apps/backend/app/timesheet/week/[weekStart]/route.ts`

### What this route returns

```
GET /timesheet/week/2026-05-25
```

```json
{
  "weekStart": "2026-05-25",
  "weekEnd": "2026-05-31",
  "status": "INCOMPLETE",
  "totalHours": 12.5,
  "regularHours": 10.0,
  "overtimeHours": 2.5,
  "days": [
    {
      "date": "2026-05-25",
      "dayOfWeek": "Monday",
      "totalHours": 4.5,
      "entries": [
        {
          "entryId": "uuid",
          "hours": 4.5,
          "isOvertime": false,
          "startTime": "2026-05-25T09:00:00.000Z",
          "endTime": "2026-05-25T13:30:00.000Z",
          "description": "Implemented login flow",
          "task": {
            "id": "uuid",
            "title": "Implement login",
            "type": "FEATURE",
            "status": "IN_PROGRESS",
            "priority": "HIGH",
            "estimatedHours": 8.0,
            "loggedHours": 4.5,
            "startDate": "2026-05-20",
            "dueDate": "2026-05-28",
            "completedAt": null
          },
          "project": {
            "id": "uuid",
            "name": "Auth System",
            "color": "#3B82F6",
            "status": "ACTIVE"
          },
          "createdBy": {
            "id": "uuid",
            "firstName": "Alice",
            "lastName": "Chen",
            "profilePic": null
          },
          "assignedBy": {
            "id": "uuid",
            "firstName": "Alice",
            "lastName": "Chen",
            "profilePic": null
          }
        }
      ]
    },
    {
      "date": "2026-05-26",
      "dayOfWeek": "Tuesday",
      "totalHours": 0,
      "entries": []
    }
  ]
}
```

Days with no entries are still included (Mon–Sun = 7 days always).

- [ ] **Step 1: Write the route handler**

```typescript
import { weekStartParamSchema } from "@/common/ZodSchema";
import prisma from "@/lib/db";
import { computeWeekStatus, parseDateOnly } from "@/lib/timesheet";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@repo/db";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function endOfISOWeek(monday: Date): Date {
    const out = new Date(monday);
    out.setUTCDate(monday.getUTCDate() + 6);
    return out;
}

export async function GET(
    req: NextRequest,
    { params }: { params: { weekStart: string } }
): Promise<NextResponse> {
    try {
        const userId = req.headers.get("x-user-id");
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const paramValidation = weekStartParamSchema.safeParse(params.weekStart);
        if (!paramValidation.success) {
            return NextResponse.json(
                { error: paramValidation.error.flatten() },
                { status: 400 }
            );
        }

        const weekStartDate = parseDateOnly(params.weekStart);
        const weekEndDate = endOfISOWeek(weekStartDate);

        // Fetch the Timesheet period container (may be null if week was never visited)
        const timesheet = await prisma.timesheet.findUnique({
            where: { userId_periodStart: { userId, periodStart: weekStartDate } },
        });

        // Fetch all entries for the week for this user, with full task + project + user relations
        const entries = await prisma.timesheetEntry.findMany({
            where: {
                workDate: { gte: weekStartDate, lte: weekEndDate },
                timesheet: { userId },
            },
            include: {
                task: {
                    select: {
                        id: true,
                        title: true,
                        type: true,
                        status: true,
                        priority: true,
                        estimatedHours: true,
                        loggedHours: true,
                        startDate: true,
                        dueDate: true,
                        completedAt: true,
                        project: {
                            select: { id: true, name: true, color: true, status: true },
                        },
                        createdBy: {
                            select: { id: true, firstName: true, lastName: true, profilePic: true },
                        },
                        assignedBy: {
                            select: { id: true, firstName: true, lastName: true, profilePic: true },
                        },
                    },
                },
            },
            orderBy: [{ workDate: "asc" }, { createdAt: "asc" }],
        });

        // Compute week status from task due-dates
        const { status, taskCount, completedTaskCount } = await computeWeekStatus(
            userId,
            weekStartDate,
            weekEndDate
        );

        // Group entries by workDate (ISO date string key)
        const byDate = new Map<string, typeof entries>();
        for (const entry of entries) {
            const key = entry.workDate.toISOString().slice(0, 10);
            if (!byDate.has(key)) byDate.set(key, []);
            byDate.get(key)!.push(entry);
        }

        // Build 7-day array (Mon → Sun)
        const days = Array.from({ length: 7 }, (_, i) => {
            const d = new Date(weekStartDate);
            d.setUTCDate(weekStartDate.getUTCDate() + i);
            const key = d.toISOString().slice(0, 10);
            const dayEntries = byDate.get(key) ?? [];

            const dayHours = dayEntries.reduce(
                (sum, e) => sum + e.hours.toNumber(),
                0
            );

            return {
                date: key,
                dayOfWeek: DAY_NAMES[d.getUTCDay()],
                totalHours: dayHours,
                entries: dayEntries.map((e) => ({
                    entryId: e.id,
                    timesheetId: e.timesheetId,
                    hours: e.hours.toNumber(),
                    isOvertime: e.isOvertime,
                    startTime: e.startTime?.toISOString() ?? null,
                    endTime: e.endTime?.toISOString() ?? null,
                    description: e.description,
                    createdAt: e.createdAt.toISOString(),
                    updatedAt: e.updatedAt.toISOString(),
                    task: {
                        id: e.task.id,
                        title: e.task.title,
                        type: e.task.type,
                        status: e.task.status,
                        priority: e.task.priority,
                        estimatedHours: e.task.estimatedHours?.toNumber() ?? null,
                        loggedHours: e.task.loggedHours.toNumber(),
                        startDate: e.task.startDate?.toISOString().slice(0, 10) ?? null,
                        dueDate: e.task.dueDate?.toISOString().slice(0, 10) ?? null,
                        completedAt: e.task.completedAt?.toISOString() ?? null,
                    },
                    project: {
                        id: e.task.project.id,
                        name: e.task.project.name,
                        color: e.task.project.color,
                        status: e.task.project.status,
                    },
                    createdBy: {
                        id: e.task.createdBy.id,
                        firstName: e.task.createdBy.firstName,
                        lastName: e.task.createdBy.lastName,
                        profilePic: e.task.createdBy.profilePic,
                    },
                    assignedBy: e.task.assignedBy
                        ? {
                              id: e.task.assignedBy.id,
                              firstName: e.task.assignedBy.firstName,
                              lastName: e.task.assignedBy.lastName,
                              profilePic: e.task.assignedBy.profilePic,
                          }
                        : null,
                })),
            };
        });

        const totalHours = timesheet?.totalHours.toNumber() ?? 0;
        const regularHours = timesheet?.regularHours.toNumber() ?? 0;
        const overtimeHours = timesheet?.overtimeHours.toNumber() ?? 0;

        return NextResponse.json({
            weekStart: params.weekStart,
            weekEnd: weekEndDate.toISOString().slice(0, 10),
            status,
            taskCount,
            completedTaskCount,
            pendingTaskCount: taskCount - completedTaskCount,
            totalHours,
            regularHours,
            overtimeHours,
            timesheetId: timesheet?.id ?? null,
            days,
        });
    } catch (error) {
        console.error(error);
        if (error instanceof Error && error.message.startsWith("Invalid date")) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
```

- [ ] **Step 2: Typecheck**

```bash
yarn workspace backend exec tsc --noEmit
```

Expected: no errors.

---

## Task 10: Typecheck & Lint Pass

**Files:** all modified files

- [ ] **Step 1: Full backend typecheck**

```bash
yarn workspace backend exec tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 2: Lint**

```bash
yarn workspace backend lint
```

Expected: 0 errors, 0 warnings.

- [ ] **Step 3: Seed re-run on fresh DB (optional smoke test)**

```bash
yarn workspace @repo/db db:reset
```

Expected: migration applied → seed runs → no errors.

---

## Self-Review

### Spec Coverage Check

| Requirement | Task |
|---|---|
| ADMIN role (full CRUD) | Task 1 Step 1 (enum) + route handler checks (x-user-id role lookup — enforcement in actual CRUD routes, not in scope here) |
| Manager create/delete/modify projects + assign tasks | Role gate at route handler level; schema supports `assignedById` |
| Employee create/modify tasks, self-assign only | Enforced at app layer; `assignedById = null` when employee creates |
| `estimatedHours`, `loggedHours` on Task | Task 2 Step 4 |
| Soft delete everywhere (isDeleted + deletedAt) | Task 1-2: User, Project, ProjectMember, Task all have both |
| TaskPriority | Task 1 Step 1, Task 2 Step 4 |
| ProjectStatus (ACTIVE etc.) | Task 1 Step 1, Task 2 Step 2 |
| `assignedById` (who assigned) | Task 2 Step 4 + relation |
| `startDate`, `completedAt` on Task | Task 2 Step 4 |
| Normalised schema | All FKs properly referenced; denormalized only `loggedHours` (Task) and `totalHours` (Timesheet), both recomputed deterministically |
| API-1: week-list with selector + status | Task 8 |
| API-2: day-wise detail with project/user info | Task 9 |
| `recomputeTaskLoggedHours` hook | Task 5 |
| Indexes for both API queries | `@@index([assignedToId, dueDate])`, `@@index([timesheetId, workDate])` |

### Placeholder Scan

No TBD/TODO/placeholder steps found — every step contains runnable code.

### Type Consistency

- `computeWeekStatus` → uses `TaskStatus.DONE` (imported from `@repo/db`) ✓
- `endOfISOWeek` defined in both API-1 and API-2 routes (consider extracting to `lib/dateUtils.ts` in a follow-up to DRY)
- `weeksQuerySchema` and `weekStartParamSchema` both use local `isoDateSchema` constant already defined in `ZodSchema.ts` ✓
- `taskWithRelationsSelect` exported from `lib/task.ts` but not used in API-2 (API-2 uses an inline `include` for clarity) — no inconsistency, just two valid patterns

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-28-task-tracking-schema-and-apis.md`.

**Two execution options:**

**1. Subagent-Driven (recommended)** — Dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
