import prisma from "@/lib/db";
import { Prisma, TimesheetStatus, Timesheet, TimesheetEntry } from "@repo/db";

type TransactionClient = Prisma.TransactionClient;

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

export function parseOptionalDateTime(value: string | undefined): Date | undefined {
    if (value === undefined) return undefined;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        throw new Error("Invalid datetime value.");
    }
    return date;
}

function decimalToNumber(value: Prisma.Decimal): number {
    return Number(value.toString());
}

export function serializeTimesheetEntry(entry: TimesheetEntry) {
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
        updatedAt: entry.updatedAt.toISOString()
    };
}

export function serializeTimesheet(timesheet: Timesheet & { entries?: TimesheetEntry[] }): Timesheet {
    return {
        id: timesheet.id,
        userId: timesheet.userId,
        sequenceNumber: timesheet.sequenceNumber,
        status: timesheet.status,
        title: timesheet.title,
        notes: timesheet.notes,
        periodStart: parseDateOnly(timesheet.periodStart.toISOString().slice(0, 10)),
        periodEnd: parseDateOnly(timesheet.periodEnd.toISOString().slice(0, 10)),
        totalHours: timesheet.totalHours,
        regularHours: timesheet.regularHours,
        overtimeHours: timesheet.overtimeHours,
        submittedAt: new Date(timesheet.submittedAt?.toISOString() ?? ""),
        createdAt: new Date(timesheet.createdAt?.toISOString() ?? ""),
        updatedAt: new Date(timesheet.updatedAt?.toISOString() ?? ""),
        ...(timesheet.entries ? { entries: timesheet.entries.map(serializeTimesheetEntry) } : {})
    };
}

export async function recomputeRollups(timesheetId: string, tx: TransactionClient): Promise<Timesheet> {
    const entries = await tx.timesheetEntry.findMany({
        where: { timesheetId },
        select: { hours: true, isOvertime: true }
    });

    let totalHours = 0;
    let overtimeHours = 0;

    for (const entry of entries) {
        const hours = decimalToNumber(entry.hours);
        totalHours += hours;
        if (entry.isOvertime) {
            overtimeHours += hours;
        }
    }

    const regularHours = totalHours - overtimeHours;

    return tx.timesheet.update({
        where: { id: timesheetId },
        data: {
            totalHours,
            regularHours,
            overtimeHours
        }
    });
}

async function nextSequenceNumber(userId: string, tx: TransactionClient): Promise<number> {
    const last = await tx.timesheet.findFirst({
        where: { userId },
        orderBy: { sequenceNumber: "desc" },
        select: { sequenceNumber: true }
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
    const maxRetries = 2;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await prisma.$transaction(async (tx) => {
                const sequenceNumber = await nextSequenceNumber(userId, tx);
                return tx.timesheet.create({
                    data: {
                        userId,
                        sequenceNumber,
                        title: data.title,
                        notes: data.notes ?? null,
                        periodStart: data.periodStart,
                        periodEnd: data.periodEnd,
                        status: data.status ?? TimesheetStatus.MISSING
                    }
                });
            });
        } catch (error) {
            if (
                attempt < maxRetries - 1 &&
                error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === "P2002"
            ) {
                continue;
            }
            throw error;
        }
    }

    throw new Error("Failed to assign timesheet sequence number.");
}

export async function getOwnedTimesheet(userId: string, timesheetId: string): Promise<Timesheet | null> {
    return prisma.timesheet.findFirst({
        where: { id: timesheetId, userId }
    });
}
