import { weeksQuerySchema } from "@/common/ZodSchema";
import prisma from "@/lib/db";
import { computeWeekStatus, ensureTimesheetsForRange, parseDateOnly } from "@/lib/timesheet";
import { NextRequest, NextResponse } from "next/server";

// ─── Week helpers ─────────────────────────────────────────────────────────────

/** Returns the Monday of the ISO week containing `d` (UTC). */
function startOfISOWeek(d: Date): Date {
    const out = new Date(d);
    out.setUTCHours(0, 0, 0, 0);
    const day = out.getUTCDay();
    const offsetToMonday = (day + 6) % 7; // Sun(0)→6, Mon(1)→0 … Sat(6)→5
    out.setUTCDate(out.getUTCDate() - offsetToMonday);
    return out;
}

/** Returns the Sunday of the same ISO week as `monday`. */
function endOfISOWeek(monday: Date): Date {
    const out = new Date(monday);
    out.setUTCDate(monday.getUTCDate() + 6);
    return out;
}

function addWeeks(d: Date, weeks: number): Date {
    const out = new Date(d);
    out.setUTCDate(d.getUTCDate() + weeks * 7);
    return out;
}

// ─── Route handler ────────────────────────────────────────────────────────────

/**
 * GET /timesheet/weeks
 *
 * Returns a list of weeks between `weekStart` and `weekEnd` for the logged-in
 * employee. Both query params are optional — defaults to the past 8 weeks
 * (inclusive of the current week).
 *
 * Query params:
 *   weekStart  YYYY-MM-DD  Must be a Monday. Defaults to Mon 7 weeks ago.
 *   weekEnd    YYYY-MM-DD  Must be a Sunday. Defaults to current Sunday.
 *
 * Response shape:
 * {
 *   weeks: Array<{
 *     weekStart:           string   // "YYYY-MM-DD" (Monday)
 *     weekEnd:             string   // "YYYY-MM-DD" (Sunday)
 *     status:              "COMPLETED" | "INCOMPLETE" | "MISSING"
 *     taskCount:           number
 *     completedTaskCount:  number
 *     pendingTaskCount:    number
 *     totalLoggedHours:    number
 *     totalRegularHours:   number
 *     totalOvertimeHours:  number
 *     timesheetId:         string | null
 *   }>
 * }
 */
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
            : startOfISOWeek(addWeeks(new Date(), -7)); // Monday 7 weeks ago
        console.log("🚀 ~ GET ~ rangeStart:", rangeStart)
        const rangeEnd = parsed.data.weekEnd
            ? parseDateOnly(parsed.data.weekEnd)
            : endOfISOWeek(startOfISOWeek(new Date())); // current Sunday
        console.log("🚀 ~ GET ~ rangeEnd:", rangeEnd)

        if (rangeEnd < rangeStart) {
            return NextResponse.json(
                { error: "weekEnd must be on or after weekStart" },
                { status: 400 }
            );
        }

        // Ensure Timesheet placeholder rows exist for every week in the range
        await ensureTimesheetsForRange(userId, rangeStart, rangeEnd);

        // Build list of all Mondays in [rangeStart, rangeEnd]
        const mondays: Date[] = [];
        const cursor = new Date(rangeStart);
        while (cursor <= rangeEnd) {
            mondays.push(new Date(cursor));
            cursor.setUTCDate(cursor.getUTCDate() + 7);
        }

        // Fetch all Timesheet rows for the range (guaranteed to exist after ensureTimesheetsForRange)
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

        // Compute week summaries — one DB query per week for task status
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

                // Keep Timesheet.status in sync asynchronously — non-blocking
                if (ts && ts.status !== status) {
                    prisma.timesheet
                        .update({ where: { id: ts.id }, data: { status } })
                        .catch(() => {}); // non-critical; status is re-derived on next request
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
