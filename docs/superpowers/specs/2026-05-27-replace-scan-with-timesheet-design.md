# Replace `Scan` with `Timesheet` — Design

**Date:** 2026-05-27
**Status:** Approved (awaiting written-spec review)
**Owner:** `packages/db`

## Goal

Replace the `Scan` domain in `packages/db` with a `Timesheet` domain that lets a user create N timesheets, each carrying a stable per-user sequence number, a `status`, and first-class **working-hours management** via per-day entries.

## Non-goals

- No backend `/timesheet` route handlers are added in this change. This spec only covers the data model, migration, and seed.
- No web UI changes.
- No reporting/analytics features.
- No project / client / hourly-rate modeling. (YAGNI.)
- No data preservation from the existing `Scan` table — the change is destructive for `Scan` rows (no consumers exist).

## Constraints (from `.cursor/rules/architectural-decisions.mdc`)

- DB lives in `packages/db`; backend imports via `@repo/db`. Web never touches the DB.
- Source of truth: PostgreSQL via Prisma 7.
- Use pnpm + existing Turborepo tasks.

## Decisions

### Sequence number

- **Approach A** (chosen): `sequenceNumber Int` on `Timesheet`, with `@@unique([userId, sequenceNumber])`. Assignment (`MAX + 1`) happens in a Prisma transaction by the future backend route. The unique constraint is the safety net; on `P2002` the caller retries.
- Sequence numbers start at **1** and are **stable** — never reused, even after a timesheet is deleted.
- Rejected: a counter on `User` (pollutes user model, two writes per create) and `ROW_NUMBER()` at read time (shifts on delete, violates stability).

### Working-hours granularity

- **Per-day entries** in a related `TimesheetEntry` model, **plus roll-up totals** cached on `Timesheet` for fast list queries.
- Multiple entries per day are allowed (no `@@unique([timesheetId, workDate])`) — supports split shifts.
- Roll-ups (`totalHours`, `regularHours`, `overtimeHours`) are recomputed by the backend inside the same transaction as any entry create/update/delete. The DB does not auto-maintain them.

### Numeric type

- `Decimal` over `Float` to avoid floating-point drift on hour arithmetic.
- `Decimal(4, 2)` per-day entry (max 99.99 hours).
- `Decimal(6, 2)` per-period roll-up (max 9999.99 hours).

### Date vs DateTime

- `periodStart`, `periodEnd`, `workDate` use `@db.Date` — pure calendar dates, no time-zone surprises.
- `startTime`, `endTime`, `submittedAt`, `createdAt`, `updatedAt` stay as `DateTime` — they are real timestamps.

### Cascade

- `User` delete → cascades to `Timesheet` → cascades to `TimesheetEntry`. Matches the existing `Scan` cascade pattern.

## Schema (final)

`packages/db/src/prisma/schema.prisma`:

```prisma
enum TimesheetStatus {
  COMPLETED
  INCOMPLETE
  MISSING
}

model User {
  // existing fields unchanged
  timesheets Timesheet[]   // replaces `scans Scan[]`
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
  workDate    DateTime  @db.Date
  hours       Decimal   @db.Decimal(4, 2)
  startTime   DateTime?
  endTime     DateTime?
  isOvertime  Boolean   @default(false)
  description String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  timesheet Timesheet @relation(fields: [timesheetId], references: [id], onDelete: Cascade)

  @@index([timesheetId])
  @@index([timesheetId, workDate])
}
```

**Drops:** `Scan` model and `ScanType` enum.

## Migration

Generated via `pnpm db:migrate dev --name replace_scan_with_timesheet` in `packages/db`. The migration must:

1. Drop FK `Scan_userId_fkey`, drop indexes on `Scan`, drop table `Scan`.
2. Drop type `ScanType`.
3. Create type `TimesheetStatus`.
4. Create table `Timesheet` with PK, FK to `User(id) ON DELETE CASCADE`, unique constraint on `(userId, sequenceNumber)`, and indexes on `(userId)` and `(userId, createdAt)`.
5. Create table `TimesheetEntry` with PK, FK to `Timesheet(id) ON DELETE CASCADE`, and indexes on `(timesheetId)` and `(timesheetId, workDate)`.

