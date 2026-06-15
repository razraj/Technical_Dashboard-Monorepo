import prisma from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { unauthorizedResponse } from "@/lib/caller";

export async function GET(req: NextRequest): Promise<NextResponse> {
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
                role: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        if (!user) {
            return unauthorizedResponse();
        }

        return NextResponse.json({ user }, { status: 200 });
    } catch (error) {
        console.error("GET /auth/me error:", error);
        return NextResponse.json({ message: "Error fetching user" }, { status: 500 });
    }
}
