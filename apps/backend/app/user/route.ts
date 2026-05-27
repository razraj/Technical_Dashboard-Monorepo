import prisma from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
    const users = await prisma.user.findMany({
        where: { isDeleted: false },
        select: {
            id: true,
            email: true,
            username: true,
            firstName: true,
            lastName: true,
            profilePic: true,
            createdAt: true,
            updatedAt: true
        }
    });
    return NextResponse.json({
        users,
        total: users.length,
        message: "Users page"
    });
}
