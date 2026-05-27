import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/db";

export async function POST(request: Request) {
    try {
        const userId = request.headers.get("x-user-id");
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const cookiesList = await cookies();
        cookiesList.delete("auth_token");
        cookiesList.delete("refresh_token");

        await prisma.user.update({
            where: { id: userId },
            data: { refreshToken: null, refreshTokenExp: null }
        });
        return NextResponse.json({
            message: "Logged out successfully"
        });
    } catch (error) {
        console.error("Login error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
