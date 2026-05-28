import prisma from "@/lib/db";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
    const cookiesList = await cookies();
    cookiesList.delete("auth_token");
    cookiesList.delete("refresh_token");

    const userId = request.headers.get("x-user-id");

    try {
        if (userId) {
            await prisma.user.update({
                where: { id: userId },
                data: { refreshToken: null, refreshTokenExp: null }
            });
        }
        return NextResponse.json({ message: "Logged out successfully" });
    } catch (error) {
        console.error("Logout error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
