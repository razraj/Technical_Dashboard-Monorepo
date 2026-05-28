import { completeLoginForUserId } from "@/lib/auth-session";
import prisma from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
    try {
        const token = request.nextUrl.searchParams.get("token");
        if (!token?.trim()) {
            return NextResponse.json({ error: "Missing token" }, { status: 400 });
        }

        const user = await prisma.user.findUnique({
            where: { emailVerificationToken: token.trim() },
            select: {
                id: true,
                emailVerificationExp: true
            }
        });

        if (!user || !user.emailVerificationExp) {
            return NextResponse.json({ error: "Invalid or expired verification link" }, { status: 400 });
        }
        if (user.emailVerificationExp.getTime() < Date.now()) {
            return NextResponse.json({ error: "Verification link expired" }, { status: 400 });
        }

        await prisma.user.update({
            where: { id: user.id },
            data: {
                emailVerified: new Date(),
                emailVerificationToken: null,
                emailVerificationExp: null
            }
        });

        return completeLoginForUserId(user.id);
    } catch (error) {
        console.error("Verify email error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
