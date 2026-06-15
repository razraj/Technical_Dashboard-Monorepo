import prisma from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { forbiddenResponse, getCaller, isPrismaKnownError, unauthorizedResponse } from "@/lib/caller";

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string; memberId: string }> }
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

        await prisma.projectMember.delete({
            where: {
                userId_projectId: {
                    userId: resolvedParams.memberId,
                    projectId: resolvedParams.id,
                },
            },
        });

        return NextResponse.json({ message: "Member removed" }, { status: 200 });
    } catch (error: unknown) {
        if (isPrismaKnownError(error, "P2025")) {
            return NextResponse.json({ message: "Member not found in project" }, { status: 404 });
        }
        console.error("DELETE /project/[id]/members/[memberId] error:", error);
        return NextResponse.json({ message: "Error removing member" }, { status: 500 });
    }
}
