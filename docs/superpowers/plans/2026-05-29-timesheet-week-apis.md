# Timesheet Week APIs — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build timesheet APIs (weekly listing, day-by-day detail, and entry create/edit/soft-delete) over the new flat `TimesheetEntry` model, and remove the dead `Timesheet`-era code so the monorepo typechecks.

**Architecture:** Next.js App-Router `route.ts` handlers under `apps/backend/app/timesheet/`. Weeks/status are derived at read time from entries using pure, UTC-based ISO-week helpers in `apps/backend/lib/timesheet.ts`. Auth uses the `x-user-id` header injected by `proxy.ts`; reads allow a manager/admin `?userId=` override, writes are self-only.

**Tech Stack:** TypeScript, Next.js 16 (App Router), Prisma 7 (`@repo/db`), Zod.

---

## Verification Note (no test harness)

Per the spec, no vitest harness is configured (`yarn test` is a no-op). The ISO-week helpers are pure functions; this plan verifies them with a throwaway `tsx` script (created, run, then deleted) and verifies routes with `tsc --noEmit` + `lint`. Runtime/DB smoke tests against a live database are out of scope (require a migration).

Commit messages follow the repo's plain style (see `git log`: "Add ...", "yarn fix").

---

## Task 1: Fix `@repo/db` exports for the new schema

**Files:**
- Modify: `packages/db/src/index.ts`

The generated client no longer has `Timesheet`/`TimesheetStatus` after the schema change; re-exporting them breaks the build.

- [ ] **Step 1: Regenerate the Prisma client from the new schema**

Run: `yarn workspace @repo/db db:generate`
Expected: "Generated Prisma Client" success. (This rewrites `packages/db/src/generated/client` so it no longer contains `Timesheet`/`TimesheetStatus`.)

- [ ] **Step 2: Update the explicit re-exports**

Replace the entire contents of `packages/db/src/index.ts` with:

```ts
export { prisma } from "./client";

// Explicit re-exports only (no `export *`) — Turbopack rejects `export *` from Prisma’s generated CJS bundle.
export { Prisma, PrismaClient, Role, TaskStatus } from "./generated/client";
export type { ActivityLog, Project, Task, TimesheetEntry, User } from "./generated/client";
```

- [ ] **Step 3: Verify db package typechecks**

Run: `yarn workspace @repo/db exec tsc --noEmit`
Expected: PASS (no errors). Note: `seed.ts` will still error until Task 2 — that is expected; if `tsc` includes it, proceed to Task 2 and re-run after.

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/index.ts
git commit -m "Update @repo/db exports for flat timesheet model"
```

---

## Task 2: Rewrite the database seed for the flat model

**Files:**
- Modify: `packages/db/src/seed.ts`

The old seed creates `Timesheet` rows with `sequenceNumber`/`workDate`/`isOvertime`. The new `TimesheetEntry` requires `projectId`, `date`, `hours`, `workType`, `description`, so the seed must also create a project (owned by a manager).

- [ ] **Step 1: Replace the seed with the flat-model version**

Replace the entire contents of `packages/db/src/seed.ts` with:

```ts
/* eslint-disable */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma, Role } from "./index.js";

const DEFAULT_PASSWORD = process.env.DEFAULT_PASSWORD ?? "password123";

function startOfDayUTC(d: Date): Date {
    const out = new Date(d);
    out.setUTCHours(0, 0, 0, 0);
    return out;
}

function mondayOfWeeksAgo(weeksAgo: number): Date {
    const now = startOfDayUTC(new Date());
    const dayOfWeek = now.getUTCDay();
    const offsetToMonday = (dayOfWeek + 6) % 7;
    const thisMonday = new Date(now);
    thisMonday.setUTCDate(now.getUTCDate() - offsetToMonday);
    const target = new Date(thisMonday);
    target.setUTCDate(thisMonday.getUTCDate() - weeksAgo * 7);
    return target;
}

function addDays(d: Date, days: number): Date {
    const out = new Date(d);
    out.setUTCDate(out.getUTCDate() + days);
    return out;
}

