import prisma from "@/lib/db";
import { weeksQuerySchema } from "@/common/ZodSchema";
import {
    addUtcDays,
    computeStatus,
    enumerateWeeks,
    isoWeekParts,
    isoWeekStart,
    resolveTimesheetTarget,
    toIsoDate
} from "@/lib/timesheet";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
    try {
        const callerId = req.headers.get("x-user-id");
        if (!callerId) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const parsed = weeksQuerySchema.safeParse({
            page: searchParams.get("page") ?? undefined,
            pageSize: searchParams.get("pageSize") ?? undefined,
            userId: searchParams.get("userId") ?? undefined
        });
        if (!parsed.success) {
            return NextResponse.json({ message: "Invalid query", errors: parsed.error.flatten() }, { status: 400 });
        }

        const { page, pageSize, userId } = parsed.data;
        const target = await resolveTimesheetTarget(callerId, userId);
        if (!target.ok) {
            return NextResponse.json({ message: target.message }, { status: target.status });
        }

        const entries = await prisma.timesheetEntry.findMany({
            where: { userId: target.userId, deletedAt: null },
            select: { date: true, hours: true }
        });

        const now = new Date();
        const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

        let minDate = todayUtc;
        let maxDate = todayUtc;
        for (const entry of entries) {
            if (entry.date.getTime() < minDate.getTime()) minDate = entry.date;
            if (entry.date.getTime() > maxDate.getTime()) maxDate = entry.date;
        }

        const totalsByWeek = new Map<string, number>();
        for (const entry of entries) {
            const key = toIsoDate(isoWeekStart(entry.date));
            totalsByWeek.set(key, (totalsByWeek.get(key) ?? 0) + entry.hours);
        }

        const allWeeks = enumerateWeeks(isoWeekStart(minDate), isoWeekStart(maxDate))
            .map((monday) => {
                const periodStart = toIsoDate(monday);
                const totalHours = totalsByWeek.get(periodStart) ?? 0;
                const { weekNumber, weekYear } = isoWeekParts(monday);
                return {
                    weekNumber,
                    weekYear,
                    periodStart,
                    periodEnd: toIsoDate(addUtcDays(monday, 4)),
                    totalHours,
                    status: computeStatus(totalHours, target.weeklyCapacity)
                };
            })
            .sort((a, b) => (a.periodStart < b.periodStart ? 1 : -1));

        const total = allWeeks.length;
        const startIdx = (page - 1) * pageSize;
        const weeks = allWeeks.slice(startIdx, startIdx + pageSize);

        return NextResponse.json({ weeks, page, pageSize, total }, { status: 200 });
    } catch (error) {
        console.log("🚀 ~ GET /timesheet/weeks ~ error:", error);
        return NextResponse.json({ message: "Error fetching weeks" }, { status: 500 });
    }
}
