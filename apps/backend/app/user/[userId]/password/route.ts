import prisma from "@/lib/db";
import { Prisma } from "@repo/db";
import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const changePasswordSchema = z.object({
    oldPassword: z.string().min(1, "Old password is required"),
    password: z.string().min(8, "New password must be at least 8 characters")
});

export async function PUT(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
    const raw = await request.json();
    const { userId: paramUserId } = await params;
    const id = request.headers.get("x-user-id");

    if (!id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (paramUserId !== id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const parsed = changePasswordSchema.safeParse(raw);
    if (!parsed.success) {
        return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
    }
    const { oldPassword, password } = parsed.data;

    try {
        const user = await prisma.user.findUniqueOrThrow({
            where: { id },
            select: { password: true }
        });
        if (!user.password) {
            return NextResponse.json(
                {
                    error: "This account has no password. Sign in with your provider or use email recovery to set one.",
                    code: "NO_LOCAL_PASSWORD"
                },
                { status: 403 }
            );
        }
        if (!bcrypt.compareSync(oldPassword, user.password)) {
            return NextResponse.json({ error: "Invalid current password" }, { status: 400 });
        }
        const hashedPassword = bcrypt.hashSync(password, 10);
        await prisma.user.update({
            where: { id },
            data: { password: hashedPassword }
        });
        return NextResponse.json({ message: "Password updated" });
    } catch (error) {
        console.error("PUT /user/password error:", error);
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
