import prisma from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { updateProjectSchema } from "@/common/ZodSchema";
import { forbiddenResponse, getCaller, unauthorizedResponse } from "@/lib/caller";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
    try {
        const caller = await getCaller(req.headers.get("x-user-id"));
        if (!caller) {
            return unauthorizedResponse();
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
                            },
                        },
                    },
                },
            },
        });

        if (!project) {
            return NextResponse.json({ message: "Project not found" }, { status: 404 });
        }

        if (caller.role === "EMPLOYEE") {
            const isMember = project.members.some((m) => m.user.id === caller.id);
            if (!isMember) {
                return forbiddenResponse();
            }
        }

        const formattedProject = {
            ...project,
            members: project.members.map((m) => m.user),
        };

        return NextResponse.json({ project: formattedProject }, { status: 200 });
    } catch (error) {
        console.error("GET /project/[id] error:", error);
        return NextResponse.json({ message: "Error fetching project" }, { status: 500 });
    }
}

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
    try {
        const caller = await getCaller(req.headers.get("x-user-id"));
        if (!caller) {
            return unauthorizedResponse();
        }

        if (caller.role !== "ADMIN" && caller.role !== "MANAGER") {
            return forbiddenResponse();
        }

        const resolvedParams = await params;

        const project = await prisma.project.findUnique({
            where: { id: resolvedParams.id, deletedAt: null },
            select: { managerId: true },
        });

        if (!project) {
            return NextResponse.json({ message: "Project not found" }, { status: 404 });
        }

        if (caller.role !== "ADMIN" && project.managerId !== caller.id) {
            return forbiddenResponse();
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
            },
        });

        return NextResponse.json({ message: "Project updated", project: updated }, { status: 200 });
    } catch (error) {
        console.error("PATCH /project/[id] error:", error);
        return NextResponse.json({ message: "Error updating project" }, { status: 500 });
    }
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
    try {
        const caller = await getCaller(req.headers.get("x-user-id"));
        if (!caller) {
            return unauthorizedResponse();
        }

        if (caller.role !== "ADMIN" && caller.role !== "MANAGER") {
            return forbiddenResponse();
        }

        const resolvedParams = await params;

        const project = await prisma.project.findUnique({
            where: { id: resolvedParams.id, deletedAt: null },
            select: { managerId: true },
        });

        if (!project) {
            return NextResponse.json({ message: "Project not found" }, { status: 404 });
        }

        if (caller.role !== "ADMIN" && project.managerId !== caller.id) {
            return forbiddenResponse();
        }

        await prisma.project.update({
            where: { id: resolvedParams.id },
            data: { deletedAt: new Date() },
        });

        return NextResponse.json({ message: "Project deleted" }, { status: 200 });
    } catch (error) {
        console.error("DELETE /project/[id] error:", error);
        return NextResponse.json({ message: "Error deleting project" }, { status: 500 });
    }
}
