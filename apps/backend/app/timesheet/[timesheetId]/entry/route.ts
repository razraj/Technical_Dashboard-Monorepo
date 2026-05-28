import { createTimesheetEntrySchema } from "@/common/ZodSchema";
import prisma from "@/lib/db";
import {
    getOwnedTimesheet,
    parseDateOnly,
    parseOptionalDateTime,
    recomputeRollups,
    serializeTimesheetEntry
} from "@/lib/timesheet";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest, { params }: { params: Promise<{ timesheetId: string }> }) {
    try {
        const userId = req.headers.get("x-user-id");
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { timesheetId } = await params;
        const timesheet = await getOwnedTimesheet(userId, timesheetId);
        if (!timesheet) {
            return NextResponse.json({ error: "Timesheet not found" }, { status: 404 });
        }

        const entries = await prisma.timesheetEntry.findMany({
            where: { timesheetId },
            orderBy: [{ workDate: "asc" }, { createdAt: "asc" }]
        });

        return NextResponse.json({
            entries: entries.map(serializeTimesheetEntry),
            total: entries.length
        });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ timesheetId: string }> }) {
    try {
        const userId = req.headers.get("x-user-id");
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { timesheetId } = await params;
        const timesheet = await getOwnedTimesheet(userId, timesheetId);
        if (!timesheet) {
            return NextResponse.json({ error: "Timesheet not found" }, { status: 404 });
        }

        const body = await req.json();
        const parsed = createTimesheetEntrySchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
        }

        const entry = await prisma.$transaction(async (tx) => {
            const created = await tx.timesheetEntry.create({
                data: {
                    timesheetId,
                    taskId: parsed.data.taskId,
                    workDate: parseDateOnly(parsed.data.workDate),
                    hours: parsed.data.hours,
                    startTime: parseOptionalDateTime(parsed.data.startTime),
                    endTime: parseOptionalDateTime(parsed.data.endTime),
                    isOvertime: parsed.data.isOvertime ?? false,
                    description: parsed.data.description ?? null
                }
            });
            await recomputeRollups(timesheetId, tx);
            return created;
        });

        return NextResponse.json({ entry: serializeTimesheetEntry(entry) }, { status: 201 });
    } catch (error) {
        console.error(error);
        if (error instanceof Error && error.message.startsWith("Invalid date")) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
