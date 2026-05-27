import { updateTimesheetEntrySchema } from "@/common/ZodSchema";
import prisma from "@/lib/db";
import {
    getOwnedTimesheet,
    parseDateOnly,
    parseOptionalDateTime,
    recomputeRollups,
    serializeTimesheetEntry
} from "@/lib/timesheet";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ timesheetId: string; entryId: string }> }
) {
    try {
        const userId = req.headers.get("x-user-id");
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { timesheetId, entryId } = await params;
        const timesheet = await getOwnedTimesheet(userId, timesheetId);
        if (!timesheet) {
            return NextResponse.json({ error: "Timesheet not found" }, { status: 404 });
        }

        const existing = await prisma.timesheetEntry.findFirst({
            where: { id: entryId, timesheetId }
        });
        if (!existing) {
            return NextResponse.json({ error: "Entry not found" }, { status: 404 });
        }

        const body = await req.json();
        const parsed = updateTimesheetEntrySchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
        }

        const startTime =
            parsed.data.startTime === undefined
                ? undefined
                : parsed.data.startTime === null
                  ? null
                  : parseOptionalDateTime(parsed.data.startTime);
        const endTime =
            parsed.data.endTime === undefined
                ? undefined
                : parsed.data.endTime === null
                  ? null
                  : parseOptionalDateTime(parsed.data.endTime);

        const entry = await prisma.$transaction(async (tx) => {
            const updated = await tx.timesheetEntry.update({
                where: { id: entryId },
                data: {
                    ...(parsed.data.workDate !== undefined ? { workDate: parseDateOnly(parsed.data.workDate) } : {}),
                    ...(parsed.data.hours !== undefined ? { hours: parsed.data.hours } : {}),
                    ...(startTime !== undefined ? { startTime } : {}),
                    ...(endTime !== undefined ? { endTime } : {}),
                    ...(parsed.data.isOvertime !== undefined ? { isOvertime: parsed.data.isOvertime } : {}),
                    ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {})
                }
            });
            await recomputeRollups(timesheetId, tx);
            return updated;
        });

        return NextResponse.json({ entry: serializeTimesheetEntry(entry) });
    } catch (error) {
        console.error(error);
        if (error instanceof Error && error.message.startsWith("Invalid date")) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ timesheetId: string; entryId: string }> }
) {
    try {
        const userId = req.headers.get("x-user-id");
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { timesheetId, entryId } = await params;
        const timesheet = await getOwnedTimesheet(userId, timesheetId);
        if (!timesheet) {
            return NextResponse.json({ error: "Timesheet not found" }, { status: 404 });
        }

        const existing = await prisma.timesheetEntry.findFirst({
            where: { id: entryId, timesheetId }
        });
        if (!existing) {
            return NextResponse.json({ error: "Entry not found" }, { status: 404 });
        }

        await prisma.$transaction(async (tx) => {
            await tx.timesheetEntry.delete({ where: { id: entryId } });
            await recomputeRollups(timesheetId, tx);
        });

        return NextResponse.json({ message: "Entry deleted" });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
