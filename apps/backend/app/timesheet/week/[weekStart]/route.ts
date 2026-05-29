import { weekStartParamSchema } from "@/common/ZodSchema";
import prisma from "@/lib/db";
import { computeWeekStatus, parseDateOnly } from "@/lib/timesheet";
import { NextRequest, NextResponse } from "next/server";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Returns the Sunday of the same ISO week as `monday`. */
function endOfISOWeek(monday: Date): Date {
    const out = new Date(monday);
    out.setUTCDate(monday.getUTCDate() + 6);
    return out;
}

/**
 * GET /timesheet/week/[weekStart]
 *
 * Returns a full day-by-day breakdown of the requested ISO week for the
 * logged-in employee.
 *
 * Path param:
 *   weekStart  YYYY-MM-DD  Must be a Monday.
 *
 * Response shape:
 * {
 *   weekStart:           string
 *   weekEnd:             string
 *   status:              "COMPLETED" | "INCOMPLETE" | "MISSING"
 *   taskCount:           number
 *   completedTaskCount:  number
 *   pendingTaskCount:    number
 *   totalHours:          number
 *   regularHours:        number
 *   overtimeHours:       number
 *   timesheetId:         string | null
 *   days: Array<{
 *     date:        string       // "YYYY-MM-DD"
 *     dayOfWeek:   string       // "Monday" … "Sunday"
 *     totalHours:  number
 *     entries: Array<{
 *       entryId:     string
 *       timesheetId: string
 *       hours:       number
 *       isOvertime:  boolean
 *       startTime:   string | null
 *       endTime:     string | null
 *       description: string | null
 *       createdAt:   string
 *       updatedAt:   string
 *       task: {
 *         id:             string
 *         title:          string
 *         type:           string
 *         status:         string
 *         priority:       string
 *         estimatedHours: number | null
 *         loggedHours:    number
 *         startDate:      string | null
 *         dueDate:        string | null
 *         completedAt:    string | null
 *       }
 *       project: { id, name, color, status }
 *       createdBy: { id, firstName, lastName, profilePic }
 *       assignedBy: { id, firstName, lastName, profilePic } | null
 *     }>
 *   }>
 * }
 */
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ weekStart: string }> }
): Promise<NextResponse> {
    try {
        const userId = req.headers.get("x-user-id");
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { weekStart: weekStartParam } = await params;
        const paramValidation = weekStartParamSchema.safeParse(weekStartParam);
        if (!paramValidation.success) {
            return NextResponse.json(
                { error: paramValidation.error.flatten() },
                { status: 400 }
            );
        }

        const weekStartDate = parseDateOnly(weekStartParam);
        const weekEndDate = endOfISOWeek(weekStartDate);

        // Fetch the Timesheet period container (may be null if week was never visited)
        const timesheet = await prisma.timesheet.findUnique({
            where: { userId_periodStart: { userId, periodStart: weekStartDate } },
        });

        // Fetch all entries for this week for this user, with full task/project/user relations
        const entries = await prisma.timesheetEntry.findMany({
            where: {
                workDate: { gte: weekStartDate, lte: weekEndDate },
                timesheet: { userId },
            },
            include: {
                task: {
                    select: {
                        id: true,
                        title: true,
                        type: true,
                        status: true,
                        priority: true,
                        estimatedHours: true,
                        loggedHours: true,
                        startDate: true,
                        dueDate: true,
                        completedAt: true,
                        project: {
                            select: { id: true, name: true, color: true, status: true },
                        },
                        createdBy: {
                            select: { id: true, firstName: true, lastName: true, profilePic: true },
                        },
                        assignedBy: {
                            select: { id: true, firstName: true, lastName: true, profilePic: true },
                        },
                    },
                },
            },
            orderBy: [{ workDate: "asc" }, { createdAt: "asc" }],
        });

        // Compute week status from task due-dates
        const { status, taskCount, completedTaskCount } = await computeWeekStatus(
            userId,
            weekStartDate,
            weekEndDate
        );

        // Group entries by workDate key ("YYYY-MM-DD")
        const byDate = new Map<string, typeof entries>();
        for (const entry of entries) {
            const key = entry.workDate.toISOString().slice(0, 10);
            if (!byDate.has(key)) byDate.set(key, []);
            byDate.get(key)!.push(entry);
        }

        // Build 7-day array Mon → Sun
        const days = Array.from({ length: 7 }, (_, i) => {
            const d = new Date(weekStartDate);
            d.setUTCDate(weekStartDate.getUTCDate() + i);
            const key = d.toISOString().slice(0, 10);
            const dayEntries = byDate.get(key) ?? [];

            const dayTotalHours = dayEntries.reduce((sum, e) => sum + e.hours.toNumber(), 0);

            return {
                date: key,
                dayOfWeek: DAY_NAMES[d.getUTCDay()],
                totalHours: dayTotalHours,
                entries: dayEntries.map((e) => ({
                    entryId: e.id,
                    timesheetId: e.timesheetId,
                    hours: e.hours.toNumber(),
                    isOvertime: e.isOvertime,
                    startTime: e.startTime?.toISOString() ?? null,
                    endTime: e.endTime?.toISOString() ?? null,
                    description: e.description,
                    createdAt: e.createdAt.toISOString(),
                    updatedAt: e.updatedAt.toISOString(),
                    task: {
                        id: e.task.id,
                        title: e.task.title,
                        type: e.task.type,
                        status: e.task.status,
                        priority: e.task.priority,
                        estimatedHours: e.task.estimatedHours?.toNumber() ?? null,
                        loggedHours: e.task.loggedHours.toNumber(),
                        startDate: e.task.startDate?.toISOString().slice(0, 10) ?? null,
                        dueDate: e.task.dueDate?.toISOString().slice(0, 10) ?? null,
                        completedAt: e.task.completedAt?.toISOString() ?? null,
                    },
                    project: {
                        id: e.task.project.id,
                        name: e.task.project.name,
                        color: e.task.project.color,
                        status: e.task.project.status,
                    },
                    createdBy: {
                        id: e.task.createdBy.id,
                        firstName: e.task.createdBy.firstName,
                        lastName: e.task.createdBy.lastName,
                        profilePic: e.task.createdBy.profilePic,
                    },
                    assignedBy: e.task.assignedBy
                        ? {
                              id: e.task.assignedBy.id,
                              firstName: e.task.assignedBy.firstName,
                              lastName: e.task.assignedBy.lastName,
                              profilePic: e.task.assignedBy.profilePic,
                          }
                        : null,
                })),
            };
        });

        return NextResponse.json({
            weekStart: weekStartParam,
            weekEnd: weekEndDate.toISOString().slice(0, 10),
            status,
            taskCount,
            completedTaskCount,
            pendingTaskCount: taskCount - completedTaskCount,
            totalHours: timesheet?.totalHours.toNumber() ?? 0,
            regularHours: timesheet?.regularHours.toNumber() ?? 0,
            overtimeHours: timesheet?.overtimeHours.toNumber() ?? 0,
            timesheetId: timesheet?.id ?? null,
            days,
        });
    } catch (error) {
        console.error(error);
        if (error instanceof Error && error.message.startsWith("Invalid date")) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
