import prisma from "@/lib/db";
import { updateEntrySchema } from "@/common/ZodSchema";
import { parseDateOnly, serializeEntry } from "@/lib/timesheet";
import { NextRequest, NextResponse } from "next/server";

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
            select: { id: true, projectId: true, taskId: true }
        });
        if (!existing) {
            return NextResponse.json({ message: "Entry not found" }, { status: 404 });
        }

        const data = parsed.data;
        const nextProjectId = data.projectId ?? existing.projectId;

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

        const nextTaskId = data.taskId !== undefined ? data.taskId : existing.taskId;
        const projectChanging = data.projectId !== undefined;
        const taskChanging = data.taskId !== undefined;

        if (nextTaskId && (projectChanging || taskChanging)) {
            const task = await prisma.task.findFirst({
                where: { id: nextTaskId, deletedAt: null },
                select: { projectId: true }
            });
            if (!task) {
                return NextResponse.json({ message: "Task not found" }, { status: 400 });
            }
            if (task.projectId !== nextProjectId) {
                return NextResponse.json({ message: "Task does not belong to project" }, { status: 400 });
            }
        }

        const updated = await prisma.timesheetEntry.update({
            where: { id: entryId },
            data: {
                ...(parsedDate !== undefined ? { date: parsedDate } : {}),
                ...(data.projectId !== undefined ? { projectId: data.projectId } : {}),
                ...(data.workType !== undefined ? { workType: data.workType } : {}),
                ...(data.description !== undefined ? { description: data.description } : {}),
                ...(data.hours !== undefined ? { hours: data.hours } : {}),
                ...(data.taskId !== undefined ? { taskId: data.taskId } : {})
            },
            include: {
                project: { select: { id: true, name: true } },
                task: { select: { id: true, title: true } }
            }
        });

        return NextResponse.json({ entry: serializeEntry(updated) }, { status: 200 });
    } catch (error) {
        console.log("🚀 ~ PATCH /timesheet/entries/[entryId] ~ error:", error);
        return NextResponse.json({ message: "Error updating entry" }, { status: 500 });
    }
}

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
