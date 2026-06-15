# Timesheet Web UI — Design

- **Date:** 2026-05-29
- **Status:** Draft (awaiting user review)
- **Owner:** Web (`apps/web`), with one small backend addition (`apps/backend`)
- **Related:**
  - `docs/superpowers/specs/2026-05-29-timesheet-week-apis-design.md` (backend API design)
  - Backend routes already built: `GET /timesheet/weeks`, `GET /timesheet/weeks/[weekStart]`,
    `POST /timesheet/entries`, `PATCH`/`DELETE /timesheet/entries/[entryId]`
  - Mockups: `create-task-modal.png`, `selected-week-timesheet-details.png`,
    `users-weekwise-timesheet.png`

## Context & Problem

The timesheet backend APIs exist and are committed, but nothing in `apps/web` consumes
them. Two components match the mockups but are **hardcoded** and unwired:

- `apps/web/components/weeks_timesheet.tsx` — "This week's timesheet" day-by-day view
  (image 2), driven by a hardcoded `INITIAL_WEEK` constant.
- `apps/web/components/add-entry-modal.tsx` — "Add New Entry" modal (image 1), a static
  form with placeholder selects and no submit logic.

There is **no** weekly listing UI (image 3), and the `/dashboard` page currently renders an
unrelated Users list. This work wires the existing components to the live APIs, adds the
missing listing UI, and routes the three views together.

## Goals