async function main() {
    console.log("Seeding database...");

    const managerPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);
    const manager = await prisma.user.create({
        data: {
            email: "dave@example.com",
            username: "dave",
            firstName: "Dave",
            lastName: "Brown",
            role: Role.MANAGER,
            password: managerPassword,
            emailVerified: new Date()
        }
    });
    console.log(`Created manager: ${manager.username}`);

    const employeePassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);
    const employee = await prisma.user.create({
        data: {
            email: "eve@example.com",
            username: "eve",
            firstName: "Eve",
            lastName: "Davis",
            role: Role.EMPLOYEE,
            password: employeePassword,
            emailVerified: new Date()
        }
    });
    console.log(`Created employee: ${employee.username}`);

    const project = await prisma.project.create({
        data: {
            name: "Homepage Redesign",
            description: "Marketing site revamp",
            managerId: manager.id
        }
    });
    console.log(`Created project: ${project.name}`);

    await prisma.activityLog.createMany({
        data: [
            { userId: manager.id, type: "LOGIN", description: "User logged in" },
            { userId: employee.id, type: "TIMESHEET", description: "Logged weekly time" }
        ]
    });

    // COMPLETED week (40h, two weeks ago, Mon-Fri @ 8h).
    const completedMonday = mondayOfWeeksAgo(2);
    await prisma.timesheetEntry.createMany({
        data: [0, 1, 2, 3, 4].map((dayOffset) => ({
            userId: employee.id,
            projectId: project.id,
            date: addDays(completedMonday, dayOffset),
            hours: 8,
            workType: "Development",
            description: "Homepage Development"
        }))
    });

    // INCOMPLETE week (17h, last week, Mon + Tue only).
    const lastWeekMonday = mondayOfWeeksAgo(1);
    await prisma.timesheetEntry.createMany({
        data: [
            {
                userId: employee.id,
                projectId: project.id,
                date: lastWeekMonday,
                hours: 8,
                workType: "Development",
                description: "Homepage Development"
            },
            {
                userId: employee.id,
                projectId: project.id,
                date: addDays(lastWeekMonday, 1),
                hours: 8,
                workType: "Development",
                description: "Homepage Development"
            },
            {
                userId: employee.id,
                projectId: project.id,
                date: addDays(lastWeekMonday, 1),
                hours: 1,
                workType: "Bug fixes",
                description: "Late ticket fix"
            }
        ]
    });

    console.log("\n############# Login details #############");
    console.log(`  username: dave  |  email: dave@example.com  |  password: ${DEFAULT_PASSWORD}`);
    console.log(`  username: eve   |  email: eve@example.com   |  password: ${DEFAULT_PASSWORD}`);
    console.log("########################################\n");
    console.log("Seed completed.");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
```

- [ ] **Step 2: Verify the db package typechecks**

Run: `yarn workspace @repo/db exec tsc --noEmit`
Expected: PASS (no errors).

- [ ] **Step 3: Commit**

```bash
git add packages/db/src/seed.ts
git commit -m "Rewrite seed for flat timesheet entry model"
```

---

## Task 3: Rewrite timesheet helpers (`lib/timesheet.ts`)

**Files:**
- Modify (replace whole file): `apps/backend/lib/timesheet.ts`

Pure, UTC-based ISO-week helpers + entry serializer + the shared access resolver.

- [ ] **Step 1: Replace the entire file contents**

```ts
import prisma from "@/lib/db";
import { Role, TimesheetEntry } from "@repo/db";

const MS_PER_DAY = 86_400_000;

/** Parse a `YYYY-MM-DD` string into a UTC-midnight Date. Throws on invalid input. */
export function parseDateOnly(value: string): Date {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) {
        throw new Error("Invalid date format. Expected YYYY-MM-DD.");
    }
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
        throw new Error("Invalid date value.");
    }
    return date;
}

/** UTC `YYYY-MM-DD` string for a Date. */
export function toIsoDate(date: Date): string {
    return date.toISOString().slice(0, 10);
}

/** Add whole days in UTC. */
export function addUtcDays(date: Date, days: number): Date {
    return new Date(date.getTime() + days * MS_PER_DAY);
}

/** Monday (UTC midnight) of the ISO week that contains `date`. */
export function isoWeekStart(date: Date): Date {
    const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const dow = d.getUTCDay(); // 0=Sun..6=Sat
    const sinceMonday = (dow + 6) % 7;
    return addUtcDays(d, -sinceMonday);
}

