import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "./utils/auth";

/**
 * Get auth_token from cookie header (value may contain "=" so we can't use split("=")[1])
 */
function getAuthTokenFromCookie(cookieHeader: string | null): string | undefined {
    if (!cookieHeader) return undefined;
    const authCookie = cookieHeader
        .split(";")
        .map((c) => c.trim())
        .find((c) => c.startsWith("auth_token="));
    if (!authCookie) return undefined;
    return authCookie.slice("auth_token=".length).trim();
}

const allowedHosts = [
    ...(process.env.NODE_ENV === "production"
        ? ["app.production.com"]
        : ["localhost:3000", "localhost:3001", "app.development.com", "stage.development.com"])
];

export default async function proxy(request: NextRequest) {
    const host = request.nextUrl.host;
    const protocol = process.env.NEXT_PUBLIC_NODE_ENV === "production" ? "https" : request.nextUrl.protocol;
    const pathname = request.nextUrl.pathname;
    console.log("🚀 ~ proxy ~ host:", host);
    console.log("🚀 ~ proxy ~ protocol:", protocol);
    console.log("🚀 ~ proxy ~ pathname:", pathname);
    // allowed hosts check
    if (host && !allowedHosts.includes(host)) {
        return NextResponse.json({ error: "Invalid host" }, { status: 401 });
    }

    // Skip proxy for public auth routes
    if (
        ["/auth/login", "/auth/signup", "/auth/forgot-password", "/auth/reset-password", "/auth/refresh"].includes(
            pathname
        )
    ) {
        const response = NextResponse.next();
        response.headers.set("Access-Control-Allow-Origin", `${protocol}://${host}`);
        return response;
    }

    const token = getAuthTokenFromCookie(request.headers.get("cookie"));

    if (!token) {
        const response = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        response.headers.set("Access-Control-Allow-Origin", `${protocol}://${host}`);
        return response;
    }

    const payload = await verifyToken(token);

    if (!payload?.sub) {
        const response = NextResponse.json({ error: "Invalid token" }, { status: 401 });
        response.headers.set("Access-Control-Allow-Origin", `${protocol}://${host}`);
        return response;
    }

    const userId = payload.sub;

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-user-id", userId);

    const response = NextResponse.next({
        request: {
            headers: requestHeaders
        }
    });
    response.headers.set("Access-Control-Allow-Origin", `${protocol}://${host}`);
    return response;
}

export const config = {
    matcher: "/:path*"
};
