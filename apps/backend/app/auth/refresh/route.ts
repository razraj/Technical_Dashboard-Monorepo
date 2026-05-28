import prisma from "@/lib/db";
import { AUTH_ACCESS_TOKEN_MAX_AGE_SEC } from "@/lib/auth-session";
import { jwtVerify, SignJWT } from "jose";
import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";

const SECRET_KEY = new TextEncoder().encode(process.env.JWT_SECRET);

function generateToken(userId: string) {
    return new SignJWT({})
        .setProtectedHeader({ alg: "HS256" })
        .setSubject(userId)
        .setIssuedAt()
        .setExpirationTime(`${AUTH_ACCESS_TOKEN_MAX_AGE_SEC}s`)
        .sign(SECRET_KEY);
}

async function verifyRefreshJwt(token: string) {
    try {
        const { payload } = await jwtVerify(token, SECRET_KEY);
        return payload;
    } catch {
        return null;
    }
}

function safeEqual(a: string, b: string): boolean {
    try {
        const bufA = Buffer.from(a);
        const bufB = Buffer.from(b);
        if (bufA.length !== bufB.length) return false;
        return timingSafeEqual(bufA, bufB);
    } catch {
        return false;
    }
}

export async function POST(req: NextRequest) {
    try {
        const requestRefreshToken = req.cookies.get("refresh_token")?.value;
        if (!requestRefreshToken) {
            return NextResponse.json({ error: "Missing refresh token" }, { status: 401 });
        }

        const payload = await verifyRefreshJwt(requestRefreshToken);
        if (!payload?.sub) {
            return NextResponse.json({ error: "Invalid refresh token" }, { status: 401 });
        }
        const userId = payload.sub;

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                refreshToken: true,
                refreshTokenExp: true
            }
        });

        if (!user?.refreshToken || !user.refreshTokenExp || user.refreshTokenExp < new Date()) {
            return NextResponse.json({ error: "Refresh token expired" }, { status: 401 });
        }

        if (!safeEqual(requestRefreshToken, user.refreshToken)) {
            return NextResponse.json({ error: "Invalid refresh token" }, { status: 401 });
        }

        const token = await generateToken(userId);
        const secure = process.env.NODE_ENV === "production";
        const response = NextResponse.json({ token });
        response.cookies.set("auth_token", token, {
            httpOnly: true,
            sameSite: "strict",
            secure,
            maxAge: AUTH_ACCESS_TOKEN_MAX_AGE_SEC,
            path: "/"
        });
        return response;
    } catch (error) {
        console.error("Refresh error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