/** ISO 8601 week number (1..53) and week-numbering year. */
export function isoWeekParts(date: Date): { weekNumber: number; weekYear: number } {
    const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const dayNum = (d.getUTCDay() + 6) % 7; // Mon=0..Sun=6
    // Shift to the Thursday of this week; its calendar year is the ISO week-year.
    d.setUTCDate(d.getUTCDate() - dayNum + 3);
    const weekYear = d.getUTCFullYear();
    const firstThursday = new Date(Date.UTC(weekYear, 0, 4));
    const firstThursdayDayNum = (firstThursday.getUTCDay() + 6) % 7;
    firstThursday.setUTCDate(firstThursday.getUTCDate() - firstThursdayDayNum + 3);
    const weekNumber = 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * MS_PER_DAY));
    return { weekNumber, weekYear };
}

/** Inclusive list of Mondays from `startMonday` to `endMonday`, stepping one week. */
export function enumerateWeeks(startMonday: Date, endMonday: Date): Date[] {
    const weeks: Date[] = [];
    for (let cur = startMonday; cur.getTime() <= endMonday.getTime(); cur = addUtcDays(cur, 7)) {
        weeks.push(cur);
    }
    return weeks;
}

export type WeekStatus = "MISSING" | "INCOMPLETE" | "COMPLETED";

/** Derive a week's status from its total hours and the user's weekly capacity. */
export function computeStatus(totalHours: number, capacity: number): WeekStatus {
    if (totalHours <= 0) return "MISSING";
    if (totalHours < capacity) return "INCOMPLETE";
    return "COMPLETED";
}

type EntryWithRefs = TimesheetEntry & {
    project?: { id: string; name: string } | null;
    task?: { id: string; title: string } | null;
};

/** Serialize a TimesheetEntry (with optional included project/task) for API output. */
export function serializeEntry(entry: EntryWithRefs) {
    return {
        id: entry.id,
        date: toIsoDate(entry.date),
        hours: entry.hours,
        workType: entry.workType,
        description: entry.description,
        projectId: entry.projectId,
        taskId: entry.taskId,
        project: entry.project ? { id: entry.project.id, name: entry.project.name } : null,
        task: entry.task ? { id: entry.task.id, title: entry.task.title } : null,
        createdAt: entry.createdAt.toISOString(),
        updatedAt: entry.updatedAt.toISOString()
    };
}

export type TargetResolution =
    | { ok: true; userId: string; weeklyCapacity: number }
    | { ok: false; status: number; message: string };

/**
 * Resolve which user's timesheet to read. Defaults to the caller. A different
 * `requestedUserId` is allowed only for MANAGER/ADMIN callers.
 */
export async function resolveTimesheetTarget(
    callerId: string,
    requestedUserId?: string
): Promise<TargetResolution> {
    const targetId = requestedUserId ?? callerId;

    if (targetId !== callerId) {
        const caller = await prisma.user.findUnique({
            where: { id: callerId },
            select: { role: true }
        });
        if (!caller) return { ok: false, status: 401, message: "Unauthorized" };
        if (caller.role !== Role.MANAGER && caller.role !== Role.ADMIN) {
            return { ok: false, status: 403, message: "Forbidden" };
        }
    }

    const target = await prisma.user.findFirst({
        where: { id: targetId, isDeleted: false },
        select: { id: true, weeklyCapacity: true }
    });
    if (!target) return { ok: false, status: 404, message: "User not found" };

    return { ok: true, userId: target.id, weeklyCapacity: target.weeklyCapacity };
}
```

- [ ] **Step 2: Verify pure helpers with a throwaway tsx script**

Create `apps/backend/scripts/verify-timesheet-helpers.mts`:

```ts
import assert from "node:assert";
import { addUtcDays, computeStatus, enumerateWeeks, isoWeekParts, isoWeekStart, parseDateOnly, toIsoDate } from "../lib/timesheet";

// isoWeekStart: Wed 2024-01-24 -> Mon 2024-01-22
assert.equal(toIsoDate(isoWeekStart(parseDateOnly("2024-01-24"))), "2024-01-22");
// Monday maps to itself.
assert.equal(toIsoDate(isoWeekStart(parseDateOnly("2024-01-22"))), "2024-01-22");
// Sunday belongs to the week that started the previous Monday.
assert.equal(toIsoDate(isoWeekStart(parseDateOnly("2024-01-28"))), "2024-01-22");