- **Weekly listing** (`users-weekwise-timesheet.png`) on `/dashboard`: paginated table of
  weeks (week #, date range, status) backed by `GET /timesheet/weeks`.
- **Week detail** (`selected-week-timesheet-details.png`) on `/dashboard/[weekStart]`:
  total vs capacity, utilization, and entries grouped Mon–Fri, backed by
  `GET /timesheet/weeks/[weekStart]`.
- **Create/Edit/Delete entries** (`create-task-modal.png`): the modal performs real
  `POST`/`PATCH`, and the row menu performs soft-`DELETE`.
- **Projects endpoint:** add a small read-only `GET /project` so the modal's Project
  dropdown shows real projects.

## Non-Goals

- No Date Range / Status filters on the listing (the listing API only supports
  `page`/`pageSize`). The mockup's filter controls are intentionally omitted for now.
- No manager/admin "view another user" selector — UI is **self-only** (the `?userId=`
  override stays unused).
- No task picker in the modal — `taskId` is optional on the API and there is no tasks
  endpoint; the field is omitted entirely.
- No tasks API, no approval/submission workflow, no new global state library.
- No vitest harness (none configured in the repo); verification is typecheck + lint.

## Decisions (confirmed in brainstorming)

1. **Project data source:** add a small read-only backend `GET /project` endpoint.
2. **Listing location:** the weekly listing **replaces** the current Users view on `/dashboard`.
3. **Detail location:** a dedicated sub-route `/dashboard/[weekStart]` (full page, back link
   to the listing).
4. **Scope:** self-only.
5. **Filters:** omit Date Range/Status; implement pagination + page-size selector only.
6. **Create/Edit:** the "Add New Entry" modal is used for **both** create and edit; the row
   menu's Delete soft-deletes via the API.

## Approach

**Client-side fetching via the existing pattern** (chosen). The repo already uses client
components wrapped in `AuthGuard`, with `fetchWithAuth` (`utils/api.ts`) injecting
`x-user-id` from `localStorage`, and thin per-resource functions under `actions/`. The new
timesheet UI follows the same pattern.

- Rejected: **Server Components** — auth identity lives in `localStorage` (client-only), so
  server components cannot resolve the user without reworking auth.
- Rejected: **React Query/SWR** — introduces a dependency and pattern not used in the repo;
  unnecessary for this scope.

All week detail navigation keys on the week's Monday (`periodStart`, `YYYY-MM-DD`), which is
exactly the `weekStart` path param API-2 expects.

## Backend Addition — `GET /project`

- **File:** `apps/backend/app/project/route.ts`.
- **Auth:** read `x-user-id` (set by `proxy.ts`); `401` if absent. Wrapped in `try/catch`
  returning `500` with a message, matching existing routes.
- **Logic:** return all non-deleted projects, `id` + `name` only, ordered by `name`.
- **Response 200:** `{ "projects": [ { "id": "…", "name": "Homepage Redesign" } ] }`.
- Self-only scope: any authenticated user may list projects to pick one when logging time
  (the create API already validates the chosen `projectId`).

## Web — Types (`apps/web/types.ts`)

Add (alongside the existing `User` types):

```ts
export interface Project {
    id: string;
    name: string;
}

export type WeekStatus = "MISSING" | "INCOMPLETE" | "COMPLETED";

export interface WeekSummary {
    weekNumber: number;
    weekYear: number;
    periodStart: string; // YYYY-MM-DD (Monday)
    periodEnd: string;   // YYYY-MM-DD (Friday)
    totalHours: number;
    status: WeekStatus;
}

export interface WeeksResponse {
    weeks: WeekSummary[];
    page: number;
    pageSize: number;
    total: number;
}

export interface TimesheetEntry {
    id: string;
    date: string;
    hours: number;
    workType: string;
    description: string;
    projectId: string;
    taskId: string | null;
    project: { id: string; name: string } | null;
    task: { id: string; title: string } | null;
    createdAt: string;
    updatedAt: string;
}

export interface DayDetail {
    date: string;     // YYYY-MM-DD
    dayLabel: string; // Mon..Fri
    totalHours: number;
    entries: TimesheetEntry[];
}

export interface WeekDetail {
    weekNumber: number;
    weekYear: number;
    periodStart: string;
    periodEnd: string;
    totalHours: number;
    capacity: number;
    utilization: number;
    status: WeekStatus;
    days: DayDetail[];
}
```

## Web — Data layer (`apps/web/actions/timesheet.ts`)

Thin wrappers over `fetchWithAuth`, mirroring `actions/user.ts`:

- `getWeeks(page = 1, pageSize = 10): Promise<WeeksResponse>` → `GET /timesheet/weeks?page=&pageSize=`
- `getWeekDetail(weekStart: string): Promise<WeekDetail>` → `GET /timesheet/weeks/${weekStart}`
- `getProjects(): Promise<{ projects: Project[] }>` → `GET /project`
- `createEntry(payload): Promise<{ entry: TimesheetEntry }>` → `POST /timesheet/entries`
- `updateEntry(entryId, payload): Promise<{ entry: TimesheetEntry }>` → `PATCH /timesheet/entries/${entryId}`
- `deleteEntry(entryId): Promise<{ success: boolean; id: string }>` → `DELETE /timesheet/entries/${entryId}`

`createEntry` payload: `{ date, projectId, workType, description, hours }` (no `taskId`).
`updateEntry` payload: a partial of the same (at least one field).

## Web — Dashboard listing (`apps/web/app/dashboard/page.tsx`)

Rewrite the page body to render a new `TimesheetList` component inside the existing
`AuthGuard` + `SidebarProvider`/`AppSidebar` shell (breadcrumb updated to "Timesheets").

`TimesheetList` (new component, e.g. `components/timesheet-list.tsx`):

- On mount and on page/pageSize change, calls `getWeeks(page, pageSize)`.
- **Table columns:** `WEEK #` (`weekNumber`), `DATE` (formatted `"22 - 26 January, 2024"`
  from `periodStart`–`periodEnd`), `STATUS` (badge), `ACTIONS`.
- **Status badge colors:** `COMPLETED` green, `INCOMPLETE` yellow/amber, `MISSING` pink/rose.
- **Action label by status:** `COMPLETED → "View"`, `INCOMPLETE → "Update"`,
  `MISSING → "Create"`; all are links to `/dashboard/${periodStart}`.
- **Footer:** page-size selector (`5 | 10 | 20`, default 10) on the left; `Previous` / page
  indicator / `Next` on the right, derived from `total`, `page`, `pageSize`.
- **States:** loading skeleton rows; empty state if `total === 0` (should be rare — API
  always returns at least the current week).

Date formatting: render in UTC to match the API's UTC-midnight dates (avoid off-by-one from
local timezone). Same-month ranges render as `"22 - 26 January, 2024"`; cross-month ranges
render as `"28 January - 1 February, 2024"`.

## Web — Week detail (`apps/web/app/dashboard/[weekStart]/page.tsx`)

New page inside `AuthGuard` + sidebar shell, with a back link to `/dashboard`. It:

- Reads the `weekStart` route param, calls `getWeekDetail(weekStart)`.
- Renders the refactored `WeeksTimesheet` component with live data.

`WeeksTimesheet` refactor (`components/weeks_timesheet.tsx`):

- **Props:** `{ detail: WeekDetail; onChanged: () => void }` (no more hardcoded
  `INITIAL_WEEK`; remove the local mock and the inline task-name editing state).
- **Header:** title "This week's timesheet", date range from `periodStart`–`periodEnd`,
  `totalHours`/`capacity` text, and a progress bar at `utilization%`.
