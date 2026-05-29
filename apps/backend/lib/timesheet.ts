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

/** UTC midnight for today. */
export function utcToday(): Date {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export type WeekSummaryRow = {
    weekNumber: number;
    weekYear: number;
    periodStart: string;
    periodEnd: string;
    totalHours: number;
    status: WeekStatus;
    project?: { id: string; name: string };
};

/** Build dense ISO week summaries from a user's entries. */
export function buildUserWeekSummaries(
    entries: Array<{ date: Date; hours: number }>,
    weeklyCapacity: number
): WeekSummaryRow[] {
    const todayUtc = utcToday();

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

    return enumerateWeeks(isoWeekStart(minDate), isoWeekStart(maxDate))
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
                status: computeStatus(totalHours, weeklyCapacity)
            };
        })
        .sort((a, b) => (a.periodStart < b.periodStart ? 1 : -1));
}

/** Build project-scoped week summaries for managed projects (one row per project × week). */
export function buildManagedProjectWeekSummaries(
    entries: Array<{ date: Date; hours: number; projectId: string }>,
    projects: Array<{ id: string; name: string }>,
    weeklyCapacity: number
): WeekSummaryRow[] {
    const todayUtc = utcToday();
    const summaries: WeekSummaryRow[] = [];

    for (const project of projects) {
        const projectEntries = entries.filter((entry) => entry.projectId === project.id);
        if (projectEntries.length === 0) continue;

        let minDate = todayUtc;
        let maxDate = todayUtc;
        const totalsByWeek = new Map<string, number>();

        for (const entry of projectEntries) {
            if (entry.date.getTime() < minDate.getTime()) minDate = entry.date;
            if (entry.date.getTime() > maxDate.getTime()) maxDate = entry.date;
            const key = toIsoDate(isoWeekStart(entry.date));
            totalsByWeek.set(key, (totalsByWeek.get(key) ?? 0) + entry.hours);
        }

        for (const monday of enumerateWeeks(isoWeekStart(minDate), isoWeekStart(maxDate))) {
            const periodStart = toIsoDate(monday);
            const totalHours = totalsByWeek.get(periodStart) ?? 0;
            const { weekNumber, weekYear } = isoWeekParts(monday);
            summaries.push({
                weekNumber,
                weekYear,
                periodStart,
                periodEnd: toIsoDate(addUtcDays(monday, 4)),
                totalHours,
                status: computeStatus(totalHours, weeklyCapacity),
                project: { id: project.id, name: project.name }
            });
        }
    }

    if (summaries.length === 0 && projects.length > 0) {
        const monday = isoWeekStart(todayUtc);
        const { weekNumber, weekYear } = isoWeekParts(monday);
        for (const project of projects) {
            summaries.push({
                weekNumber,
                weekYear,
                periodStart: toIsoDate(monday),
                periodEnd: toIsoDate(addUtcDays(monday, 4)),
                totalHours: 0,
                status: "MISSING",
                project: { id: project.id, name: project.name }
            });
        }
    }

    return summaries.sort((a, b) => {
        if (a.periodStart !== b.periodStart) return a.periodStart < b.periodStart ? 1 : -1;
        return (a.project?.name ?? "").localeCompare(b.project?.name ?? "");
    });
}

type EntryWithRefs = TimesheetEntry & {
    project?: { id: string; name: string } | null;
    user?: {
        id: string;
        username: string;
        firstName: string | null;
        lastName: string | null;
    } | null;
};

/** Serialize a TimesheetEntry (with optional included project/user) for API output. */
export function serializeEntry(entry: EntryWithRefs, options?: { includeUser?: boolean }) {
    const serialized = {
        id: entry.id,
        date: toIsoDate(entry.date),
        hours: entry.hours,
        workType: entry.workType,
        description: entry.description,
        projectId: entry.projectId,
        project: entry.project ? { id: entry.project.id, name: entry.project.name } : null,
        createdAt: entry.createdAt.toISOString(),
        updatedAt: entry.updatedAt.toISOString()
    };

    if (options?.includeUser && entry.user) {
        return {
            ...serialized,
            user: {
                id: entry.user.id,
                username: entry.user.username,
                firstName: entry.user.firstName,
                lastName: entry.user.lastName
            }
        };
    }

    return serialized;
}

export type TargetResolution =
    | { ok: true; userId: string; weeklyCapacity: number }
    | { ok: false; status: number; message: string };

export type TimesheetReadScope =
    | { mode: "user"; userId: string; weeklyCapacity: number; view: "self"; canViewTeamTimesheets: boolean }
    | {
          mode: "managedProjects";
          managerId: string;
          projects: Array<{ id: string; name: string }>;
          weeklyCapacity: number;
          view: "manager";
          canViewTeamTimesheets: true;
      };

export type ScopeResolution = TimesheetReadScope | { ok: false; status: number; message: string };

/**
 * Resolve which timesheet data to read. Employees default to self. Managers/admins
 * default to team (managed projects) but may pass `scope=self` for their own timesheet.
 */
export async function resolveTimesheetReadScope(
    callerId: string,
    requestedUserId?: string,
    requestedProjectId?: string,
    requestedScope?: "self" | "team"
): Promise<ScopeResolution> {
    const caller = await prisma.user.findUnique({
        where: { id: callerId },
        select: { role: true, weeklyCapacity: true }
    });
    if (!caller) return { ok: false, status: 401, message: "Unauthorized" };

    const canViewTeamTimesheets = caller.role === Role.MANAGER || caller.role === Role.ADMIN;

    if (requestedUserId) {
        const target = await resolveTimesheetTarget(callerId, requestedUserId);
        if (!target.ok) return target;
        return {
            mode: "user",
            userId: target.userId,
            weeklyCapacity: target.weeklyCapacity,
            view: "self",
            canViewTeamTimesheets
        };
    }

    if (requestedScope === "self") {
        const target = await resolveTimesheetTarget(callerId);
        if (!target.ok) return target;
        return {
            mode: "user",
            userId: target.userId,
            weeklyCapacity: target.weeklyCapacity,
            view: "self",
            canViewTeamTimesheets
        };
    }

    if (caller.role === Role.MANAGER || caller.role === Role.ADMIN) {
        const projects = await prisma.project.findMany({
            where: {
                deletedAt: null,
                ...(caller.role === Role.MANAGER ? { managerId: callerId } : {})
            },
            select: { id: true, name: true },
            orderBy: { name: "asc" }
        });

        if (requestedProjectId) {
            const project = projects.find((item) => item.id === requestedProjectId);
            if (!project) {
                return { ok: false, status: 404, message: "Project not found" };
            }
            return {
                mode: "managedProjects",
                managerId: callerId,
                projects: [project],
                weeklyCapacity: caller.weeklyCapacity,
                view: "manager",
                canViewTeamTimesheets: true
            };
        }

        return {
            mode: "managedProjects",
            managerId: callerId,
            projects,
            weeklyCapacity: caller.weeklyCapacity,
            view: "manager",
            canViewTeamTimesheets: true
        };
    }

    const target = await resolveTimesheetTarget(callerId);
    if (!target.ok) return target;
    return {
        mode: "user",
        userId: target.userId,
        weeklyCapacity: target.weeklyCapacity,
        view: "self",
        canViewTeamTimesheets
    };
}

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
