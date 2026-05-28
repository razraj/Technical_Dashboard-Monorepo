import { createTimesheetSchema } from "@/common/ZodSchema";
import prisma from "@/lib/db";
import { createTimesheetForUser, parseDateOnly, serializeTimesheet } from "@/lib/timesheet";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest): Promise<NextResponse> {
    try {
        const userId = req.headers.get("x-user-id");
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const timesheets = await prisma.timesheet.findMany({
            where: { userId },
            orderBy: [{ sequenceNumber: "desc" }]
        });

        return NextResponse.json({
            timesheets: timesheets.map(serializeTimesheet),
            total: timesheets.length
        });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
    try {
        const userId = req.headers.get("x-user-id");
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const parsed = createTimesheetSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
        }

        const periodStart = parseDateOnly(parsed.data.periodStart);
        const periodEnd = parseDateOnly(parsed.data.periodEnd);
        if (periodEnd < periodStart) {
            return NextResponse.json({ error: "periodEnd must be on or after periodStart" }, { status: 400 });
        }

        const timesheet = await createTimesheetForUser(userId, {
            title: parsed.data.title,
            notes: parsed.data.notes,
            periodStart,
            periodEnd,
            status: parsed.data.status
        });

        return NextResponse.json({ timesheet: serializeTimesheet(timesheet) }, { status: 201 });
    } catch (error) {
        console.error(error);
        if (error instanceof Error && error.message.startsWith("Invalid date")) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
