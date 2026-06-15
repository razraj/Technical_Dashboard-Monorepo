import prisma from "@/lib/db";
import { updateEntrySchema } from "@/common/ZodSchema";
import { parseDateOnly, serializeEntry } from "@/lib/timesheet";
import { NextRequest, NextResponse } from "next/server";

/**
 * PATCH /timesheet/entries/[entryId]
 *
 * Partially update an existing timesheet entry. Self-only: entry must belong to
 * the caller and not be soft-deleted.
 *
 * **Auth:** Requires `x-user-id` header (injected by `proxy.ts`).
 *
 * **Path param:** `entryId` — UUID of the entry to update.
 *
 * **Body** (validated by `updateEntrySchema`): at least one of:
 * - `date` — `YYYY-MM-DD`
 * - `projectId` — non-deleted project
 * - `workType` — non-empty string
 * - `description` — non-empty string
 * - `hours` — positive number, max 24
 *
 * Omitted fields are left unchanged.
 *
 * **200 response:** `{ "entry": TimesheetEntry }`
 *
 * **Errors:** 400 invalid body/date/project · 401 missing caller · 404 entry not found/not owned · 500 unexpected
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ entryId: string }> }) {
    try {
        const callerId = req.headers.get("x-user-id");
        if (!callerId) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const { entryId } = await params;
        const body = await req.json().catch(() => null);
        const parsed = updateEntrySchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ message: "Invalid body", errors: parsed.error.flatten() }, { status: 400 });
        }

        const existing = await prisma.timesheetEntry.findFirst({
            where: { id: entryId, userId: callerId, deletedAt: null },
            select: { id: true }
        });
        if (!existing) {
            return NextResponse.json({ message: "Entry not found" }, { status: 404 });
        }

        const data = parsed.data;

        let parsedDate: Date | undefined;
        if (data.date !== undefined) {
            try {
                parsedDate = parseDateOnly(data.date);
            } catch {
                return NextResponse.json({ message: "Invalid date." }, { status: 400 });
            }
        }

        if (data.projectId) {
            const project = await prisma.project.findFirst({
                where: { id: data.projectId, deletedAt: null },
                select: { id: true }
            });
            if (!project) {
                return NextResponse.json({ message: "Project not found" }, { status: 400 });
            }
        }

        const updated = await prisma.timesheetEntry.update({
            where: { id: entryId },
            data: {
                ...(parsedDate !== undefined ? { date: parsedDate } : {}),
                ...(data.projectId !== undefined ? { projectId: data.projectId } : {}),
                ...(data.workType !== undefined ? { workType: data.workType } : {}),
                ...(data.description !== undefined ? { description: data.description } : {}),
                ...(data.hours !== undefined ? { hours: data.hours } : {})
            },
            include: {
                project: { select: { id: true, name: true } }
            }
        });

        return NextResponse.json({ entry: serializeEntry(updated) }, { status: 200 });
    } catch (error) {
        console.log("🚀 ~ PATCH /timesheet/entries/[entryId] ~ error:", error);
        return NextResponse.json({ message: "Error updating entry" }, { status: 500 });
    }
}

/**
 * DELETE /timesheet/entries/[entryId]
 *
 * Soft-delete a timesheet entry by setting `deletedAt`. Self-only: entry must
 * belong to the caller and not already be deleted. Soft-deleted entries are
 * excluded from all read/aggregation endpoints.
 *
 * **Auth:** Requires `x-user-id` header (injected by `proxy.ts`).
 *
 * **Path param:** `entryId` — UUID of the entry to delete.
 *
 * **200 response:** `{ "success": true, "id": "<entryId>" }`
 *
 * **Errors:** 401 missing caller · 404 entry not found/not owned · 500 unexpected
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ entryId: string }> }) {
    try {
        const callerId = req.headers.get("x-user-id");
        if (!callerId) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const { entryId } = await params;
        const existing = await prisma.timesheetEntry.findFirst({
            where: { id: entryId, userId: callerId, deletedAt: null },
            select: { id: true }
        });
        if (!existing) {
            return NextResponse.json({ message: "Entry not found" }, { status: 404 });
        }

        await prisma.timesheetEntry.update({
            where: { id: entryId },
            data: { deletedAt: new Date() }
        });

        return NextResponse.json({ success: true, id: entryId }, { status: 200 });
    } catch (error) {
        console.log("🚀 ~ DELETE /timesheet/entries/[entryId] ~ error:", error);
        return NextResponse.json({ message: "Error deleting entry" }, { status: 500 });
    }
}
