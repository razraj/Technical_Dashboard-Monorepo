# Timesheet Week APIs — Design

- **Date:** 2026-05-29
- **Status:** Draft (awaiting user review)
- **Owner:** Backend (`apps/backend`)
- **Related:** `packages/db/src/prisma/schema.prisma` (new flat `TimesheetEntry` model)

## Context & Problem

The schema was redesigned. The previous parent/child model (`Timesheet` + child
entries with `sequenceNumber`, `periodStart/End`, stored `status`, `totalHours`,
etc.) was removed. The current model is a single flat table:

```prisma
model TimesheetEntry {
  id          String   @id @default(uuid())
  date        DateTime @db.Date
  hours       Float
  workType    String
  description String   @db.Text
  userId      String
  projectId   String
  taskId      String?
  deletedAt   DateTime?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  // relations: user, project, task
}
```

There is **no stored `Timesheet` and no stored status**. "Weeks" and their status
must be **derived** from entries at read time. The old timesheet routes were
deleted, but `apps/backend/lib/timesheet.ts` and the timesheet Zod schemas in
`apps/backend/common/ZodSchema.ts` still reference the removed model and will not
typecheck — they must be rewritten.

We need to (re)build the timesheet API surface against this flat model.

## Goals

- **API-1 — Weekly Timesheet Listing** (`users-weekwise-timesheet.png`): paginated
  table of weeks with week number, date range, and computed status.
- **API-2 — Detailed Day-by-Day View** (`selected-week-timesheet-details.png`):
  for one week, total hours vs capacity plus entries grouped by day.
- **Entry writes** (`create-task-modal.png`): create, edit, and soft-delete a
  single `TimesheetEntry`.
- Remove/rewrite the dead `Timesheet`-era code so the backend typechecks.

## Non-Goals

- No stored/materialized weekly status or rollup columns (kept fully derived).
- No approval/submission workflow (no "submit timesheet" concept exists anymore).
- No manager **write** access to a report's entries (writes are self-only).
- No vitest harness setup (helpers are written as pure functions so they are
  testable later; no test runner is configured in this scope).

## Definitions (confirmed)

- **Week** = ISO 8601 week, **Monday → Sunday**. `weekNumber` = ISO week-of-year
  (1–53); `weekYear` = ISO week-numbering year (may differ from calendar year at
  year boundaries). Displayed date range = the week's **Monday–Friday**.
- **Status** from that week's total hours `h` vs the user's `weeklyCapacity`
  (default 40):
  - `MISSING` — `h == 0`
  - `INCOMPLETE` — `0 < h < capacity`
  - `COMPLETED` — `h >= capacity`
- **Aggregation window:** `totalHours` and `status` sum **all non-deleted entries
  in the full ISO week (Mon–Sun)** so no logged time is ever dropped from
  utilization. API-2's `days[]` lists **Mon–Fri** only (per UI). _Nuance:_ a
  weekend-dated entry counts toward `totalHours` but does not appear in `days[]`.
- **Listing range:** dense, gap-filled list of every ISO week from
  `isoWeekStart(min(firstEntryDate, today))` through
  `isoWeekStart(max(latestEntryDate, today))`. Weeks with no entries are
  `MISSING`. With no entries at all, the list contains the current week only.
- **Scope:** self by default. Read APIs accept optional `?userId=`, honored only
  for `MANAGER`/`ADMIN` (else `403`). Write APIs are self-only.

## Approach

In-memory aggregation (chosen). Fetch the relevant non-deleted entries, then
bucket and sum into ISO weeks using pure, UTC-based helper functions. Timesheet
data is per-user and bounded; this keeps week math testable and avoids raw SQL.
(Future scale path: `date_trunc('week')` aggregation via `$queryRaw`.)

All date math is **UTC** (entries are `@db.Date`, surfaced as UTC-midnight
`Date`s), consistent with the existing `parseDateOnly` helper.

## Shared Helpers — `apps/backend/lib/timesheet.ts` (rewritten)

Pure functions (no Prisma) unless noted:

- `parseDateOnly(value: string): Date` — keep existing `YYYY-MM-DD` → UTC-midnight parser.
- `isoWeekStart(date: Date): Date` — Monday (UTC) of the date's ISO week.
- `isoWeekParts(date: Date): { weekNumber: number; weekYear: number }` — ISO 8601.
- `addUtcDays(date: Date, days: number): Date`.
- `enumerateWeeks(startMonday: Date, endMonday: Date): Date[]` — inclusive list of Mondays.
- `computeStatus(totalHours: number, capacity: number): "MISSING" | "INCOMPLETE" | "COMPLETED"`.
- `toIsoDate(date: Date): string` — `YYYY-MM-DD`.
- `serializeEntry(entry): {...}` — new flat shape (see API-2 entry shape).

Old functions referencing the removed model (`serializeTimesheet`,
`recomputeRollups`, `createTimesheetForUser`, `getOwnedTimesheet`,
`nextSequenceNumber`, `decimalToNumber`, old `serializeTimesheetEntry`) are
removed. `hours` is now `Float`, so Decimal conversion is dropped.

## Validation — `apps/backend/common/ZodSchema.ts`

Remove stale `createTimesheetSchema`, `updateTimesheetSchema`,
`createTimesheetEntrySchema`, `updateTimesheetEntrySchema` (old shape). Add:

- `weeksQuerySchema` — `{ page?: int>=1 (default 1), pageSize?: int 1..100 (default 10), userId?: string }`.
- `weekDetailQuerySchema` — `{ userId?: string }`.
- `isoWeekStartParam` — `YYYY-MM-DD` string, refined to be a **Monday**.
- `createEntrySchema` — `{ date: YYYY-MM-DD, projectId: string, workType: string(min 1), description: string(min 1), hours: number >0 and <=24, taskId?: string }`.
- `updateEntrySchema` — partial of `createEntrySchema` (all optional), `taskId` nullable, `.refine` at least one field present.

## Endpoints

All routes are App-Router `route.ts` handlers under `apps/backend/app/timesheet/`.
Auth: read `x-user-id` (set by `proxy.ts`); `401` if absent. Errors are wrapped in
`try/catch` returning `500` with a message, matching existing routes.

### API-1 — `GET /timesheet/weeks`

- **Query:** `page`, `pageSize`, optional `userId`.
- **Access:** if `userId` present and != caller, look up caller's `role`; allow
  only `MANAGER`/`ADMIN`, else `403`. Target user not found → `404`.
- **Logic:** load target user's `weeklyCapacity`; find `min(date)`/`max(date)` of
  non-deleted entries; build dense week list; sum hours per ISO week; compute
  status; sort **newest-first**; paginate.
- **Response 200:**

```json
{
  "weeks": [
    { "weekNumber": 5, "weekYear": 2024, "periodStart": "2024-01-29",
      "periodEnd": "2024-02-02", "totalHours": 0, "status": "MISSING" }
  ],
  "page": 1, "pageSize": 10, "total": 5
}
```

(`periodEnd` is the Friday. Frontend maps `status` → View/Update/Create action.)

### API-2 — `GET /timesheet/weeks/[weekStart]`

- **Param:** `weekStart` = a Monday `YYYY-MM-DD` (`400` if not a Monday/invalid).
- **Query:** optional `userId` (same access rule as API-1).
- **Logic:** load `weeklyCapacity`; fetch non-deleted entries where
  `date` ∈ `[weekStart, weekStart+6]`, include `project {id,name}` and
  `task {id,title}`; `totalHours` = sum over the ISO week; build Mon–Fri `days[]`.
- **Response 200:**

```json
{
  "weekNumber": 4, "weekYear": 2024,
  "periodStart": "2024-01-22", "periodEnd": "2024-01-26",
  "totalHours": 20, "capacity": 40, "utilization": 50,
  "status": "INCOMPLETE",
  "days": [
    { "date": "2024-01-22", "dayLabel": "Mon", "totalHours": 8,
      "entries": [
        { "id": "…", "hours": 8, "workType": "Development",
          "description": "Homepage Development",
          "project": { "id": "…", "name": "Project Name" },
          "task": { "id": "…", "title": "…" } }
      ] }
  ]
}
```

