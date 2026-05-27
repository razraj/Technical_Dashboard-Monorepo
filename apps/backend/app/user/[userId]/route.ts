import prisma from "@/lib/db";
import { Prisma } from "@repo/db";
import { NextRequest, NextResponse } from "next/server";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
    try {
        const { userId: paramUserId } = await params;
        const body = await request.json();
        const userId = request.headers.get("x-user-id");
        if (paramUserId !== userId) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        if (!userId) {
            return NextResponse.json({ error: "User not found" }, { status: 401 });
        }
        const data: { firstName?: string; lastName?: string; profilePic?: string; username?: string } = {};
        if (typeof body.firstName === "string") data.firstName = body.firstName;
        if (typeof body.lastName === "string") data.lastName = body.lastName;
        if (typeof body.profilePic === "string") data.profilePic = body.profilePic;
        if (typeof body.username === "string") data.username = body.username;

        await prisma.user.update({
            where: { id: userId },
            data
        });
        return NextResponse.json({ message: "User updated" });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function GET(request: NextRequest) {
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
                updatedAt: true
            }
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
