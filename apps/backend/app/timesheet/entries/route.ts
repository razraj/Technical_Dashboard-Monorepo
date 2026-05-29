import prisma from "@/lib/db";
import { createEntrySchema } from "@/common/ZodSchema";
import { parseDateOnly, serializeEntry } from "@/lib/timesheet";
import { NextRequest, NextResponse } from "next/server";

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

        const { date, projectId, workType, description, hours, taskId } = parsed.data;

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

        if (taskId) {
            const task = await prisma.task.findFirst({
                where: { id: taskId, deletedAt: null },
                select: { projectId: true }
            });
            if (!task) {
                return NextResponse.json({ message: "Task not found" }, { status: 400 });
            }
            if (task.projectId !== projectId) {
                return NextResponse.json({ message: "Task does not belong to project" }, { status: 400 });
            }
        }

        const created = await prisma.timesheetEntry.create({
            data: {
                userId: callerId,
                date: entryDate,
                hours,
                workType,
                description,
                projectId,
                taskId: taskId ?? null
            },
            include: {
                project: { select: { id: true, name: true } },
                task: { select: { id: true, title: true } }
            }
        });

        return NextResponse.json({ entry: serializeEntry(created) }, { status: 201 });
    } catch (error) {
        console.log("🚀 ~ POST /timesheet/entries ~ error:", error);
        return NextResponse.json({ message: "Error creating entry" }, { status: 500 });
    }
}
