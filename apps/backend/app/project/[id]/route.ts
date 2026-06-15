import prisma from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { updateProjectSchema } from "@/lib/zod-schemas";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const callerId = req.headers.get("x-user-id");
        if (!callerId) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const caller = await prisma.user.findUnique({
            where: { id: callerId },
            select: { role: true }
        });

        if (!caller) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const resolvedParams = await params;

        const project = await prisma.project.findUnique({
            where: { id: resolvedParams.id, deletedAt: null },
            include: {
                members: {
                    select: {
                        user: {
                            select: {
                                id: true,
                                username: true,
                                firstName: true,
                                lastName: true,
                                email: true,
                            }
                        }
                    }
                }
            }
        });

        if (!project) {
            return NextResponse.json({ message: "Project not found" }, { status: 404 });
        }

        // Access check
        const isManager = project.managerId === callerId;
        const isMember = project.members.some(m => m.user.id === callerId);
        if (caller.role !== "ADMIN" && !isManager && !isMember) {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 });
        }

        // Flatten members array to match ProjectDetail type
        const formattedProject = {
            ...project,
            members: project.members.map(m => m.user)
        };

        return NextResponse.json({ project: formattedProject }, { status: 200 });
    } catch (error) {
        console.log("🚀 ~ GET /project/[id] ~ error:", error);
        return NextResponse.json({ message: "Error fetching project" }, { status: 500 });
    }
}

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const callerId = req.headers.get("x-user-id");
        if (!callerId) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const caller = await prisma.user.findUnique({
            where: { id: callerId },
            select: { role: true }
        });

        if (!caller || (caller.role !== "ADMIN" && caller.role !== "MANAGER")) {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 });
        }

        const resolvedParams = await params;

        const project = await prisma.project.findUnique({
            where: { id: resolvedParams.id, deletedAt: null },
            select: { managerId: true }
        });

        if (!project) {
            return NextResponse.json({ message: "Project not found" }, { status: 404 });
        }

        if (caller.role !== "ADMIN" && project.managerId !== callerId) {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 });
        }

        const body = await req.json();
        const parsed = updateProjectSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ message: "Invalid data", errors: parsed.error.errors }, { status: 400 });
        }

        const updated = await prisma.project.update({
            where: { id: resolvedParams.id },
            data: {
                name: parsed.data.name,
                description: parsed.data.description,
            }
        });

        return NextResponse.json({ message: "Project updated", project: updated }, { status: 200 });
    } catch (error) {
        console.log("🚀 ~ PATCH /project/[id] ~ error:", error);
        return NextResponse.json({ message: "Error updating project" }, { status: 500 });
    }
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const callerId = req.headers.get("x-user-id");
        if (!callerId) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const caller = await prisma.user.findUnique({
            where: { id: callerId },
            select: { role: true }
        });

        if (!caller || (caller.role !== "ADMIN" && caller.role !== "MANAGER")) {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 });
        }

        const resolvedParams = await params;

        const project = await prisma.project.findUnique({
            where: { id: resolvedParams.id, deletedAt: null },
            select: { managerId: true }
        });

        if (!project) {
            return NextResponse.json({ message: "Project not found" }, { status: 404 });
        }

        if (caller.role !== "ADMIN" && project.managerId !== callerId) {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 });
        }

        await prisma.project.update({
            where: { id: resolvedParams.id },
            data: { deletedAt: new Date() }
        });

        return NextResponse.json({ message: "Project deleted" }, { status: 200 });
    } catch (error) {
        console.log("🚀 ~ DELETE /project/[id] ~ error:", error);
        return NextResponse.json({ message: "Error deleting project" }, { status: 500 });
    }
}
