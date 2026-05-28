# Project & Task Schema Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the Prisma schema with Project, ProjectMember, and Task models; add UserRole to User; link TimesheetEntry to Task; run migration and update the entry serializer.

**Architecture:** Pure database-layer change. New enums (UserRole, TaskType, TaskStatus, ProjectRole) and three new models (Project, ProjectMember, Task) are added to `packages/db/src/prisma/schema.prisma`. TimesheetEntry gains a required `taskId` FK. The only application code change is updating `serializeTimesheetEntry` in `apps/backend/lib/timesheet.ts` to include the new field.

**Tech Stack:** Prisma 7, PostgreSQL, `pg_trgm` extension (already enabled), TypeScript

**Spec:** `docs/superpowers/specs/2026-05-28-project-task-schema-design.md`

---

## Task 1: Rewrite the Prisma schema

**Files:**
- Modify: `packages/db/src/prisma/schema.prisma`

- [ ] **Step 1: Replace the full contents of `packages/db/src/prisma/schema.prisma` with the following**

```prisma
generator client {
  provider        = "prisma-client-js"
  output          = "../generated/client"
  binaryTargets   = ["native"]
  previewFeatures = ["postgresqlExtensions"]
}

datasource db {
  provider   = "postgresql"
  extensions = [pg_trgm]
}

// ─── Enums ───────────────────────────────────────────────────────────────────

enum TimesheetStatus {
  COMPLETED
  INCOMPLETE
  MISSING
}

enum UserRole {
  EMPLOYEE
  PROJECT_MANAGER
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

enum ProjectRole {
  OWNER
  MEMBER
}

// ─── Models ──────────────────────────────────────────────────────────────────

model User {
  id                     String    @id @default(uuid())
  email                  String    @unique
  password               String?
  username               String    @unique
  firstName              String?
  lastName               String?
  profilePic             String?
  role                   UserRole  @default(EMPLOYEE)
  emailVerified          DateTime?
  emailVerificationToken String?   @unique
  emailVerificationExp   DateTime?
  refreshToken           String?
  refreshTokenExp        DateTime?
  resetToken             String?   @unique
  resetTokenExp          DateTime?
  isDeleted              Boolean   @default(false)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  activityLogs       ActivityLog[]   @relation("UserActivityLogs")
  timesheets         Timesheet[]
  createdProjects    Project[]       @relation("ProjectCreator")
  projectMemberships ProjectMember[]
  assignedTasks      Task[]          @relation("TaskAssignee")
  createdTasks       Task[]          @relation("TaskCreator")

  @@index([isDeleted])
}

model Project {
  id          String  @id @default(uuid())
  name        String
  description String?
  color       String? // hex, e.g. "#3B82F6"
  createdById String
  isDeleted   Boolean @default(false)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  createdBy User            @relation("ProjectCreator", fields: [createdById], references: [id], onDelete: Cascade)
  members   ProjectMember[]
  tasks     Task[]

  @@index([createdById])
  @@index([isDeleted])
  @@index([name(ops: raw("gin_trgm_ops"))], type: Gin)
}

model ProjectMember {
  id        String      @id @default(uuid())
  projectId String
  userId    String
  role      ProjectRole @default(MEMBER)
  joinedAt  DateTime    @default(now())

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([projectId, userId])
  @@index([userId])
}

model Task {
  id             String     @id @default(uuid())
  projectId      String
  title          String
  description    String?
  type           TaskType
  status         TaskStatus @default(TODO)
  estimatedHours Decimal?   @db.Decimal(4, 2)
  assignedToId   String? // defaults to createdById in app logic
  createdById    String
  dueDate        DateTime?  @db.Date
  isDeleted      Boolean    @default(false)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  project    Project          @relation(fields: [projectId], references: [id], onDelete: Cascade)
  assignedTo User?            @relation("TaskAssignee", fields: [assignedToId], references: [id])
  createdBy  User             @relation("TaskCreator", fields: [createdById], references: [id])
  entries    TimesheetEntry[]

  @@index([projectId])
  @@index([assignedToId])
  @@index([projectId, status])
  @@index([isDeleted])
}

model Timesheet {
  id             String          @id @default(uuid())
  userId         String
  sequenceNumber Int
  status         TimesheetStatus @default(MISSING)

  title       String
  notes       String?
  periodStart DateTime @db.Date
  periodEnd   DateTime @db.Date

  totalHours    Decimal @default(0) @db.Decimal(6, 2)
  regularHours  Decimal @default(0) @db.Decimal(6, 2)
  overtimeHours Decimal @default(0) @db.Decimal(6, 2)

  submittedAt DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  user    User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  entries TimesheetEntry[]

  @@unique([userId, sequenceNumber])
  @@index([userId])
  @@index([userId, createdAt])
}

model TimesheetEntry {
  id          String    @id @default(uuid())
  timesheetId String
  taskId      String
  workDate    DateTime  @db.Date
  hours       Decimal   @db.Decimal(4, 2)
  startTime   DateTime?
  endTime     DateTime?
  isOvertime  Boolean   @default(false)
  description String? // day-specific note; may differ from Task.description

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  timesheet Timesheet @relation(fields: [timesheetId], references: [id], onDelete: Cascade)
  task      Task      @relation(fields: [taskId], references: [id], onDelete: Restrict)

  @@index([timesheetId])
  @@index([timesheetId, workDate])
  @@index([taskId])
}

model ActivityLog {
  id          BigInt  @id @default(autoincrement())
  description String?
  type        String
  userId      String

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user User @relation("UserActivityLogs", fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}
```

