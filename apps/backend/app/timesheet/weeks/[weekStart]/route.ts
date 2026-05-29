import prisma from "@/lib/db";
import { weekDetailQuerySchema } from "@/common/ZodSchema";
import {
    addUtcDays,
    computeStatus,
    isoWeekParts,
    isoWeekStart,
    parseDateOnly,
    resolveTimesheetTarget,
    serializeEntry,
    toIsoDate
} from "@/lib/timesheet";
import { NextRequest, NextResponse } from "next/server";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

export async function GET(req: NextRequest, { params }: { params: Promise<{ weekStart: string }> }) {
    try {
        const callerId = req.headers.get("x-user-id");
        if (!callerId) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const { weekStart } = await params;
        let monday: Date;
        try {
            monday = parseDateOnly(weekStart);
        } catch {
            return NextResponse.json({ message: "Invalid weekStart. Expected YYYY-MM-DD." }, { status: 400 });
        }
        if (isoWeekStart(monday).getTime() !== monday.getTime()) {
            return NextResponse.json({ message: "weekStart must be a Monday." }, { status: 400 });
        }

        const { searchParams } = new URL(req.url);
        const parsed = weekDetailQuerySchema.safeParse({ userId: searchParams.get("userId") ?? undefined });
        if (!parsed.success) {
            return NextResponse.json({ message: "Invalid query", errors: parsed.error.flatten() }, { status: 400 });
        }

        const target = await resolveTimesheetTarget(callerId, parsed.data.userId);
        if (!target.ok) {
            return NextResponse.json({ message: target.message }, { status: target.status });
        }

        const sunday = addUtcDays(monday, 6);
        const entries = await prisma.timesheetEntry.findMany({
            where: { userId: target.userId, deletedAt: null, date: { gte: monday, lte: sunday } },
            include: {
                project: { select: { id: true, name: true } },
                task: { select: { id: true, title: true } }
            },
            orderBy: { createdAt: "asc" }
        });

        let totalHours = 0;
        for (const entry of entries) {
            totalHours += entry.hours;
        }

        const days = DAY_LABELS.map((dayLabel, index) => {
            const dayIso = toIsoDate(addUtcDays(monday, index));
            const dayEntries = entries.filter((entry) => toIsoDate(entry.date) === dayIso);
            return {
                date: dayIso,
                dayLabel,
                totalHours: dayEntries.reduce((sum, entry) => sum + entry.hours, 0),
                entries: dayEntries.map(serializeEntry)
            };
        });

        const { weekNumber, weekYear } = isoWeekParts(monday);
        const capacity = target.weeklyCapacity;
        const utilization = capacity > 0 ? Math.round((totalHours / capacity) * 100) : 0;

        return NextResponse.json(
            {
                weekNumber,
                weekYear,
                periodStart: toIsoDate(monday),
                periodEnd: toIsoDate(addUtcDays(monday, 4)),
                totalHours,
                capacity,
                utilization,
                status: computeStatus(totalHours, capacity),
                days
            },
            { status: 200 }
        );
    } catch (error) {
        console.log("🚀 ~ GET /timesheet/weeks/[weekStart] ~ error:", error);
        return NextResponse.json({ message: "Error fetching week details" }, { status: 500 });
    }
}