- **Body:** map `detail.days` (Mon–Fri). For each entry row show `description`, `${hours} hrs`,
  and a project badge (`entry.project?.name`). Each row keeps the `⋯` menu with **Edit** and
  **Delete**. Each day ends with an **"Add new task"** button.
- **Add new task** → opens the modal in *create* mode with that day's `date` prefilled.
- **Edit** → opens the modal in *edit* mode, prefilled from the entry.
- **Delete** → `deleteEntry(entry.id)`, then `onChanged()` to refetch; errors via `toast`.
- After a successful create/edit, the modal closes and `onChanged()` refetches the week.

The page owns the detail state and the refetch (`onChanged` re-calls `getWeekDetail`), so the
component stays presentational.

## Web — Add/Edit Entry modal (`apps/web/components/add-entry-modal.tsx`)

Upgrade the static modal into a controlled form supporting both modes.

- **Props:**
  `{ open, onOpenChange, date, entry?: TimesheetEntry | null, onSubmitted: () => void }`.
  `entry` present ⇒ edit mode (title "Edit Entry", `PATCH`); absent ⇒ create mode (title
  "Add New Entry", `POST`).
- **Fields / state:**
  - **Project** `Select` populated from `getProjects()` (fetched when the modal opens; cached
    across opens). Value = `projectId`.
  - **Type of Work** `Select` from a small fixed list — `Development`, `Bug fixes`,
    `Feature`, `Meeting`, `Review` — submitted as the `workType` string. In edit mode, if the
    entry's `workType` isn't in the list it is added so it shows correctly.
  - **Task description** `Textarea` → `description` (required, min 1).
  - **Hours** stepper, integer-ish number clamped to `1..24` (API requires `> 0, <= 24`);
    `+`/`-` buttons and direct input.
- **Submit:** build the payload, call `createEntry`/`updateEntry`; on success close + call
  `onSubmitted()`. Disable the submit button while pending. Surface validation/server errors
  via `toast` (reusing `fetchWithAuth`'s typed errors).
- **Validation (client):** require `projectId`, `workType`, non-empty `description`, and
  `1 <= hours <= 24` before enabling submit.

## Web — Sidebar (`apps/web/components/app-sidebar.tsx`)

Point one nav item at `/dashboard` and label it "Timesheets" (the listing landing). Remaining
placeholder nav items are out of scope and left unchanged.

## Data Flow

```
/dashboard (TimesheetList)
   └─ getWeeks(page,pageSize) ─────────────► GET /timesheet/weeks
   └─ row action link ──► /dashboard/[weekStart]

/dashboard/[weekStart] (page owns detail state)
   └─ getWeekDetail(weekStart) ────────────► GET /timesheet/weeks/[weekStart]
   └─ <WeeksTimesheet detail onChanged>
         ├─ "Add new task" / "Edit" ──► <AddEntryModal date entry?>
         │        └─ getProjects() ───────► GET /project
         │        └─ createEntry/updateEntry ─► POST / PATCH /timesheet/entries[/id]
         │        └─ onSubmitted() ──► page refetches getWeekDetail
         └─ "Delete" ──► deleteEntry(id) ──► DELETE /timesheet/entries/[id]
                  └─ onChanged() ──► page refetches getWeekDetail
```

## Error Handling

- All calls go through `fetchWithAuth`, which already maps `401 → refresh/redirect`, and
  `400/403/404/5xx` to typed errors (`BadRequestError`, etc.).
- UI surfaces failures with the existing `toast` (`@repo/ui/components`); destructive and
  submit actions show a pending state and re-enable on error.

## Testing / Verification

No vitest harness is configured (consistent with the backend plan). Verify with:

- `yarn workspace web exec tsc --noEmit`
- `yarn workspace web lint`
- `yarn workspace backend exec tsc --noEmit` (for the new `GET /project` route)
- `yarn workspace backend lint`

Manual smoke (optional, needs seeded DB + running apps): log in as the seeded employee,
confirm `/dashboard` lists weeks (one COMPLETED, one INCOMPLETE, current week MISSING), open a
week, add/edit/delete an entry, and confirm totals/utilization update.

## Open Assumptions (please confirm in review)

1. **Work-type options** are a small fixed frontend list (`Development`, `Bug fixes`,
   `Feature`, `Meeting`, `Review`); `workType` remains a free string server-side.
2. **Hours** are entered as whole numbers, clamped `1..24`.
3. `GET /project` returns **all** non-deleted projects to any authenticated user (no
   per-user project scoping exists in the schema for this flow).
4. Replacing the Users view on `/dashboard` is acceptable (the old users fetch/UI is removed
   from that page; the `GET /user` action remains available but unused there).
