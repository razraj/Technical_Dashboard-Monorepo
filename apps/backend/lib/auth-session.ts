import prisma from "@/lib/db";
import "dotenv/config";
import { SignJWT } from "jose";
import { NextResponse } from "next/server";

const SECRET_KEY = new TextEncoder().encode(process.env.JWT_SECRET!);

/** Access JWT lifetime and `auth_token` cookie max-age (seconds). */
export const AUTH_ACCESS_TOKEN_MAX_AGE_SEC = 120 * 60;

export const loginUserSelect = {
    id: true,
    username: true,
    email: true,
    firstName: true,
    lastName: true,
    profilePic: true,
    refreshToken: true,
    refreshTokenExp: true,
    emailVerified: true,
    password: true
} as const;

export async function signAuthPair(userId: string) {
    const token = await new SignJWT({})
        .setProtectedHeader({ alg: "HS256" })
        .setSubject(userId)
        .setIssuedAt()
        .setExpirationTime(`${AUTH_ACCESS_TOKEN_MAX_AGE_SEC}s`)
        .sign(SECRET_KEY);

    const refreshToken = await new SignJWT({})
        .setProtectedHeader({ alg: "HS256" })
        .setSubject(userId)
        .setIssuedAt()
        .setExpirationTime("1d")
        .sign(SECRET_KEY);

    return { token, refreshToken };
}

export function setAuthCookiesOnResponse(response: NextResponse, token: string, refreshToken: string) {
    const secure = process.env.NODE_ENV === "production";
    response.cookies.set("auth_token", token, {
        httpOnly: true,
        sameSite: "strict",
        secure,
        maxAge: AUTH_ACCESS_TOKEN_MAX_AGE_SEC,
        path: "/"
    });
    response.cookies.set("refresh_token", refreshToken, {
        httpOnly: true,
        sameSite: "strict",
        secure,
        maxAge: 60 * 60 * 24,
        path: "/api/auth/refresh"
    });
}

export async function completeLoginForUserId(userId: string) {
    const user = await prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: loginUserSelect
    });
    const { token, refreshToken } = await signAuthPair(userId);
    await prisma.user.update({
        where: { id: userId },
        data: {
            refreshToken,
            refreshTokenExp: new Date(Date.now() + 60 * 60 * 24 * 1000)
        }
    });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- omit password from JSON
    const { password, ...userWithoutPassword } = user;
    const response = NextResponse.json({
        token,
        refreshToken,
        user: userWithoutPassword
    });
    setAuthCookiesOnResponse(response, token, refreshToken);
    return response;
}