`utilization` = `round(totalHours / capacity * 100)` (capacity 0 → `0`).

### Create — `POST /timesheet/entries`

- **Body:** `createEntrySchema`. `userId` = caller (self-only).
- **Validation:** project exists & not soft-deleted (`404`/`400`); if `taskId`
  given, task exists, not deleted, and belongs to `projectId` (`400`).
- **Response 201:** `{ entry: serializeEntry(created) }`.

### Edit — `PATCH /timesheet/entries/[entryId]`

- **Body:** `updateEntrySchema`. Entry must exist, be non-deleted, and owned by
  caller → else `404`. Same project/task referential checks when those fields
  change.
- **Response 200:** `{ entry: serializeEntry(updated) }`.

### Soft delete — `DELETE /timesheet/entries/[entryId]`

- Entry must exist, be non-deleted, owned by caller → else `404`.
- Sets `deletedAt = now()`.
- **Response 200:** `{ success: true, id }`.

## Error Summary

| Code | When |
|------|------|
| 400 | invalid query/param/body; `weekStart` not a Monday; bad project/task reference |
| 401 | missing `x-user-id` |
| 403 | non-manager/admin requests another user's data via `?userId=` |
| 404 | target user / entry not found (or not owned / soft-deleted) |
| 500 | unexpected error (wrapped) |

## Edge Cases

- User with **no entries** → API-1 returns the current week only (`MISSING`).
- Entries dated in the **future** extend the dense range's end.
- **Weekend** entries count in `totalHours` but are absent from API-2 `days[]`.
- **ISO year boundary:** late-December dates can belong to week 1 of the next
  `weekYear` (and early-January to week 52/53 of the previous) — handled by
  `isoWeekParts` returning `weekYear`.
- Soft-deleted entries are excluded from every read and aggregation.

## Testing

Week-math helpers are pure functions and will be written to be unit-testable
(ISO boundaries, dense enumeration, status thresholds). No vitest harness is set
up in this scope; `yarn test` remains a no-op until a harness is added.

## Cleanup / Migration Notes

The model rename has wider blast radius than just the API layer. All of the
following reference the removed `Timesheet`/`TimesheetStatus` and must be updated
for the monorepo to typecheck/build:

- `packages/db/src/index.ts` — stop re-exporting `TimesheetStatus` (value) and
  `Timesheet` (type); export the models/enums that now exist (`Role`,
  `TaskStatus`, `Project`, `Task`).
- `packages/db/src/seed.ts` — rewrite to the flat model: create a manager + a
  project, then `TimesheetEntry` rows (`date`, `hours`, `workType`, `description`,
  `projectId`) spanning a COMPLETED and an INCOMPLETE week.
- `apps/backend/lib/timesheet.ts` — rewrite (pure helpers + `serializeEntry` +
  `resolveTimesheetTarget`); remove old `Timesheet`-era functions.
- `apps/backend/common/ZodSchema.ts` — drop the stale timesheet schemas and the
  `TimesheetStatus` import; add the new query/body schemas.
- Run `yarn workspace @repo/db db:generate` so the Prisma client matches the new
  schema before typechecking.
- Verify with `yarn workspace backend exec tsc --noEmit`,
  `yarn workspace backend lint`, and `yarn workspace @repo/db lint`.
- Applying the schema (index changes + model rename) to an actual database needs a
  new migration (`yarn workspace @repo/db db:migrate`) — tracked separately; not
  required for typecheck/lint verification.

Note: `docs/postman/APIs.postman_collection.json` and `.claude/rules/gotchas.md`
also mention the old endpoints/model but are documentation only (no build impact);
updating them is optional follow-up.

## Open Assumptions (please confirm in review)

1. **Per-entry hours cap = 24** (can't log >24h in one day). Weekly capacity is a
   separate, soft threshold (drives status, not a hard limit).
2. **Writes are self-only** (managers/admins cannot create/edit/delete a report's
   entries through these endpoints).
3. `totalHours`/`status` aggregate the **full Mon–Sun** ISO week while `days[]` is
   **Mon–Fri** (weekend hours count but aren't itemized in the detail view).
