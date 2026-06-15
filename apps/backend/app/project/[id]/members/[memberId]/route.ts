import prisma from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string; memberId: string }> }
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

        await prisma.projectMember.delete({
            where: {
                userId_projectId: {
                    userId: resolvedParams.memberId,
                    projectId: resolvedParams.id
                }
            }
        });

        return NextResponse.json({ message: "Member removed" }, { status: 200 });
    } catch (error: any) {
         if (error.code === 'P2025') {
            return NextResponse.json({ message: "Member not found in project" }, { status: 404 });
        }
        console.log("🚀 ~ DELETE /project/[id]/members/[memberId] ~ error:", error);
        return NextResponse.json({ message: "Error removing member" }, { status: 500 });
    }
}
