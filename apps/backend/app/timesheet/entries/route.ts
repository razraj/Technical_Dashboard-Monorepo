import prisma from "@/lib/db";
import { createEntrySchema } from "@/common/ZodSchema";
import { parseDateOnly, serializeEntry } from "@/lib/timesheet";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /timesheet/entries
 *
 * Create a timesheet entry for the authenticated user (self-only writes).
 *
 * **Auth:** Requires `x-user-id` header (injected by `proxy.ts`). Entry is always
 * owned by the caller; managers cannot create entries on behalf of others.
 *
 * **Body** (validated by `createEntrySchema`):
 * - `date` — `YYYY-MM-DD` (UTC date-only)
 * - `projectId` — must reference a non-deleted project
 * - `workType` — non-empty string (e.g. "Development", "Bug fixes")
 * - `description` — non-empty string
 * - `hours` — positive number, max 24
 *
 * **201 response:** `{ "entry": TimesheetEntry }` — serialized via `serializeEntry`
 * (includes nested `project: { id, name }`).
 *
 * **Errors:** 400 invalid body/date/project · 401 missing caller · 500 unexpected
 */
export async function POST(req: NextRequest) {
    try {
        const callerId = req.headers.get("x-user-id");
        if (!callerId) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json().catch(() => null);
        const parsed = createEntrySchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ message: "Invalid body", errors: parsed.error.flatten() }, { status: 400 });
        }

        const { date, projectId, workType, description, hours } = parsed.data;

        let entryDate: Date;
        try {
            entryDate = parseDateOnly(date);
        } catch {
            return NextResponse.json({ message: "Invalid date." }, { status: 400 });
        }

        const project = await prisma.project.findFirst({
            where: { id: projectId, deletedAt: null },
            select: { id: true }
        });
        if (!project) {
            return NextResponse.json({ message: "Project not found" }, { status: 400 });
        }

        const created = await prisma.timesheetEntry.create({
            data: {
                userId: callerId,
                date: entryDate,
                hours,
                workType,
                description,
                projectId
            },
            include: {
                project: { select: { id: true, name: true } }
            }
        });

        return NextResponse.json({ entry: serializeEntry(created) }, { status: 201 });
    } catch (error) {
        console.log("🚀 ~ POST /timesheet/entries ~ error:", error);
        return NextResponse.json({ message: "Error creating entry" }, { status: 500 });
    }
}
