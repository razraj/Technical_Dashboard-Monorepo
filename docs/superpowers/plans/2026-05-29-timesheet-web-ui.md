# Timesheet Web UI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire `apps/web` to the existing timesheet APIs — a weekly listing on `/dashboard`, a day-by-day week detail on `/dashboard/[weekStart]`, and a create/edit/delete entry modal — plus a small read-only `GET /project` endpoint for the modal's project dropdown.

**Architecture:** Client components (matching the repo's existing `AuthGuard` + `fetchWithAuth` + `actions/` pattern). Thin per-call wrappers in `actions/timesheet.ts` hit the App-Router backend routes; pages own data state and pass it to presentational components. Week navigation keys on the week's Monday (`periodStart`), which is exactly the `weekStart` path param the detail API expects.

**Tech Stack:** TypeScript, Next.js 16 (App Router, React 19), `@repo/ui` (shadcn-style components), Prisma 7 (`@repo/db`), Zod (backend).

---

## Verification Note (no test harness)

No vitest/jest harness is configured in this repo (`yarn test` is a no-op), consistent with the backend timesheet plan. This plan verifies each task with `tsc --noEmit` + `lint` (the meaningful gates here). Runtime smoke testing against a live DB is optional and noted at the end. Commit messages follow the repo's plain style ("Add ...").

The `@repo/ui` package has **no** `table` or `badge` component — the listing is built from a styled HTML `<table>` and `<span>` badges with Tailwind classes (the same approach the existing `weeks_timesheet.tsx` uses for its project badge).

---

## Task 1: Backend — read-only `GET /project`

**Files:**
- Create: `apps/backend/app/project/route.ts`

- [ ] **Step 1: Create the route**

```ts
import prisma from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
    try {
        const callerId = req.headers.get("x-user-id");
        if (!callerId) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const projects = await prisma.project.findMany({
            where: { deletedAt: null },
            select: { id: true, name: true },
            orderBy: { name: "asc" }
        });

        return NextResponse.json({ projects }, { status: 200 });
    } catch (error) {
        console.log("🚀 ~ GET /project ~ error:", error);
        return NextResponse.json({ message: "Error fetching projects" }, { status: 500 });
    }
}
```

- [ ] **Step 2: Verify backend typechecks**

Run: `yarn workspace backend exec tsc --noEmit`
Expected: PASS (no errors).

- [ ] **Step 3: Lint the backend**

Run: `yarn workspace backend lint`
Expected: no NEW warnings/errors from `app/project/route.ts`. (Two pre-existing warnings in `apps/backend/lib/email.ts` are out of scope.)

- [ ] **Step 4: Commit**

```bash
git add apps/backend/app/project/route.ts
git commit -m "Add GET /project read-only listing API"
```

---

## Task 2: Web — timesheet types

**Files:**
- Modify: `apps/web/types.ts`

- [ ] **Step 1: Append the timesheet types**

Append to the end of `apps/web/types.ts` (keep the existing `User`/`UserResponse` exports):

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
    periodEnd: string; // YYYY-MM-DD (Friday)
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
    date: string; // YYYY-MM-DD
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

- [ ] **Step 2: Verify web typechecks**

Run: `yarn workspace web exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/types.ts
git commit -m "Add timesheet web types"
```

---

## Task 3: Web — timesheet data layer

**Files:**
- Create: `apps/web/actions/timesheet.ts`

- [ ] **Step 1: Create the action wrappers**

```ts
import { Project, TimesheetEntry, WeekDetail, WeeksResponse } from "@/types";
import { fetchWithAuth } from "@/utils/api";

export interface EntryPayload {
    date: string;
    projectId: string;
    workType: string;
    description: string;
    hours: number;
}

export const getWeeks = (page = 1, pageSize = 10): Promise<WeeksResponse> =>
    fetchWithAuth(`/timesheet/weeks?page=${page}&pageSize=${pageSize}`, { method: "GET" });

export const getWeekDetail = (weekStart: string): Promise<WeekDetail> =>
    fetchWithAuth(`/timesheet/weeks/${weekStart}`, { method: "GET" });

export const getProjects = (): Promise<{ projects: Project[] }> =>
    fetchWithAuth(`/project`, { method: "GET" });

export const createEntry = (payload: EntryPayload): Promise<{ entry: TimesheetEntry }> =>
    fetchWithAuth(`/timesheet/entries`, { method: "POST", body: JSON.stringify(payload) });

export const updateEntry = (
    entryId: string,
    payload: Partial<EntryPayload>
): Promise<{ entry: TimesheetEntry }> =>
    fetchWithAuth(`/timesheet/entries/${entryId}`, { method: "PATCH", body: JSON.stringify(payload) });

export const deleteEntry = (entryId: string): Promise<{ success: boolean; id: string }> =>
    fetchWithAuth(`/timesheet/entries/${entryId}`, { method: "DELETE" });
```

- [ ] **Step 2: Verify web typechecks**

Run: `yarn workspace web exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/actions/timesheet.ts
git commit -m "Add timesheet web data layer"
```

---

## Task 4: Web — Add/Edit Entry modal

**Files:**
- Modify (replace whole file): `apps/web/components/add-entry-modal.tsx`

Upgrades the static modal into a controlled form used for both create and edit. Depends on Task 3 (`actions/timesheet`) and Task 2 (types).

- [ ] **Step 1: Replace the entire file contents**

```tsx
"use client";

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@repo/ui/components/dialog"
import { FieldGroup, Field, FieldLabel, FieldDescription } from "@repo/ui/components/field"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/components/select"
import { Textarea } from "@repo/ui/components/textarea"
import { Button } from "@repo/ui/components/button"
import { InfoIcon, MinusIcon, PlusIcon } from "lucide-react"
import { toast } from "@repo/ui/components"
import { createEntry, getProjects, updateEntry } from "@/actions/timesheet"
import { Project, TimesheetEntry } from "@/types"

const WORK_TYPES = ["Development", "Bug fixes", "Feature", "Meeting", "Review"]

type AddEntryModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  date: string
  entry?: TimesheetEntry | null
  onSubmitted: () => void
}

export function AddEntryModal({ open, onOpenChange, date, entry, onSubmitted }: AddEntryModalProps) {
  const isEdit = Boolean(entry)
  const [projects, setProjects] = useState<Project[]>([])
  const [projectId, setProjectId] = useState("")
  const [workType, setWorkType] = useState("")
  const [description, setDescription] = useState("")
  const [hours, setHours] = useState(8)
  const [pending, setPending] = useState(false)

  // Load projects whenever the modal opens (cheap; cached in component state).
  useEffect(() => {
    if (!open) return
    let active = true
    getProjects()
      .then((res) => {
        if (active) setProjects(res.projects)
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : "Failed to load projects"
        toast.error(message)
      })
    return () => {
      active = false
    }
  }, [open])

  // Sync the form to the entry being edited (or reset for create) when opened.
  useEffect(() => {
    if (!open) return
    setProjectId(entry?.projectId ?? "")
    setWorkType(entry?.workType ?? "")
    setDescription(entry?.description ?? "")
    setHours(entry?.hours ?? 8)
  }, [open, entry])

  const workTypeOptions =
    entry?.workType && !WORK_TYPES.includes(entry.workType) ? [entry.workType, ...WORK_TYPES] : WORK_TYPES

  const clampHours = (value: number) => {
    if (Number.isNaN(value)) return 1
    return Math.max(1, Math.min(24, Math.round(value)))
  }

  const canSubmit =
    projectId.length > 0 &&
    workType.length > 0 &&
    description.trim().length > 0 &&
    hours >= 1 &&
    hours <= 24 &&
    !pending

  const handleSubmit = async () => {
    if (!canSubmit) return
    setPending(true)
    try {
      if (isEdit && entry) {
        await updateEntry(entry.id, { projectId, workType, description: description.trim(), hours })
      } else {
        await createEntry({ date, projectId, workType, description: description.trim(), hours })
      }
      toast.success(isEdit ? "Entry updated" : "Entry added")
      onOpenChange(false)
      onSubmitted()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Something went wrong"
      toast.error(message)
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-xl">{isEdit ? "Edit Entry" : "Add New Entry"}</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <FieldGroup>
            <Field>
              <div className="flex items-center gap-1.5">
                <FieldLabel htmlFor="project">Select Project *</FieldLabel>
                <InfoIcon className="size-4 text-muted-foreground" />
              </div>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger id="project">
                  <SelectValue placeholder="Project Name" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <div className="flex items-center gap-1.5">
                <FieldLabel htmlFor="typeOfWork">Type of Work *</FieldLabel>
                <InfoIcon className="size-4 text-muted-foreground" />
              </div>
              <Select value={workType} onValueChange={setWorkType}>
                <SelectTrigger id="typeOfWork">
                  <SelectValue placeholder="Bug fixes" />
                </SelectTrigger>
                <SelectContent>
                  {workTypeOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel htmlFor="description">Task description *</FieldLabel>
              <Textarea
                id="description"
                placeholder="Write text here ..."
                className="min-h-[120px] resize-none"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
              <FieldDescription>A note for extra info</FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="hours">Hours *</FieldLabel>
              <div className="flex h-9 w-fit items-center overflow-hidden rounded-md border border-input">
                <button
                  type="button"
                  onClick={() => setHours((h) => clampHours(h - 1))}
                  className="flex aspect-square h-full items-center justify-center border-r hover:bg-muted text-muted-foreground"
                >
                  <MinusIcon className="size-4" />
                </button>
                <input
                  type="number"
                  id="hours"
                  className="h-full w-12 border-0 bg-transparent text-center text-sm focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  value={hours}
                  min={1}
                  max={24}
                  onChange={(event) => setHours(clampHours(Number(event.target.value)))}
                />
                <button
                  type="button"
                  onClick={() => setHours((h) => clampHours(h + 1))}
                  className="flex aspect-square h-full items-center justify-center border-l hover:bg-muted text-muted-foreground"
                >
                  <PlusIcon className="size-4" />
                </button>
              </div>
            </Field>
          </FieldGroup>
        </div>
        <DialogFooter className="flex w-full flex-col gap-4 sm:flex-row sm:justify-between">
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
          >
            {pending ? "Saving..." : isEdit ? "Save changes" : "Add entry"}
          </Button>
          <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Verify web typechecks**

Run: `yarn workspace web exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/add-entry-modal.tsx
git commit -m "Wire Add/Edit Entry modal to timesheet API"
```

---

## Task 5: Web — refactor `WeeksTimesheet` to live data

**Files:**
- Modify (replace whole file): `apps/web/components/weeks_timesheet.tsx`

Removes the hardcoded `INITIAL_WEEK` and inline task-name editing; the component is now presentational, driven by a `WeekDetail` prop, and uses the modal for create/edit and the API for delete. Depends on Task 4 (modal) and Task 3 (actions).

- [ ] **Step 1: Replace the entire file contents**

```tsx
"use client"

import { useState } from "react"
import { MoreHorizontalIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react"
import { Button } from "@repo/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu"
import { cn } from "@repo/ui/lib/utils"
import { toast } from "@repo/ui/components"
import { AddEntryModal } from "@/components/add-entry-modal"
import { deleteEntry } from "@/actions/timesheet"
import { TimesheetEntry, WeekDetail } from "@/types"

function formatRange(periodStart: string, periodEnd: string): string {
  const start = new Date(periodStart)
  const end = new Date(periodEnd)
  const month = (d: Date) => d.toLocaleDateString("en-US", { month: "long", timeZone: "UTC" })
  const day = (d: Date) => d.toLocaleDateString("en-US", { day: "numeric", timeZone: "UTC" })
  const year = end.toLocaleDateString("en-US", { year: "numeric", timeZone: "UTC" })
  if (month(start) === month(end)) {
    return `${day(start)} - ${day(end)} ${month(end)}, ${year}`
  }
  return `${day(start)} ${month(start)} - ${day(end)} ${month(end)}, ${year}`
}

export function WeeksTimesheet({ detail, onChanged }: { detail: WeekDetail; onChanged: () => void }) {
  const [modalOpen, setModalOpen] = useState(false)
  const [modalDate, setModalDate] = useState(detail.periodStart)
  const [editEntry, setEditEntry] = useState<TimesheetEntry | null>(null)

  const completionPct = Math.min(100, detail.utilization)

  const openCreate = (date: string) => {
    setEditEntry(null)
    setModalDate(date)
    setModalOpen(true)
  }

  const openEdit = (entry: TimesheetEntry) => {
    setEditEntry(entry)
    setModalDate(entry.date)
    setModalOpen(true)
  }

  const handleDelete = async (entryId: string) => {
    try {
      await deleteEntry(entryId)
      toast.success("Entry deleted")
      onChanged()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete entry"
      toast.error(message)
    }
  }

  return (
    <Card className="gap-4 py-5">
      <CardHeader className="flex items-start justify-between gap-4 px-4 sm:px-6">
        <div>
          <CardTitle className="text-2xl font-semibold tracking-tight">This week&apos;s timesheet</CardTitle>
          <p className="mt-2 text-sm text-muted-foreground">{formatRange(detail.periodStart, detail.periodEnd)}</p>
        </div>
        <div className="min-w-[170px]">
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="font-semibold">
              {detail.totalHours}/{detail.capacity} hrs
            </span>
            <span className="text-muted-foreground">{completionPct}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-orange-400 transition-all duration-300"
              style={{ width: `${completionPct}%` }}
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 px-4 sm:px-6">
        {detail.days.map((day) => (
          <section
            key={day.date}
            className="grid grid-cols-1 gap-3 border-b border-dashed border-muted pb-4 last:border-0"
          >
            <div className="grid grid-cols-[84px_1fr] gap-3">
              <h3 className="pt-2 text-lg font-semibold leading-none">{day.dayLabel}</h3>
              <div className="space-y-2">
                {day.entries.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2 shadow-xs"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <p className="truncate text-sm font-medium">{entry.description}</p>
                    </div>

                    <span className="text-sm text-muted-foreground">{entry.hours} hrs</span>
                    {entry.project ? (
                      <span className="rounded-sm bg-accent px-2 py-1 text-xs font-medium text-accent-foreground">
                        {entry.project.name}
                      </span>
                    ) : null}

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" className="size-7">
                          <MoreHorizontalIcon className="size-4" />
                          <span className="sr-only">Open row menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(entry)}>
                          <PencilIcon className="size-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem variant="destructive" onClick={() => handleDelete(entry.id)}>
                          <Trash2Icon className="size-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}

                <Button
                  variant="ghost"
                  className={cn(
                    "w-full justify-center rounded-lg border border-dashed border-primary/30 text-primary hover:bg-primary/5",
                    day.entries.length === 0 && "text-muted-foreground border-muted-foreground/20"
                  )}
                  onClick={() => openCreate(day.date)}
                >
                  <PlusIcon className="size-4" />
                  Add new task
                </Button>
              </div>
            </div>
          </section>
        ))}
      </CardContent>

      <AddEntryModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        date={modalDate}
        entry={editEntry}
        onSubmitted={onChanged}
      />
    </Card>
  )
}
```

- [ ] **Step 2: Verify web typechecks**

Run: `yarn workspace web exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/weeks_timesheet.tsx
git commit -m "Drive WeeksTimesheet from live week-detail data"
```

---

## Task 6: Web — `TimesheetList` listing component

**Files:**
- Create: `apps/web/components/timesheet-list.tsx`

Renders the weekly listing (image 3) from `GET /timesheet/weeks`, with pagination + page-size selector and per-row links into the detail route. Depends on Task 3 (actions) and Task 2 (types).

- [ ] **Step 1: Create the component**

```tsx
"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Button } from "@repo/ui/components/button"
import { Skeleton } from "@repo/ui/components/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/components/select"
import { cn } from "@repo/ui/lib/utils"
import { toast } from "@repo/ui/components"
import { getWeeks } from "@/actions/timesheet"
import { WeekStatus, WeekSummary } from "@/types"

const PAGE_SIZES = [5, 10, 20]

const STATUS_STYLES: Record<WeekStatus, string> = {
  COMPLETED: "bg-green-100 text-green-700",
  INCOMPLETE: "bg-amber-100 text-amber-700",
  MISSING: "bg-rose-100 text-rose-700",
}

const ACTION_LABELS: Record<WeekStatus, string> = {
  COMPLETED: "View",
  INCOMPLETE: "Update",
  MISSING: "Create",
}

function formatRange(periodStart: string, periodEnd: string): string {
  const start = new Date(periodStart)
  const end = new Date(periodEnd)
  const month = (d: Date) => d.toLocaleDateString("en-US", { month: "long", timeZone: "UTC" })
  const day = (d: Date) => d.toLocaleDateString("en-US", { day: "numeric", timeZone: "UTC" })
  const year = end.toLocaleDateString("en-US", { year: "numeric", timeZone: "UTC" })
  if (month(start) === month(end)) {
    return `${day(start)} - ${day(end)} ${month(end)}, ${year}`
  }
  return `${day(start)} ${month(start)} - ${day(end)} ${month(end)}, ${year}`
}

export function TimesheetList() {
  const [weeks, setWeeks] = useState<WeekSummary[]>([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    getWeeks(page, pageSize)
      .then((res) => {
        if (!active) return
        setWeeks(res.weeks)
        setTotal(res.total)
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : "Failed to load timesheets"
        toast.error(message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [page, pageSize])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="rounded-xl border bg-card">
      <div className="px-6 py-5">
        <h2 className="text-2xl font-bold tracking-tight">Your Timesheets</h2>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-y bg-muted/40 text-left text-xs font-medium uppercase text-muted-foreground">
              <th className="px-6 py-3">Week #</th>
              <th className="px-6 py-3">Date</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: pageSize }).map((_, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="px-6 py-4">
                      <Skeleton className="h-4 w-6" />
                    </td>
                    <td className="px-6 py-4">
                      <Skeleton className="h-4 w-40" />
                    </td>
                    <td className="px-6 py-4">
                      <Skeleton className="h-5 w-24 rounded-full" />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Skeleton className="ml-auto h-4 w-12" />
                    </td>
                  </tr>
                ))
              : weeks.map((week) => (
                  <tr key={`${week.weekYear}-${week.weekNumber}`} className="border-b last:border-0">
                    <td className="px-6 py-4 text-muted-foreground">{week.weekNumber}</td>
                    <td className="px-6 py-4">{formatRange(week.periodStart, week.periodEnd)}</td>
                    <td className="px-6 py-4">
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-1 text-xs font-medium uppercase",
                          STATUS_STYLES[week.status]
                        )}
                      >
                        {week.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/dashboard/${week.periodStart}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {ACTION_LABELS[week.status]}
                      </Link>
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between px-6 py-4">
        <Select
          value={String(pageSize)}
          onValueChange={(value) => {
            setPageSize(Number(value))
            setPage(1)
          }}
        >
          <SelectTrigger className="w-[130px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZES.map((size) => (
              <SelectItem key={size} value={String(size)}>
                {size} per page
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify web typechecks**

Run: `yarn workspace web exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/timesheet-list.tsx
git commit -m "Add timesheet weekly listing component"
```

---

## Task 7: Web — dashboard page renders the listing

**Files:**
- Modify (replace whole file): `apps/web/app/dashboard/page.tsx`

Replaces the Users view with the timesheet listing, keeping the existing `AuthGuard` + sidebar shell. Depends on Task 6.

- [ ] **Step 1: Replace the entire file contents**

```tsx
"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { AuthGuard } from "@/components/auth-guard";
import { TimesheetList } from "@/components/timesheet-list";
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage } from "@repo/ui/components/breadcrumb";
import { Separator } from "@repo/ui/components/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@repo/ui/components/sidebar";

/**
 * Dashboard page - protected route requiring authentication.
 * Landing view is the user's weekly timesheet listing.
 */
export default function Page() {
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
                                        <BreadcrumbPage>Timesheets</BreadcrumbPage>
                                    </BreadcrumbItem>
                                </BreadcrumbList>
                            </Breadcrumb>
                        </div>
                    </header>
                    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
                        <TimesheetList />
                    </div>
                </SidebarInset>
            </SidebarProvider>
        </AuthGuard>
    );
}
```

- [ ] **Step 2: Verify web typechecks**

Run: `yarn workspace web exec tsc --noEmit`
Expected: PASS. (The previous Users-related imports — `getUsers`, `UserResponse`, `Card`, `Avatar`, `useActionState`, etc. — are intentionally gone; `actions/user.ts` still exists and is unused, which is fine.)

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/dashboard/page.tsx
git commit -m "Render timesheet listing on dashboard"
```

---

## Task 8: Web — week detail page

**Files:**
- Create: `apps/web/app/dashboard/[weekStart]/page.tsx`

Loads `getWeekDetail(weekStart)`, owns the detail state + refetch, and renders `WeeksTimesheet`. Depends on Task 5 (component) and Task 3 (actions).

- [ ] **Step 1: Create the page**

```tsx
"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { AppSidebar } from "@/components/app-sidebar";
import { AuthGuard } from "@/components/auth-guard";
import { WeeksTimesheet } from "@/components/weeks_timesheet";
import { getWeekDetail } from "@/actions/timesheet";
import { WeekDetail } from "@/types";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator
} from "@repo/ui/components/breadcrumb";
import { Button } from "@repo/ui/components/button";
import { Separator } from "@repo/ui/components/separator";
import { Skeleton } from "@repo/ui/components/skeleton";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@repo/ui/components/sidebar";
import { toast } from "@repo/ui/components";

export default function Page({ params }: { params: Promise<{ weekStart: string }> }) {
    const { weekStart } = use(params);
    const [detail, setDetail] = useState<WeekDetail | null>(null);
    const [loading, setLoading] = useState(true);

    const load = useCallback(() => {
        setLoading(true);
        getWeekDetail(weekStart)
            .then((data) => setDetail(data))
            .catch((error) => {
                const message = error instanceof Error ? error.message : "Failed to load week";
                toast.error(message);
            })
            .finally(() => setLoading(false));
    }, [weekStart]);

    useEffect(() => {
        load();
    }, [load]);

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
                                    <BreadcrumbItem className="hidden md:block">
                                        <BreadcrumbLink href="/dashboard">Timesheets</BreadcrumbLink>
                                    </BreadcrumbItem>
                                    <BreadcrumbSeparator className="hidden md:block" />
                                    <BreadcrumbItem>
                                        <BreadcrumbPage>{weekStart}</BreadcrumbPage>
                                    </BreadcrumbItem>
                                </BreadcrumbList>
                            </Breadcrumb>
                        </div>
                    </header>
                    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
                        <div>
                            <Button asChild variant="ghost" size="sm">
                                <Link href="/dashboard">
                                    <ArrowLeftIcon className="size-4" />
                                    Back to timesheets
                                </Link>
                            </Button>
                        </div>
                        {loading || !detail ? (
                            <div className="space-y-4 rounded-xl border bg-card p-6">
                                <Skeleton className="h-8 w-64" />
                                <Skeleton className="h-4 w-40" />
                                <Skeleton className="h-40 w-full" />
                            </div>
                        ) : (
                            <WeeksTimesheet detail={detail} onChanged={load} />
                        )}
                    </div>
                </SidebarInset>
            </SidebarProvider>
        </AuthGuard>
    );
}
```

- [ ] **Step 2: Verify web typechecks**

Run: `yarn workspace web exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add "apps/web/app/dashboard/[weekStart]/page.tsx"
git commit -m "Add week detail page"
```

---

## Task 9: Web — sidebar nav link

**Files:**
- Modify: `apps/web/components/app-sidebar.tsx`

Point the first nav item at `/dashboard` and label it "Timesheets" so the sidebar links to the listing.

- [ ] **Step 1: Update the first `navMain` item**

In `apps/web/components/app-sidebar.tsx`, replace this block:

```ts
        {
            title: "Playground",
            url: "#",
            icon: SquareTerminal,
            isActive: true
        },
```

with:

```ts
        {
            title: "Timesheets",
            url: "/dashboard",
            icon: SquareTerminal,
            isActive: true
        },
```

- [ ] **Step 2: Verify web typechecks**

Run: `yarn workspace web exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/app-sidebar.tsx
git commit -m "Link sidebar to timesheets dashboard"
```

---

## Task 10: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Typecheck both workspaces**

Run: `yarn workspace web exec tsc --noEmit && yarn workspace backend exec tsc --noEmit`
Expected: PASS for both.

- [ ] **Step 2: Lint both workspaces**

Run: `yarn workspace web lint && yarn workspace backend lint`
Expected: PASS for web (0 warnings/errors). Backend may still show the 2 pre-existing `lib/email.ts` warnings (out of scope); no new warnings from `app/project/route.ts`. Fix any NEW issues surfaced (e.g. unused imports), then re-run.

- [ ] **Step 3: Confirm the new files exist**

Run: `find apps/web/app/dashboard apps/web/components/timesheet-list.tsx apps/web/actions/timesheet.ts apps/backend/app/project -type f`
Expected (order may vary):
```
apps/web/app/dashboard/page.tsx
apps/web/app/dashboard/[weekStart]/page.tsx
apps/web/components/timesheet-list.tsx
apps/web/actions/timesheet.ts
apps/backend/app/project/route.ts
```

- [ ] **Step 4 (optional, needs seeded DB + running apps): runtime smoke**

Start backend + web (`yarn dev`), log in as the seeded employee (`eve@example.com` / `password123`), then:
- `/dashboard` lists weeks (one COMPLETED, one INCOMPLETE, current week MISSING).
- Click an action → `/dashboard/<monday>` shows Mon–Fri entries + utilization bar.
- "Add new task" on a day → modal → pick project, type, description, hours → Add → row appears, totals update.
- Row "Edit" → modal prefilled → Save → row updates.
- Row "Delete" → row disappears, totals update.

---

## Self-Review (completed during planning)

- **Spec coverage:** `GET /project` → Task 1; web types → Task 2; data layer → Task 3; modal create/edit → Task 4; week detail component → Task 5; listing component → Task 6; dashboard listing route → Task 7; detail route → Task 8; sidebar link → Task 9; verification → Task 10. Non-goals (filters, manager view, task picker) are intentionally absent.
- **Type consistency:** `WeekDetail`/`WeekSummary`/`TimesheetEntry`/`DayDetail`/`Project`/`WeekStatus` (Task 2) are consumed identically in Tasks 3–8. Action signatures in Task 3 (`getWeeks`, `getWeekDetail`, `getProjects`, `createEntry`, `updateEntry`, `deleteEntry`, `EntryPayload`) match every call site. `AddEntryModal` props (`open`, `onOpenChange`, `date`, `entry`, `onSubmitted`) match the usage in Task 5. `WeeksTimesheet` props (`detail`, `onChanged`) match the usage in Task 8. The detail link `/dashboard/${periodStart}` (Task 6) matches the `[weekStart]` route param parsed in Task 8, and `periodStart` is a Monday `YYYY-MM-DD`, which API-2 requires.
- **UI primitive check:** No `Table`/`Badge` imports — the listing uses a styled `<table>` + `<span>` badge, both available via Tailwind. `Select`, `Skeleton`, `Button`, `Card`, `DropdownMenu`, `Dialog`, `Field`, `Textarea`, `Breadcrumb`, `Separator`, `Sidebar` all exist in `@repo/ui`. `size="icon-sm"` reuses the variant already present in the original `weeks_timesheet.tsx`.
- **Placeholder scan:** none — every code/command step is concrete.

## Open Assumptions (from the spec)

1. Work-type options are a small fixed frontend list; `workType` stays a free string server-side.
2. Hours entered as whole numbers, clamped `1..24`.
3. `GET /project` returns all non-deleted projects to any authenticated user.
4. Replacing the Users view on `/dashboard` is acceptable (the old users UI is removed from that page; `actions/user.ts` remains but unused there).
