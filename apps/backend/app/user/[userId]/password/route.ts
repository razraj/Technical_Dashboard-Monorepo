import prisma from "@/lib/db";
import { Prisma } from "@repo/db";
import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";

export async function PUT(request: NextRequest) {
    const data = await request.json();
    const id = request.headers.get("x-user-id");
    if (!id) {
        return NextResponse.json({ error: "User not found" }, { status: 401 });
    }
    try {
        const user = await prisma.user.findUniqueOrThrow({
            where: { id },
            select: { password: true }
        });
        if (!bcrypt.compareSync(data.oldPassword, user.password)) {
            return NextResponse.json({ error: "Invalid current password" }, { status: 400 });
        }
        const hashedPassword = bcrypt.hashSync(data.password, 10);
        await prisma.user.update({
            where: { id },
            data: { password: hashedPassword }
        });
        return NextResponse.json({ message: "Password updated" });
    } catch (error) {
        console.error(error);
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
