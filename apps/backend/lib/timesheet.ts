import prisma from "@/lib/db";
import { Prisma, TimesheetStatus, TaskStatus, Timesheet, TimesheetEntry } from "@repo/db";

type TransactionClient = Prisma.TransactionClient;

// Serialized shapes — plain objects the API returns over the wire (all Decimals → number, Dates → ISO string).
export type SerializedTimesheetEntry = {
    id: string;
    timesheetId: string;
    taskId: string;
    workDate: string;
    hours: number;
    startTime: string | null;
    endTime: string | null;
    isOvertime: boolean;
    description: string | null;
    createdAt: string;
    updatedAt: string;
};

export type SerializedTimesheet = {
    id: string;
    userId: string;
    sequenceNumber: number;
    status: TimesheetStatus;
    title: string;
    notes: string | null;
    periodStart: string;
    periodEnd: string;
    totalHours: number;
    regularHours: number;
    overtimeHours: number;
    submittedAt: string | null;
    createdAt: string;
    updatedAt: string;
    entries?: SerializedTimesheetEntry[];
};

export function parseDateOnly(value: string): Date {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) throw new Error("Invalid date format. Expected YYYY-MM-DD.");
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
        throw new Error("Invalid date value.");
    }
    return date;
}

export function parseOptionalDateTime(value: string | undefined): Date | undefined {
    if (value === undefined) return undefined;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new Error("Invalid datetime value.");
    return date;
}

function decimalToNumber(value: Prisma.Decimal): number {
    return value.toNumber();
}

export function serializeTimesheetEntry(entry: TimesheetEntry): SerializedTimesheetEntry {
    return {
        id: entry.id,
        timesheetId: entry.timesheetId,
        taskId: entry.taskId,
        workDate: entry.workDate.toISOString().slice(0, 10),
        hours: decimalToNumber(entry.hours),
        startTime: entry.startTime?.toISOString() ?? null,
        endTime: entry.endTime?.toISOString() ?? null,
        isOvertime: entry.isOvertime,
        description: entry.description,
        createdAt: entry.createdAt.toISOString(),
        updatedAt: entry.updatedAt.toISOString(),
    };
}

export function serializeTimesheet(timesheet: Timesheet & { entries?: TimesheetEntry[] }): SerializedTimesheet {
    return {
        id: timesheet.id,
        userId: timesheet.userId,
        sequenceNumber: timesheet.sequenceNumber,
        status: timesheet.status,
        title: timesheet.title,
        notes: timesheet.notes,
        // Return date-only strings — periodStart/periodEnd are stored as DATE (no time component).
        periodStart: timesheet.periodStart.toISOString().slice(0, 10),
        periodEnd: timesheet.periodEnd.toISOString().slice(0, 10),
        // Convert Decimal to number for clean JSON serialization.
        totalHours: decimalToNumber(timesheet.totalHours),
        regularHours: decimalToNumber(timesheet.regularHours),
        overtimeHours: decimalToNumber(timesheet.overtimeHours),
        // submittedAt is nullable — preserve null rather than constructing Invalid Date.
        submittedAt: timesheet.submittedAt?.toISOString() ?? null,
        createdAt: timesheet.createdAt.toISOString(),
        updatedAt: timesheet.updatedAt.toISOString(),
        ...(timesheet.entries ? { entries: timesheet.entries.map(serializeTimesheetEntry) } : {}),
    };
}

/**
 * Recomputes totalHours, regularHours, and overtimeHours for a timesheet
 * using a single database-side aggregation query instead of fetching every row.
 */
export async function recomputeRollups(timesheetId: string, tx: TransactionClient): Promise<Timesheet> {
    // Group by isOvertime flag — DB computes the sums, no per-row data transfer.
    const groups = await tx.timesheetEntry.groupBy({
        by: ["isOvertime"],
        where: { timesheetId },
        _sum: { hours: true },
    });

    const zero = new Prisma.Decimal(0);
    const overtimeHours = groups.find((g) => g.isOvertime)?._sum.hours ?? zero;
    const regularHours = groups.find((g) => !g.isOvertime)?._sum.hours ?? zero;
    const totalHours = new Prisma.Decimal(overtimeHours).add(regularHours);

    return tx.timesheet.update({
        where: { id: timesheetId },
        data: { totalHours, regularHours, overtimeHours },
    });
}

async function nextSequenceNumber(userId: string, tx: TransactionClient): Promise<number> {
    const last = await tx.timesheet.findFirst({
        where: { userId },
        orderBy: { sequenceNumber: "desc" },
        select: { sequenceNumber: true },
    });
    return (last?.sequenceNumber ?? 0) + 1;
}

export async function createTimesheetForUser(
    userId: string,
    data: {
        title: string;
        notes?: string | null;
        periodStart: Date;
        periodEnd: Date;
        status?: TimesheetStatus;
    }
): Promise<Timesheet> {
    const MAX_RETRIES = 2;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
            return await prisma.$transaction(
                async (tx) => {
                    const sequenceNumber = await nextSequenceNumber(userId, tx);
                    return tx.timesheet.create({
                        data: {
                            userId,
                            sequenceNumber,
                            title: data.title,
                            notes: data.notes ?? null,
                            periodStart: data.periodStart,
                            periodEnd: data.periodEnd,
                            status: data.status ?? TimesheetStatus.MISSING,
                        },
                    });
                },
                // RepeatableRead prevents phantom reads on the sequenceNumber
                // query: two concurrent creates won't both see the same max value.
                // P2002 retry below handles the residual race on commit.
                { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead }
            );
        } catch (error) {
            if (
                attempt < MAX_RETRIES - 1 &&
                error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === "P2002"
            ) {
                continue;
            }
            throw error;
        }
    }

    throw new Error("Failed to assign timesheet sequence number after retries.");
}