// isoWeekParts: 2024-01-01 (Mon) is ISO week 1 of 2024.
assert.deepEqual(isoWeekParts(parseDateOnly("2024-01-01")), { weekNumber: 1, weekYear: 2024 });
// 2024-01-22 (Mon) is ISO week 4 of 2024.
assert.deepEqual(isoWeekParts(parseDateOnly("2024-01-22")), { weekNumber: 4, weekYear: 2024 });
// Year boundary: 2021-01-01 (Fri) belongs to ISO week 53 of 2020.
assert.deepEqual(isoWeekParts(parseDateOnly("2021-01-01")), { weekNumber: 53, weekYear: 2020 });

// enumerateWeeks: inclusive Mondays.
const weeks = enumerateWeeks(parseDateOnly("2024-01-01"), parseDateOnly("2024-01-22"));
assert.deepEqual(weeks.map(toIsoDate), ["2024-01-01", "2024-01-08", "2024-01-15", "2024-01-22"]);

// computeStatus thresholds (capacity 40).
assert.equal(computeStatus(0, 40), "MISSING");
assert.equal(computeStatus(17, 40), "INCOMPLETE");
assert.equal(computeStatus(40, 40), "COMPLETED");
assert.equal(computeStatus(45, 40), "COMPLETED");

// addUtcDays / Friday of a week.
assert.equal(toIsoDate(addUtcDays(parseDateOnly("2024-01-22"), 4)), "2024-01-26");

console.log("All timesheet helper assertions passed.");
```

- [ ] **Step 3: Run the verification script**

Run: `yarn workspace backend exec tsx scripts/verify-timesheet-helpers.mts`
Expected: prints `All timesheet helper assertions passed.` and exits 0.

- [ ] **Step 4: Delete the throwaway script**

Run: `rm apps/backend/scripts/verify-timesheet-helpers.mts`
(If `apps/backend/scripts/` is now empty, remove it: `rmdir apps/backend/scripts 2>/dev/null || true`.)

- [ ] **Step 5: Commit**

```bash
git add apps/backend/lib/timesheet.ts
git commit -m "Rewrite timesheet helpers for derived ISO weeks"
```

---

## Task 4: Replace timesheet Zod schemas

**Files:**
- Modify: `apps/backend/common/ZodSchema.ts`

- [ ] **Step 1: Remove the stale `TimesheetStatus` import**

Change line 1 from:

```ts
import { TimesheetStatus } from "@repo/db";
import { z } from "zod";
```

to:

```ts
import { z } from "zod";
```

- [ ] **Step 2: Replace the four old timesheet schemas**

Delete the existing `createTimesheetSchema`, `updateTimesheetSchema`, `createTimesheetEntrySchema`, and `updateTimesheetEntrySchema` blocks (everything from `export const createTimesheetSchema = ...` to the end of `updateTimesheetEntrySchema`). Keep the existing `const isoDateSchema = ...` line. Append in their place:

```ts
export const weeksQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(10),
    userId: z.string().min(1).optional()
});

export const weekDetailQuerySchema = z.object({
    userId: z.string().min(1).optional()
});

export const createEntrySchema = z.object({
    date: isoDateSchema,
    projectId: z.string().min(1),
    workType: z.string().min(1),
    description: z.string().min(1),
    hours: z.number().positive().max(24),
    taskId: z.string().min(1).optional()
});

export const updateEntrySchema = z
    .object({
        date: isoDateSchema.optional(),
        projectId: z.string().min(1).optional(),
        workType: z.string().min(1).optional(),
        description: z.string().min(1).optional(),
        hours: z.number().positive().max(24).optional(),
        taskId: z.string().min(1).nullable().optional()
    })
    .refine((data) => Object.keys(data).length > 0, {
        message: "At least one field is required"
    });
