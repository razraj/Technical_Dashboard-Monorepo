import prisma from "@/lib/db";
import { Prisma } from "@repo/db";
import { NextRequest, NextResponse } from "next/server";
import { updateProfileSchema } from "@/common/ZodSchema";
import { isPrismaKnownError } from "@/lib/caller";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ userId: string }> }): Promise<NextResponse> {
    try {
        const { userId: paramUserId } = await params;
        const userId = request.headers.get("x-user-id");
        if (!userId) {
            return NextResponse.json({ error: "User not found" }, { status: 401 });
        }
        if (paramUserId !== userId) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const body = await request.json();
        const parsed = updateProfileSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
        }

        await prisma.user.update({
            where: { id: userId },
            data: parsed.data,
        });
        return NextResponse.json({ message: "User updated" });
    } catch (error) {
        if (isPrismaKnownError(error, "P2002")) {
            return NextResponse.json({ error: "Username already taken" }, { status: 409 });
        }
        console.error(error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
    try {
        const id = request.headers.get("x-user-id");
        const user = await prisma.user.findUniqueOrThrow({
            where: { id: id! },
            select: {
                id: true,
                email: true,
                username: true,
                firstName: true,
                lastName: true,
                profilePic: true,
                refreshToken: true,
                refreshTokenExp: true,
                resetToken: true,
                resetTokenExp: true,
                isDeleted: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        return NextResponse.json(user);
    } catch (error) {
        console.error(error);
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
            return NextResponse.json({ error: "User not found" }, { status: 401 });
        }
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
