import prisma from "@/lib/db";
import bcrypt from "bcryptjs";
import { SignJWT } from "jose";
import { NextResponse } from "next/server";

const SECRET_KEY = new TextEncoder().encode(process.env.JWT_SECRET);

function isEmail(username: string) {
    // Basic email regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (emailRegex.test(username)) {
        return true;
    }
    return false;
}

export async function POST(request: Request) {
    try {
        const { username, password } = await request.json();
        const emailCheck = isEmail(username);
        const whereClause = emailCheck ? { email: username } : { username: username };
        const user = await prisma.user.findUnique({
            where: whereClause,
            select: {
                id: true,
                username: true,
                email: true,
                firstName: true,
                lastName: true,
                profilePic: true,
                password: true,
                refreshToken: true,
                refreshTokenExp: true
            }
        });

        if (!user || !bcrypt.compareSync(password, user.password)) {
            return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
        }
        const token = await new SignJWT({})
            .setProtectedHeader({ alg: "HS256" })
            .setSubject(user.id)
            .setIssuedAt()
            .setExpirationTime("15m")
            .sign(SECRET_KEY);

        const refreshToken = await new SignJWT({})
            .setProtectedHeader({ alg: "HS256" })
            .setSubject(user.id)
            .setIssuedAt()
            .setExpirationTime("1d")
            .sign(SECRET_KEY);

        const userWithoutPassword = {
            id: user.id,
            username: user.username,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            profilePic: user.profilePic,
            refreshToken: user.refreshToken,
            refreshTokenExp: user.refreshTokenExp
        };
        const secure = process.env.NODE_ENV === "production";
        const response = NextResponse.json({
            token,
            refreshToken,
            user: userWithoutPassword
        });
        response.cookies.set("auth_token", token, {
            httpOnly: true,
            sameSite: "strict",
            secure,
            maxAge: 15 * 60,
            path: "/"
        });
        response.cookies.set("refresh_token", refreshToken, {
            httpOnly: true,
            sameSite: "strict",
            secure,
            maxAge: 60 * 60 * 24, // 1 day
            path: "/api/auth/refresh"
        });
        await prisma.user.update({
            where: { id: user.id },
            data: {
                refreshToken,
                refreshTokenExp: new Date(Date.now() + 60 * 60 * 24 * 1000) // 1 day
            }
        });
        return response;
    } catch (error) {
        console.error("Login error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
