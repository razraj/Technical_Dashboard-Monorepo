import prisma from "@/lib/db";
import { jwtVerify, SignJWT } from "jose";
import { NextRequest, NextResponse } from "next/server";

const SECRET_KEY = new TextEncoder().encode(process.env.JWT_SECRET);

const generateToken = (userId: string) => {
    return new SignJWT({})
        .setProtectedHeader({ alg: "HS256" })
        .setSubject(userId)
        .setIssuedAt()
        .setExpirationTime("15m")
        .sign(SECRET_KEY);
};

async function verifyToken(token: string) {
    try {
        const { payload } = await jwtVerify(token, SECRET_KEY);
        return payload;
    } catch {
        return null;
    }
}

export async function POST(req: NextRequest) {
    try {
        const requestRefreshToken = req.cookies.get("refresh_token")?.value;
        if (!requestRefreshToken) {
            return NextResponse.json({ message: "Invalid refresh token" }, { status: 401 });
        }

        const payload = await verifyToken(requestRefreshToken);
        if (!payload) {
            return NextResponse.json({ message: "Invalid refresh token" }, { status: 401 });
        }
        const userId = payload.sub;
        if (!userId) {
            return NextResponse.json({ message: "Invalid refresh token" }, { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                refreshToken: true,
                refreshTokenExp: true
            }
        });

        if (!user || !user.refreshTokenExp || user.refreshTokenExp < new Date()) {
            return NextResponse.json({ message: "Refresh token expired" }, { status: 401 });
        }
        if (user.refreshToken !== requestRefreshToken) {
            return NextResponse.json({ message: "Invalid refresh token" }, { status: 401 });
        }

        const token = await generateToken(userId);
        const secure = process.env.NODE_ENV === "production";
        const response = NextResponse.json({ token });
        response.cookies.set("auth_token", token, {
            httpOnly: true,
            sameSite: "strict",
            secure,
            maxAge: 60 * 15, // 15min
            path: "/"
        });
        return response;
    } catch (error) {
        console.log("Error fetching user", error);
        return NextResponse.json({ message: "Error fetching user" }, { status: 500 });
    }
}