> **Note on the relation rename:** The existing `User` model used `ActivityLog ActivityLog[]`. We renamed the relation field to `activityLogs ActivityLog[]` (camelCase, lowercase first letter) for consistency. The named relation `"UserActivityLogs"` in `ActivityLog` is unchanged so no data is affected — only the Prisma client accessor name changes.

- [ ] **Step 2: Verify the schema is valid (no migration yet)**

```bash
yarn workspace @repo/db exec prisma validate
```

Expected: `The schema at ... is valid`

---

## Task 2: Run the migration

**Files:**
- Auto-generated: `packages/db/src/prisma/migrations/<timestamp>_project_task_schema/migration.sql`

- [ ] **Step 1: Generate and apply the migration**

```bash
yarn workspace @repo/db db:migrate
```

When prompted for a migration name, enter: `project_task_schema`

Expected output ends with: `Your database is now in sync with your schema.`

- [ ] **Step 2: Generate the updated Prisma client**

```bash
yarn workspace @repo/db db:generate
```

Expected output ends with: `✔ Generated Prisma Client`

---

## Task 3: Update the TimesheetEntry serializer

**Files:**
- Modify: `apps/backend/lib/timesheet.ts`

`TimesheetEntry` now has a required `taskId` field. The `serializeTimesheetEntry` function must include it, otherwise TypeScript will not error but the API response will silently omit the field.

- [ ] **Step 1: Add `taskId` to `serializeTimesheetEntry`**

Find this function in `apps/backend/lib/timesheet.ts`:

```typescript
export function serializeTimesheetEntry(entry: TimesheetEntry) {
    return {
        id: entry.id,
        timesheetId: entry.timesheetId,
        workDate: entry.workDate.toISOString().slice(0, 10),
        hours: decimalToNumber(entry.hours),
        startTime: entry.startTime?.toISOString() ?? null,
        endTime: entry.endTime?.toISOString() ?? null,
        isOvertime: entry.isOvertime,
        description: entry.description,
        createdAt: entry.createdAt.toISOString(),
        updatedAt: entry.updatedAt.toISOString()
    };
}
```

Replace with:

```typescript
export function serializeTimesheetEntry(entry: TimesheetEntry) {
    return {
        id: entry.id,
        timesheetId: entry.timesheetId,
        taskId: entry.taskId,
        workDate: entry.workDate.toISOString().slice(0, 10),
        hours: decimalToNumber(entry.hours),
        startTime: entry.startTime?.toISOString() ?? null,
        endTime: entry.endTime?.toISOString() ?? null,
        isOvertime: entry.isOvertime,
        description: entry.description,
        createdAt: entry.createdAt.toISOString(),
        updatedAt: entry.updatedAt.toISOString()
    };
}
```

---

## Task 4: Typecheck and lint

- [ ] **Step 1: Typecheck the db package**

```bash
yarn workspace @repo/db exec tsc --noEmit
```

Expected: no output (zero errors)

- [ ] **Step 2: Typecheck the backend**

```bash
yarn workspace backend exec tsc --noEmit
```

Expected: no output (zero errors)

If you see errors about `ActivityLog` relation accessor rename (`ActivityLog` → `activityLogs`), check any file in `apps/backend` that reads `user.ActivityLog` and update it to `user.activityLogs`.

- [ ] **Step 3: Lint the backend**

```bash
yarn workspace backend lint
```

Expected: no errors

---

## Task 5: Commit

- [ ] **Step 1: Stage and commit all changes**

```bash
git add packages/db/src/prisma/schema.prisma \
        packages/db/src/prisma/migrations/ \
        apps/backend/lib/timesheet.ts
git commit -m "feat(db): add Project, ProjectMember, Task models and UserRole

- Add UserRole enum (EMPLOYEE, PROJECT_MANAGER) to User
- Add Project with trigram search index on name
- Add ProjectMember junction table with ProjectRole
- Add Task with TaskType, TaskStatus, estimatedHours, soft-delete
- Add taskId (required FK) to TimesheetEntry with onDelete: Restrict
- Update serializeTimesheetEntry to include taskId"
```

---

## Spec Coverage Check

| Spec requirement | Task |
|---|---|
| `UserRole` enum + `User.role` field | Task 1 |
| `Project` model with soft-delete and color | Task 1 |
| `ProjectMember` junction with `ProjectRole` | Task 1 |
| `Task` with type, status, estimatedHours, assignedTo, createdBy, dueDate | Task 1 |
| `TimesheetEntry.taskId` required FK, `onDelete: Restrict` | Task 1 |
| Trigram index on `Project.name` for search | Task 1 |
| Migration applied | Task 2 |
| Prisma client regenerated | Task 2 |
| Serializer updated | Task 3 |
| TypeScript clean | Task 4 |
