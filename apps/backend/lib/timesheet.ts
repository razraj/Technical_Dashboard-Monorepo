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
