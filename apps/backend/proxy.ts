import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "./utils/auth";

/**
 * Get auth_token from cookie header (value may contain "=" so we can't use split("=")[1])
 * @param cookieHeader - The cookie header to get the auth_token from
 * @returns auth_token or undefined if not found
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

// TODO: Check if "stage-app-cleanly.vercel.app" and "localhost:3001" are allowed to access the backend.
const allowedHosts = [
    ...(process.env.NODE_ENV === "production"
        ? ["ticktock-app.vercel.app", "ticktock-be.vercel.app"]
        : ["localhost:3000", "localhost:3001"])
];

/**
 * Proxy Handler Reference
 * For implementation details and usage, refer to:
 * https://nextjs.org/docs/app/api-reference/file-conventions/proxy
 */
export default async function proxy(request: NextRequest) {
    const pathname = request.nextUrl.pathname;
    const host = request.headers.get("host") ?? request.nextUrl.host;
    const origin = request.headers.get("origin") ?? request.nextUrl.origin ?? "";
    console.info("🚀 ~ proxy ~ pathname:", pathname);
    console.log("🚀 ~ proxy ~ host:", host);
    console.log("🚀 ~ proxy ~ origin:", origin);

    // allowed hosts check
    if (host && !allowedHosts.includes(host)) {
        return NextResponse.json({ error: "Invalid host" }, { status: 401 });
    }

    // Skip middleware for login route
    const publicAuthPaths = new Set([
        "/auth/login",
        "/auth/signup",
        "/auth/verify-email",
        "/auth/resend-verification",
        "/auth/oauth/google",
        "/auth/oauth/apple",
        "/auth/forgot-password",
        "/auth/reset-password",
        "/auth/refresh",
        "/auth/logout"
    ]);

    /**
     * Include paths that are public and don't require authentication,
     * including all routes under /webhooks/** and /queues/** so that they can be accessed by the web app or external services.
     */
    function isOtherPublicPath(pathname: string): boolean {
        if (pathname === "/" || pathname === "/contact") {
            return true;
        }
        // Match any path starting with /webhooks/ or /queues/
        if (pathname.startsWith("/webhooks/") || pathname.startsWith("/queues/")) {
            return true;
        }
        return false;
    }

    if (publicAuthPaths.has(pathname) || isOtherPublicPath(pathname)) {
        const response = NextResponse.next();
        response.headers.set("Access-Control-Allow-Origin", origin);
        return response;
    }

    const token = getAuthTokenFromCookie(request.headers.get("cookie"));
    if (!token) {
        const response = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        // response.headers.set("Access-Control-Allow-Origin", `${protocol}://${host}`);
        response.headers.set("Access-Control-Allow-Origin", origin);
        return response;
    }

    const payload = await verifyToken(token);

    if (!payload?.sub) {
        const response = NextResponse.json({ error: "Invalid token" }, { status: 401 });
        response.headers.set("Access-Control-Allow-Origin", origin);
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
    response.headers.set("Access-Control-Allow-Origin", origin);
    return response;
}

export const config = {
    matcher: "/:path*"
};
