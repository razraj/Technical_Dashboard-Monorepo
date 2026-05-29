import prisma from "@/lib/db";
import { weeksQuerySchema } from "@/common/ZodSchema";
import {
    buildManagedProjectWeekSummaries,
    buildUserWeekSummaries,
    resolveTimesheetReadScope
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
            userId: searchParams.get("userId") ?? undefined,
            projectId: searchParams.get("projectId") ?? undefined,
            scope: searchParams.get("scope") ?? undefined
        });
        if (!parsed.success) {
            return NextResponse.json({ message: "Invalid query", errors: parsed.error.flatten() }, { status: 400 });
        }

        const { page, pageSize, userId, projectId, scope } = parsed.data;
        const scopeResult = await resolveTimesheetReadScope(callerId, userId, projectId, scope);
        if ("ok" in scopeResult) {
            return NextResponse.json({ message: scopeResult.message }, { status: scopeResult.status });
        }

        let allWeeks;
        if (scopeResult.mode === "user") {
            const entries = await prisma.timesheetEntry.findMany({
                where: { userId: scopeResult.userId, deletedAt: null },
                select: { date: true, hours: true }
            });
            allWeeks = buildUserWeekSummaries(entries, scopeResult.weeklyCapacity);
        } else {
            const projectIds = scopeResult.projects.map((project) => project.id);
            const entries =
                projectIds.length === 0
                    ? []
                    : await prisma.timesheetEntry.findMany({
                          where: { projectId: { in: projectIds }, deletedAt: null },
                          select: { date: true, hours: true, projectId: true }
                      });
            allWeeks = buildManagedProjectWeekSummaries(entries, scopeResult.projects, scopeResult.weeklyCapacity);
        }

        const total = allWeeks.length;
        const startIdx = (page - 1) * pageSize;
        const weeks = allWeeks.slice(startIdx, startIdx + pageSize);

        return NextResponse.json(
            {
                view: scopeResult.view,
                canViewTeamTimesheets: scopeResult.canViewTeamTimesheets,
                weeks,
                page,
                pageSize,
                total
            },
            { status: 200 }
        );
    } catch (error) {
        console.log("🚀 ~ GET /timesheet/weeks ~ error:", error);
        return NextResponse.json({ message: "Error fetching weeks" }, { status: 500 });
    }
}
