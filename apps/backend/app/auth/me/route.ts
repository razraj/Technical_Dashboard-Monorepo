import prisma from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
    try {
        const userId = req.headers.get("x-user-id");
        if (!userId) {
            return NextResponse.json({ message: "User not found" }, { status: 401 });
        }
        const user = await prisma.user.findUnique({
            where: { id: userId },
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

        if (!user) {
            return NextResponse.json({ message: "User not found" }, { status: 401 });
        }

        return NextResponse.json({ user }, { status: 200 });
    } catch (error) {
        return NextResponse.json({ message: "Error fetching user" }, { status: 500 });
    }
}