This is **destructive** for any `Scan` rows. No consumers exist today, so loss is acceptable.

## Seed (`packages/db/src/seed.ts`)

- Remove `ScanType` import.
- Remove both `prisma.scan.create(...)` blocks.
- Change the activity-log seed entry `type: "SCAN"` → `type: "TIMESHEET"`.
- For Alice and Bob, create two timesheets each:
  - **Timesheet #1** (`sequenceNumber: 1`, `status: COMPLETED`)
    - `title: "Week of <periodStart>"` (the seed substitutes the actual ISO date)
    - `periodStart`/`periodEnd`: Monday–Friday of the week starting two weeks ago.
    - 5 entries Mon–Fri, `hours: 8`, `isOvertime: false`.
    - Roll-ups: `totalHours: 40`, `regularHours: 40`, `overtimeHours: 0`.
    - `submittedAt` set to the Friday at 17:00 UTC.
  - **Timesheet #2** (`sequenceNumber: 2`, `status: INCOMPLETE`)
    - `title: "Week of <periodStart>"` (the seed substitutes the actual ISO date)
    - `periodStart`/`periodEnd`: Monday–Friday of last week.
    - 3 entries: Monday `hours: 8` regular; Tuesday `hours: 8` regular; Tuesday `hours: 1` with `isOvertime: true` (demonstrates split entries on one day).
    - Roll-ups: `totalHours: 17`, `regularHours: 16`, `overtimeHours: 1`.
    - `submittedAt: null`.
- Carol gets no timesheets — represents the "MISSING" default state at the app layer (no row exists yet).

## Future backend contract (documented, not implemented here)

When the eventual `POST /timesheet` route is built, it MUST assign `sequenceNumber` like this:

```ts
await prisma.$transaction(async (tx) => {
  const last = await tx.timesheet.findFirst({
    where: { userId },
    orderBy: { sequenceNumber: "desc" },
    select: { sequenceNumber: true },
  });
  const next = (last?.sequenceNumber ?? 0) + 1;
  return tx.timesheet.create({
    data: { /* ...other fields..., */ userId, sequenceNumber: next },
  });
});
```

On `Prisma.PrismaClientKnownRequestError` with `code === "P2002"` (unique violation), retry once.

When entries are mutated, roll-ups MUST be recomputed in the same transaction:

```ts
const agg = await tx.timesheetEntry.aggregate({
  where: { timesheetId },
  _sum: { hours: true },
});
// ...also sum where isOvertime=true and where isOvertime=false...
await tx.timesheet.update({ where: { id: timesheetId }, data: { totalHours, regularHours, overtimeHours } });
```

## Other touch points

- `README.md`: update the `apps/backend` row description — drop "scan", mention "timesheets".
- `packages/db/src/index.ts`: no change (it re-exports the generated client, which will now include `Timesheet`, `TimesheetEntry`, `TimesheetStatus` automatically).

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Roll-up totals drift from entry sums | Always recompute roll-ups in the same transaction as entry writes. (Enforced in backend code, not schema.) |
| Concurrent timesheet creates race on `sequenceNumber` | `@@unique([userId, sequenceNumber])` guarantees correctness. Caller retries on `P2002`. |
| Destructive migration on a live DB with Scan data | None today (no consumers). Document in migration filename + spec. |
| Time-zone confusion on period dates | `@db.Date` columns — date only, no TZ. |

## Acceptance criteria

1. `pnpm db:generate` succeeds against the new schema.
2. `pnpm db:migrate` applies cleanly on a fresh DB.
3. `pnpm db:seed` runs without errors and produces:
   - 3 users
   - 2 timesheets each for Alice and Bob (sequenceNumber 1 and 2)
   - 5 entries on Alice's & Bob's COMPLETED timesheets, 3 entries on each INCOMPLETE one
   - 0 timesheets for Carol
4. `Scan` and `ScanType` are gone from the generated Prisma client.
5. `pnpm lint` and `pnpm build` pass.
