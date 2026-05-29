import prisma from "@/lib/db";
import { weeksQuerySchema } from "@/common/ZodSchema";
import {
    buildManagedProjectWeekSummaries,
    buildUserWeekSummaries,
    resolveTimesheetReadScope
} from "@/lib/timesheet";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /timesheet/weeks
 *
 * Paginated list of ISO weeks with derived totals and status. Weeks are computed
 * in-memory from non-deleted `TimesheetEntry` rows — there is no stored Timesheet
 * record or persisted status.
 *
 * **Auth:** Requires `x-user-id` header (injected by `proxy.ts` after JWT verification).
 *
 * **Query params** (validated by `weeksQuerySchema`):
 * - `page` — 1-based page number (default `1`)
 * - `pageSize` — items per page, 1–100 (default `10`)
 * - `userId` — optional; read another user's weeks. Allowed only for MANAGER/ADMIN (403 otherwise)
 * - `projectId` — optional; filter to one managed project (manager/admin team view only)
 * - `scope` — `"self"` forces the caller's own timesheet; omit for role default
 *
 * **Read scope** (via `resolveTimesheetReadScope`):
 * - EMPLOYEE → own entries only (`view: "self"`)
 * - MANAGER/ADMIN → managed projects by default (`view: "manager"`, one row per project × week)
 * - MANAGER/ADMIN + `scope=self` → own entries
 *
 * **Week semantics:** ISO 8601 week (Mon–Sun). `periodStart`/`periodEnd` in each row
 * are Monday/Friday. `totalHours` sums the full Mon–Sun window. Status vs
 * `weeklyCapacity` (default 40): `MISSING` (0h), `INCOMPLETE` (< capacity), `COMPLETED` (≥ capacity).
 * Listing is dense (every week from first entry through today) and sorted newest-first.
 *
 * **200 response:**
 * ```json
 * {
 *   "view": "self" | "manager",
 *   "canViewTeamTimesheets": boolean,
 *   "weeks": [{ "weekNumber", "weekYear", "periodStart", "periodEnd", "totalHours", "status", "project?" }],
 *   "page": number,
 *   "pageSize": number,
 *   "total": number
 * }
 * ```
 *
 * **Errors:** 400 invalid query · 401 missing caller · 403/404 scope target · 500 unexpected
 */
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