```

- [ ] **Step 3: Verify backend typechecks so far**

Run: `yarn workspace backend exec tsc --noEmit`
Expected: PASS (no errors). (Routes added next will also typecheck.)

- [ ] **Step 4: Commit**

```bash
git add apps/backend/common/ZodSchema.ts
git commit -m "Replace timesheet Zod schemas for new API surface"
```

---

## Task 5: API-1 — `GET /timesheet/weeks` (weekly listing)

**Files:**
- Create: `apps/backend/app/timesheet/weeks/route.ts`

- [ ] **Step 1: Create the route**

```ts
import prisma from "@/lib/db";
import { weeksQuerySchema } from "@/common/ZodSchema";
import {
    addUtcDays,
    computeStatus,
    enumerateWeeks,
    isoWeekParts,
    isoWeekStart,
    resolveTimesheetTarget,
    toIsoDate
} from "@/lib/timesheet";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
    try {
        const callerId = req.headers.get("x-user-id");
        if (!callerId) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const parsed = weeksQuerySchema.safeParse({
            page: searchParams.get("page") ?? undefined,
            pageSize: searchParams.get("pageSize") ?? undefined,
            userId: searchParams.get("userId") ?? undefined
        });
        if (!parsed.success) {
            return NextResponse.json({ message: "Invalid query", errors: parsed.error.flatten() }, { status: 400 });
        }

        const { page, pageSize, userId } = parsed.data;
        const target = await resolveTimesheetTarget(callerId, userId);
        if (!target.ok) {
            return NextResponse.json({ message: target.message }, { status: target.status });
        }

        const entries = await prisma.timesheetEntry.findMany({
            where: { userId: target.userId, deletedAt: null },
            select: { date: true, hours: true }
        });

        const now = new Date();
        const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

        let minDate = todayUtc;
        let maxDate = todayUtc;
        for (const entry of entries) {
            if (entry.date.getTime() < minDate.getTime()) minDate = entry.date;
            if (entry.date.getTime() > maxDate.getTime()) maxDate = entry.date;
        }

        const totalsByWeek = new Map<string, number>();
        for (const entry of entries) {
            const key = toIsoDate(isoWeekStart(entry.date));
            totalsByWeek.set(key, (totalsByWeek.get(key) ?? 0) + entry.hours);
        }

        const allWeeks = enumerateWeeks(isoWeekStart(minDate), isoWeekStart(maxDate))
            .map((monday) => {
                const periodStart = toIsoDate(monday);
                const totalHours = totalsByWeek.get(periodStart) ?? 0;
                const { weekNumber, weekYear } = isoWeekParts(monday);
                return {
                    weekNumber,
                    weekYear,
                    periodStart,
                    periodEnd: toIsoDate(addUtcDays(monday, 4)),
                    totalHours,
                    status: computeStatus(totalHours, target.weeklyCapacity)
                };
            })
            .sort((a, b) => (a.periodStart < b.periodStart ? 1 : -1));

        const total = allWeeks.length;
        const startIdx = (page - 1) * pageSize;
        const weeks = allWeeks.slice(startIdx, startIdx + pageSize);

        return NextResponse.json({ weeks, page, pageSize, total }, { status: 200 });
    } catch (error) {
        console.log("🚀 ~ GET /timesheet/weeks ~ error:", error);
        return NextResponse.json({ message: "Error fetching weeks" }, { status: 500 });
    }
}
```

- [ ] **Step 2: Verify backend typechecks**

Run: `yarn workspace backend exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/backend/app/timesheet/weeks/route.ts
git commit -m "Add GET /timesheet/weeks weekly listing API"
```

---

## Task 6: API-2 — `GET /timesheet/weeks/[weekStart]` (day-by-day detail)

**Files:**
- Create: `apps/backend/app/timesheet/weeks/[weekStart]/route.ts`

- [ ] **Step 1: Create the route**

```ts
import prisma from "@/lib/db";
import { weekDetailQuerySchema } from "@/common/ZodSchema";
import {
    addUtcDays,
    computeStatus,
    isoWeekParts,
    isoWeekStart,
    parseDateOnly,
    resolveTimesheetTarget,
    serializeEntry,
    toIsoDate
} from "@/lib/timesheet";
import { NextRequest, NextResponse } from "next/server";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

