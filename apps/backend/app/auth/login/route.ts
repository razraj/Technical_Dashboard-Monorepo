import { loginRequestSchema } from "@/common/ZodSchema";
import { completeLoginForUserId } from "@/lib/auth-session";
import prisma from "@/lib/db";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

function isEmail(username: string) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(username);
}

export async function POST(request: Request) {
    try {
        const raw = await request.json();
        const parsed = loginRequestSchema.safeParse(raw);
        if (!parsed.success) {
            return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
        }
        const { username, password } = parsed.data;

        const emailCheck = isEmail(username);
        const whereClause = emailCheck ? { email: username } : { username };
        const user = await prisma.user.findUnique({
            where: whereClause,
            select: {
                id: true,
                password: true,
                emailVerified: true
            }
        });

        if (!user?.password || !bcrypt.compareSync(password, user.password)) {
            return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
        }
        if (!user.emailVerified) {
            return NextResponse.json(
                { error: "Email not verified", code: "EMAIL_NOT_VERIFIED" },
                { status: 403 }
            );
        }

        return completeLoginForUserId(user.id);
    } catch (error) {
        console.error("Login error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