/**
 * Derives the TimesheetStatus for a given user+week from task due-dates.
 *
 * Rules:
 *   MISSING     — no non-deleted tasks assigned to user with dueDate in [weekStart, weekEnd]
 *   COMPLETED   — all such tasks have status DONE
 *   INCOMPLETE  — at least one such task is not DONE
 */
export async function computeWeekStatus(
    userId: string,
    weekStart: Date,
    weekEnd: Date
): Promise<{ status: TimesheetStatus; taskCount: number; completedTaskCount: number }> {
    const tasks = await prisma.task.findMany({
        where: {
            assignedToId: userId,
            isDeleted: false,
            dueDate: { gte: weekStart, lte: weekEnd },
        },
        select: { status: true },
    });

    if (tasks.length === 0) {
        return { status: TimesheetStatus.MISSING, taskCount: 0, completedTaskCount: 0 };
    }

    const completedTaskCount = tasks.filter((t) => t.status === TaskStatus.DONE).length;
    const status =
        completedTaskCount === tasks.length
            ? TimesheetStatus.COMPLETED
            : TimesheetStatus.INCOMPLETE;

    return { status, taskCount: tasks.length, completedTaskCount };
}

export async function getOwnedTimesheet(userId: string, timesheetId: string): Promise<Timesheet | null> {
    return prisma.timesheet.findFirst({
        where: { id: timesheetId, userId },
    });
}

/**
 * Returns all timesheets for a user within a week-aligned date range,
 * auto-creating MISSING placeholders for any weeks that have no row yet.
 *
 * @param userId - The user whose timesheets to return.
 * @param rangeStart - Monday of the first week (inclusive).
 * @param rangeEnd   - Sunday/Friday of the last week (inclusive).
 *
 * Weeks are always Mon→Sun. The caller is responsible for passing
 * week-aligned dates (rangeStart must be a Monday).
 */
export async function ensureTimesheetsForRange(
    userId: string,
    rangeStart: Date,
    rangeEnd: Date
): Promise<Timesheet[]> {
    // Build the list of Monday dates covering the range.
    const mondays: Date[] = [];
    const cursor = new Date(rangeStart);
    while (cursor <= rangeEnd) {
        mondays.push(new Date(cursor));
        cursor.setUTCDate(cursor.getUTCDate() + 7);
    }

    // Fetch existing timesheets for the range in one query.
    const existing = await prisma.timesheet.findMany({
        where: {
            userId,
            periodStart: { gte: rangeStart, lte: rangeEnd },
        },
        orderBy: { periodStart: "asc" },
    });

    const existingStarts = new Set(existing.map((t) => t.periodStart.toISOString().slice(0, 10)));

    // Upsert a MISSING placeholder for every week not yet recorded.
    // @@unique([userId, periodStart]) makes this safe under concurrent requests.
    const missing = mondays.filter((m) => !existingStarts.has(m.toISOString().slice(0, 10)));

    if (missing.length > 0) {
        // Run all upserts in a single transaction to minimise round-trips.
        await prisma.$transaction(
            missing.map((monday) => {
                const friday = new Date(monday);
                friday.setUTCDate(monday.getUTCDate() + 4);

                return prisma.timesheet.upsert({
                    where: { userId_periodStart: { userId, periodStart: monday } },
                    create: {
                        userId,
                        // sequenceNumber is assigned via a sub-query to avoid gaps
                        // when multiple weeks are created at once.
                        sequenceNumber: 0, // overwritten immediately below via raw
                        status: TimesheetStatus.MISSING,
                        title: `Week of ${monday.toISOString().slice(0, 10)}`,
                        periodStart: monday,
                        periodEnd: friday,
                    },
                    update: {}, // already exists — leave it untouched
                });
            })
        );

        // Fix sequenceNumbers for any rows that were just created with 0.
        // Assign the next available number per user in periodStart order.
        const newRows = await prisma.timesheet.findMany({
            where: { userId, sequenceNumber: 0 },
            orderBy: { periodStart: "asc" },
        });

        if (newRows.length > 0) {
            const lastExisting = await prisma.timesheet.findFirst({
                where: { userId, sequenceNumber: { not: 0 } },
                orderBy: { sequenceNumber: "desc" },
                select: { sequenceNumber: true },
            });

            let next = (lastExisting?.sequenceNumber ?? 0) + 1;
            await prisma.$transaction(
                newRows.map((row) =>
                    prisma.timesheet.update({
                        where: { id: row.id },
                        data: { sequenceNumber: next++ },
                    })
                )
            );
        }

        // Re-fetch the full range now that placeholders exist.
        return prisma.timesheet.findMany({
            where: {
                userId,
                periodStart: { gte: rangeStart, lte: rangeEnd },
            },
            orderBy: { periodStart: "asc" },
        });
    }

    return existing;
}
