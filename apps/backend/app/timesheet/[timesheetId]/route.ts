import { updateTimesheetSchema } from "@/common/ZodSchema";
import prisma from "@/lib/db";
import { getOwnedTimesheet, parseDateOnly, parseOptionalDateTime, serializeTimesheet } from "@/lib/timesheet";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ timesheetId: string }> }
): Promise<NextResponse> {
    try {
        const userId = req.headers.get("x-user-id");
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { timesheetId } = await params;
        const timesheet = await prisma.timesheet.findFirst({
            where: { id: timesheetId, userId },
            include: {
                entries: {
                    orderBy: [{ workDate: "asc" }, { createdAt: "asc" }]
                }
            }
        });

        if (!timesheet) {
            return NextResponse.json({ error: "Timesheet not found" }, { status: 404 });
        }

        return NextResponse.json({ timesheet: serializeTimesheet(timesheet) });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ timesheetId: string }> }
): Promise<NextResponse> {
    try {
        const userId = req.headers.get("x-user-id");
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { timesheetId } = await params;
        const existing = await getOwnedTimesheet(userId, timesheetId);
        if (!existing) {
            return NextResponse.json({ error: "Timesheet not found" }, { status: 404 });
        }

        const body = await req.json();
        const parsed = updateTimesheetSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
        }

        const periodStart = parsed.data.periodStart ? parseDateOnly(parsed.data.periodStart) : existing.periodStart;
        const periodEnd = parsed.data.periodEnd ? parseDateOnly(parsed.data.periodEnd) : existing.periodEnd;
        if (periodEnd < periodStart) {
            return NextResponse.json({ error: "periodEnd must be on or after periodStart" }, { status: 400 });
        }

        const submittedAt =
            parsed.data.submittedAt === undefined
                ? undefined
                : parsed.data.submittedAt === null
                  ? null
                  : parseOptionalDateTime(parsed.data.submittedAt);

        const timesheet = await prisma.timesheet.update({
            where: { id: timesheetId },
            data: {
                ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
                ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes } : {}),
                ...(parsed.data.periodStart !== undefined ? { periodStart } : {}),
                ...(parsed.data.periodEnd !== undefined ? { periodEnd } : {}),
                ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
                ...(submittedAt !== undefined ? { submittedAt } : {})
            }
        });

        return NextResponse.json({ timesheet: serializeTimesheet(timesheet) });
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
    { params }: { params: Promise<{ timesheetId: string }> }
): Promise<NextResponse> {
    try {
        const userId = req.headers.get("x-user-id");
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { timesheetId } = await params;
        const existing = await getOwnedTimesheet(userId, timesheetId);
        if (!existing) {
            return NextResponse.json({ error: "Timesheet not found" }, { status: 404 });
        }

        await prisma.timesheet.delete({ where: { id: timesheetId } });
        return NextResponse.json({ message: "Timesheet deleted" });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
