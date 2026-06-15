import prisma from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { addMemberSchema } from "@/lib/zod-schemas";

export async function POST(
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
        const parsed = addMemberSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ message: "Invalid data", errors: parsed.error.errors }, { status: 400 });
        }

        const userToAdd = await prisma.user.findFirst({
            where: { username: parsed.data.username, isDeleted: false },
            select: { id: true, username: true, firstName: true, lastName: true, email: true }
        });

        if (!userToAdd) {
            return NextResponse.json({ message: "User not found" }, { status: 404 });
        }

        await prisma.projectMember.create({
            data: {
                userId: userToAdd.id,
                projectId: resolvedParams.id
            }
        });

        return NextResponse.json({ message: "Member added", user: userToAdd }, { status: 201 });
    } catch (error: any) {
        if (error.code === 'P2002') {
             return NextResponse.json({ message: "User is already a member of this project" }, { status: 409 });
        }
        console.log("🚀 ~ POST /project/[id]/members ~ error:", error);
        return NextResponse.json({ message: "Error adding member" }, { status: 500 });
    }
}
