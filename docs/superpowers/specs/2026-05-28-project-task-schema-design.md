# Project & Task Schema Design

**Date:** 2026-05-28  
**Scope:** `packages/db/src/prisma/schema.prisma`  
**Status:** Approved, pending implementation

---

## Context

The app is a project tracker where users create tasks, assign them to team members, and log time against them. Logged hours are aggregated into monthly timesheets (up to 4 weeks per month). The existing `Timesheet` / `TimesheetEntry` models handle period tracking and hour rollups; this design extends the schema with `Project`, `ProjectMember`, and `Task`, and links `TimesheetEntry` to `Task`.

---

## Approach

**Task-first time logging (Approach B):** Every `TimesheetEntry` must reference a `Task`. Tasks live in a backlog. Time is logged against a task on a specific date, which creates the timesheet entry row. The `Timesheet` period container is preserved for status tracking and monthly grouping.

---

## New Enums

```prisma
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
```

---

## New Models

### Project

```prisma
model Project {
  id          String   @id @default(uuid())
  name        String
  description String?
  color       String?          // hex colour for UI, e.g. "#3B82F6"
  createdById String
  isDeleted   Boolean  @default(false)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  createdBy User            @relation("ProjectCreator", fields: [createdById], references: [id], onDelete: Cascade)
  members   ProjectMember[]
  tasks     Task[]

  @@index([createdById])
  @@index([isDeleted])
}
```

### ProjectMember

```prisma
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
```

### Task

```prisma
model Task {
  id             String      @id @default(uuid())
  projectId      String
  title          String
  description    String?
  type           TaskType
  status         TaskStatus  @default(TODO)
  estimatedHours Decimal?    @db.Decimal(4, 2)   // planned effort
  assignedToId   String?                          // defaults to createdById in app logic
  createdById    String
  dueDate        DateTime?   @db.Date
  isDeleted      Boolean     @default(false)

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
```

---

## Modified Model: TimesheetEntry

Add a required `taskId` field linking every logged entry to a task.

```prisma
model TimesheetEntry {
  id          String    @id @default(uuid())
  timesheetId String
  taskId      String                  // NEW — required link to Task
  workDate    DateTime  @db.Date
  hours       Decimal   @db.Decimal(4, 2)
  startTime   DateTime?
  endTime     DateTime?
  isOvertime  Boolean   @default(false)
  description String?                 // day-specific note, may differ from task description

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  timesheet Timesheet @relation(fields: [timesheetId], references: [id], onDelete: Cascade)
  task      Task      @relation(fields: [taskId], references: [id], onDelete: Restrict)

  @@index([timesheetId])
  @@index([timesheetId, workDate])
  @@index([taskId])                   // NEW
}
```

`onDelete: Restrict` on the task relation prevents deleting a task that has logged hours — the task must be soft-deleted (`isDeleted = true`) instead.

---

## Modified Model: User

Add a `role` field to the existing `User` model:

```prisma
// inside model User — new column
role UserRole @default(EMPLOYEE)
```

And new reverse relations (no column changes):

```prisma
// inside model User — reverse relations only
createdProjects    Project[]       @relation("ProjectCreator")
projectMemberships ProjectMember[]
assignedTasks      Task[]          @relation("TaskAssignee")
createdTasks       Task[]          @relation("TaskCreator")
```

---

## Relationship Diagram

```
User ──< ProjectMember >── Project ──< Task
 │  (createdBy / assignedTo)            │
 └──────────────────────────────────────┘
                                        │
User ──< Timesheet ──< TimesheetEntry >─┘
```

---

## Project Search Index

The schema already enables the `pg_trgm` PostgreSQL extension. Add a trigram index on `Project.name` to support fast fuzzy search when a user browses/searches projects during task creation:

```prisma
// inside model Project
@@index([name], type: Gin)   // trigram-powered search via pg_trgm
```

All users (EMPLOYEE and PROJECT_MANAGER) can search and browse projects when creating a task. Visibility of which projects appear is unrestricted at the DB level — project listing is open to all authenticated users.

---

## Unchanged Models

| Model | Change |
|---|---|
| `Timesheet` | None — period container, status, and rollup hours unchanged |
| `ActivityLog` | None |
| `TimesheetStatus` enum | None |

---

## Access Control Rules (application layer)

These are enforced in API route handlers, not in the schema.

| Role | Timesheet view | Tasks — view | Tasks — create / modify |
|---|---|---|---|
| `EMPLOYEE` | Own current week only (default) | Own tasks only (`assignedToId = self`) | Own tasks only |
| `PROJECT_MANAGER` | Any user, any week | All users' tasks | Any task in any project |

**Default view:** When a user loads the timesheet screen, the API defaults the query window to the current ISO week (`periodStart` = Monday, `periodEnd` = Sunday of the current week).

**EMPLOYEE task creation:** The user selects a project by searching/browsing all non-deleted projects. `assignedToId` defaults to themselves. They cannot assign a task to someone else.

**PROJECT_MANAGER task creation:** Can assign a task to any user who is a member of the selected project.

---

## Constraints & Rules

- **Soft delete on Project and Task:** Set `isDeleted = true` rather than hard-deleting; queries filter `isDeleted: false` by default.
- **Task hard-delete blocked:** `TimesheetEntry.taskId` uses `onDelete: Restrict` — a task with logged hours cannot be hard-deleted.
- **Default assignee:** Application layer defaults `assignedToId = createdById` when creating a task; the schema allows `null` to remain flexible.
- **Project membership required for assignment (PROJECT_MANAGER only):** App layer enforces that `assignedToId` is a member of the task's project.
- **Timesheet grouping:** Default view = current week. Monthly view = query `TimesheetEntry` records within a 4-week `periodStart`/`periodEnd` range. No schema change needed.
- **Role stored on User:** `User.role` is set at registration or by an admin. Default is `EMPLOYEE`.

---

## Migration Notes

- `User.role` is a new non-nullable column with default `EMPLOYEE` — safe to add with a default.
- `TimesheetEntry.taskId` is a new non-nullable column. Since this is a greenfield schema (no production data), a plain `ALTER TABLE` migration is safe.
- Run: `yarn workspace @repo/db db:migrate` → `yarn workspace @repo/db db:generate`
