import prisma from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { addMemberSchema } from "@/common/ZodSchema";
import { forbiddenResponse, getCaller, isPrismaKnownError, unauthorizedResponse } from "@/lib/caller";

export async function POST(
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
        const parsed = addMemberSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ message: "Invalid data", errors: parsed.error.errors }, { status: 400 });
        }

        const userToAdd = await prisma.user.findFirst({
            where: { username: parsed.data.username, isDeleted: false },
            select: { id: true, username: true, firstName: true, lastName: true, email: true },
        });

        if (!userToAdd) {
            return NextResponse.json({ message: "User not found" }, { status: 404 });
        }

        await prisma.projectMember.create({
            data: {
                userId: userToAdd.id,
                projectId: resolvedParams.id,
            },
        });

        return NextResponse.json({ message: "Member added", user: userToAdd }, { status: 201 });
    } catch (error: unknown) {
        if (isPrismaKnownError(error, "P2002")) {
            return NextResponse.json({ message: "User is already a member of this project" }, { status: 409 });
        }
        console.error("POST /project/[id]/members error:", error);
        return NextResponse.json({ message: "Error adding member" }, { status: 500 });
    }
}