export async function GET(req: NextRequest, { params }: { params: Promise<{ weekStart: string }> }) {
    try {
        const callerId = req.headers.get("x-user-id");
        if (!callerId) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const { weekStart } = await params;
        let monday: Date;
        try {
            monday = parseDateOnly(weekStart);
        } catch {
            return NextResponse.json({ message: "Invalid weekStart. Expected YYYY-MM-DD." }, { status: 400 });
        }
        if (isoWeekStart(monday).getTime() !== monday.getTime()) {
            return NextResponse.json({ message: "weekStart must be a Monday." }, { status: 400 });
        }

        const { searchParams } = new URL(req.url);
        const parsed = weekDetailQuerySchema.safeParse({ userId: searchParams.get("userId") ?? undefined });
        if (!parsed.success) {
            return NextResponse.json({ message: "Invalid query", errors: parsed.error.flatten() }, { status: 400 });
        }

        const target = await resolveTimesheetTarget(callerId, parsed.data.userId);
        if (!target.ok) {
            return NextResponse.json({ message: target.message }, { status: target.status });
        }

        const sunday = addUtcDays(monday, 6);
        const entries = await prisma.timesheetEntry.findMany({
            where: { userId: target.userId, deletedAt: null, date: { gte: monday, lte: sunday } },
            include: {
                project: { select: { id: true, name: true } },
                task: { select: { id: true, title: true } }
            },
            orderBy: { createdAt: "asc" }
        });

        let totalHours = 0;
        for (const entry of entries) {
            totalHours += entry.hours;
        }

        const days = DAY_LABELS.map((dayLabel, index) => {
            const dayIso = toIsoDate(addUtcDays(monday, index));
            const dayEntries = entries.filter((entry) => toIsoDate(entry.date) === dayIso);
            return {
                date: dayIso,
                dayLabel,
                totalHours: dayEntries.reduce((sum, entry) => sum + entry.hours, 0),
                entries: dayEntries.map(serializeEntry)
            };
        });

        const { weekNumber, weekYear } = isoWeekParts(monday);
        const capacity = target.weeklyCapacity;
        const utilization = capacity > 0 ? Math.round((totalHours / capacity) * 100) : 0;

        return NextResponse.json(
            {
                weekNumber,
                weekYear,
                periodStart: toIsoDate(monday),
                periodEnd: toIsoDate(addUtcDays(monday, 4)),
                totalHours,
                capacity,
                utilization,
                status: computeStatus(totalHours, capacity),
                days
            },
            { status: 200 }
        );
    } catch (error) {
        console.log("🚀 ~ GET /timesheet/weeks/[weekStart] ~ error:", error);
        return NextResponse.json({ message: "Error fetching week details" }, { status: 500 });
    }
}
```

- [ ] **Step 2: Verify backend typechecks**

Run: `yarn workspace backend exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/backend/app/timesheet/weeks/[weekStart]/route.ts
git commit -m "Add GET /timesheet/weeks/[weekStart] detail API"
```

---

## Task 7: Create entry — `POST /timesheet/entries`

**Files:**
- Create: `apps/backend/app/timesheet/entries/route.ts`

- [ ] **Step 1: Create the route**

```ts
import prisma from "@/lib/db";
import { createEntrySchema } from "@/common/ZodSchema";
import { parseDateOnly, serializeEntry } from "@/lib/timesheet";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    try {
        const callerId = req.headers.get("x-user-id");
        if (!callerId) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json().catch(() => null);
        const parsed = createEntrySchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ message: "Invalid body", errors: parsed.error.flatten() }, { status: 400 });
        }

        const { date, projectId, workType, description, hours, taskId } = parsed.data;

        const project = await prisma.project.findFirst({
            where: { id: projectId, deletedAt: null },
            select: { id: true }
        });
        if (!project) {
            return NextResponse.json({ message: "Project not found" }, { status: 400 });
        }

        if (taskId) {
            const task = await prisma.task.findFirst({
                where: { id: taskId, deletedAt: null },
                select: { projectId: true }
            });
            if (!task) {
                return NextResponse.json({ message: "Task not found" }, { status: 400 });
            }
            if (task.projectId !== projectId) {
                return NextResponse.json({ message: "Task does not belong to project" }, { status: 400 });
            }
        }

        const created = await prisma.timesheetEntry.create({
            data: {
                userId: callerId,
                date: parseDateOnly(date),
                hours,
                workType,
                description,
                projectId,
                taskId: taskId ?? null
            },
            include: {
                project: { select: { id: true, name: true } },
                task: { select: { id: true, title: true } }
            }
        });

        return NextResponse.json({ entry: serializeEntry(created) }, { status: 201 });
    } catch (error) {
        console.log("🚀 ~ POST /timesheet/entries ~ error:", error);
        return NextResponse.json({ message: "Error creating entry" }, { status: 500 });
    }
}
```

- [ ] **Step 2: Verify backend typechecks**

Run: `yarn workspace backend exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/backend/app/timesheet/entries/route.ts
git commit -m "Add POST /timesheet/entries create API"
```

---

## Task 8: Edit + soft-delete entry — `/timesheet/entries/[entryId]`

**Files:**
- Create: `apps/backend/app/timesheet/entries/[entryId]/route.ts`

- [ ] **Step 1: Create the route (PATCH + DELETE)**

```ts
import prisma from "@/lib/db";
import { updateEntrySchema } from "@/common/ZodSchema";
import { parseDateOnly, serializeEntry } from "@/lib/timesheet";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ entryId: string }> }) {
    try {
        const callerId = req.headers.get("x-user-id");
        if (!callerId) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const { entryId } = await params;
        const body = await req.json().catch(() => null);
        const parsed = updateEntrySchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ message: "Invalid body", errors: parsed.error.flatten() }, { status: 400 });
        }

        const existing = await prisma.timesheetEntry.findFirst({
            where: { id: entryId, userId: callerId, deletedAt: null },
            select: { id: true, projectId: true, taskId: true }
        });
        if (!existing) {
            return NextResponse.json({ message: "Entry not found" }, { status: 404 });
        }

        const data = parsed.data;
        const nextProjectId = data.projectId ?? existing.projectId;

        if (data.projectId) {
            const project = await prisma.project.findFirst({
                where: { id: data.projectId, deletedAt: null },
                select: { id: true }
            });
            if (!project) {
                return NextResponse.json({ message: "Project not found" }, { status: 400 });
            }
        }

        // Validate the EFFECTIVE task against the EFFECTIVE project whenever either
        // changes — this prevents a project change (without resending taskId) from
        // leaving a retained task linked to the old project.
        const nextTaskId = data.taskId !== undefined ? data.taskId : existing.taskId;
        const projectChanging = data.projectId !== undefined;
        const taskChanging = data.taskId !== undefined;

        if (nextTaskId && (projectChanging || taskChanging)) {
            const task = await prisma.task.findFirst({
                where: { id: nextTaskId, deletedAt: null },
                select: { projectId: true }
            });
            if (!task) {
                return NextResponse.json({ message: "Task not found" }, { status: 400 });
            }
            if (task.projectId !== nextProjectId) {
                return NextResponse.json({ message: "Task does not belong to project" }, { status: 400 });
            }
        }

        const updated = await prisma.timesheetEntry.update({
            where: { id: entryId },
            data: {
                ...(data.date !== undefined ? { date: parseDateOnly(data.date) } : {}),
                ...(data.projectId !== undefined ? { projectId: data.projectId } : {}),
                ...(data.workType !== undefined ? { workType: data.workType } : {}),
                ...(data.description !== undefined ? { description: data.description } : {}),
                ...(data.hours !== undefined ? { hours: data.hours } : {}),
                ...(data.taskId !== undefined ? { taskId: data.taskId } : {})
            },
            include: {
                project: { select: { id: true, name: true } },
                task: { select: { id: true, title: true } }
            }
        });

        return NextResponse.json({ entry: serializeEntry(updated) }, { status: 200 });
    } catch (error) {
        console.log("🚀 ~ PATCH /timesheet/entries/[entryId] ~ error:", error);
        return NextResponse.json({ message: "Error updating entry" }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ entryId: string }> }) {
    try {
        const callerId = req.headers.get("x-user-id");
        if (!callerId) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const { entryId } = await params;
        const existing = await prisma.timesheetEntry.findFirst({
            where: { id: entryId, userId: callerId, deletedAt: null },
            select: { id: true }
        });
        if (!existing) {
            return NextResponse.json({ message: "Entry not found" }, { status: 404 });
        }

        await prisma.timesheetEntry.update({
            where: { id: entryId },
            data: { deletedAt: new Date() }
        });

        return NextResponse.json({ success: true, id: entryId }, { status: 200 });
    } catch (error) {
        console.log("🚀 ~ DELETE /timesheet/entries/[entryId] ~ error:", error);
        return NextResponse.json({ message: "Error deleting entry" }, { status: 500 });
    }
}
```

- [ ] **Step 2: Verify backend typechecks**

Run: `yarn workspace backend exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/backend/app/timesheet/entries/[entryId]/route.ts
git commit -m "Add PATCH/DELETE /timesheet/entries/[entryId] API"
```

---

## Task 9: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Typecheck both workspaces**

Run: `yarn workspace backend exec tsc --noEmit && yarn workspace @repo/db exec tsc --noEmit`
Expected: PASS for both.

- [ ] **Step 2: Lint both workspaces**

Run: `yarn workspace backend lint && yarn workspace @repo/db lint`
Expected: PASS (0 warnings/errors). Fix any issues surfaced (e.g., unused imports), then re-run.

- [ ] **Step 3: Confirm no lingering references to the removed model**

Run: `rg -n "TimesheetStatus|prisma\.timesheet\b|sequenceNumber|isOvertime|workDate" apps packages --glob '!**/generated/**'`
Expected: no matches in `apps/` or `packages/src` source (matches only acceptable in `docs/` are out of scope).

- [ ] **Step 4: Confirm the four routes exist**

Run: `find apps/backend/app/timesheet -type f`
Expected:
```
apps/backend/app/timesheet/weeks/route.ts
apps/backend/app/timesheet/weeks/[weekStart]/route.ts
apps/backend/app/timesheet/entries/route.ts
apps/backend/app/timesheet/entries/[entryId]/route.ts
```

---

## As-Built Verification Notes

- **Backend `tsc --noEmit`:** exit 0, clean (after clearing the stale `.next/types` cache once, which referenced the deleted old routes).
- **db verification gate is `lint`** (ignores `src/generated`). Raw `tsc --noEmit` over the db package surfaces `TS9006/TS4094` declaration-emit errors that live ONLY in the gitignored, auto-generated Prisma v7 client (schema-independent toolchain artifact); the db package has no `tsc` build step, so `lint` is the meaningful gate. db `lint` passes.
- **Backend `lint`** still reports 2 PRE-EXISTING warnings in `apps/backend/lib/email.ts` (`no-constant-condition`, undeclared `RESEND_API_KEY`) — that file was last changed in `61d091a`, before this work, and is out of scope. The new timesheet files contribute zero lint output.
- **Task 3 helper verification:** the `.mts` tsx script from the plan hits a tsx@4.19.1 + Node 26 ESM↔CJS named-export interop issue (backend is CommonJS). The identical assertions were verified via tsx's require interop and all pass. Prefer an inline `node:test`/CJS approach if re-verifying.
- **Task 8 PATCH** includes a follow-up fix (commit `30ddfd3`): validate the effective task against the effective project so a project change without resending `taskId` can't orphan the task link.

## Self-Review (completed during planning)

- **Spec coverage:** API-1 → Task 5; API-2 → Task 6; create → Task 7; edit/soft-delete → Task 8; dead-code cleanup → Tasks 1–4; verification → Task 9. ISO-week/status/scope rules implemented in Task 3 helpers and consumed by routes.
- **Type consistency:** `resolveTimesheetTarget` returns `{ ok, userId, weeklyCapacity }`/`{ ok:false, status, message }` and is used identically in Tasks 5–6. `serializeEntry` shape matches API-2's `entries[]` and create/edit responses. `computeStatus`/`isoWeekParts`/`isoWeekStart`/`enumerateWeeks`/`addUtcDays`/`toIsoDate`/`parseDateOnly` signatures match all call sites. Route param type `{ params: Promise<{...}> }` matches the repo's existing convention.
- **Placeholder scan:** none — every code/command step is concrete.

## Open Assumptions (from the spec)

1. Per-entry hours cap = 24; weekly capacity drives status only.
2. Writes are self-only (no manager write-through).
3. `totalHours`/`status` aggregate Mon–Sun; `days[]` lists Mon–Fri.
