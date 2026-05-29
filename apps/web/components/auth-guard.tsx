"use client";

import { checkAuthStatus, clearUserFromLocalStorage } from "@/actions/auth-check";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

interface AuthGuardProps {
    children: React.ReactNode;
    /**
     * Auth route: if true, only unauthenticated users can see the page (e.g. login/signup).
     * Authenticated users are redirected to redirectIfAuthenticated.
     */
    requireUnauthenticated?: boolean;
    /**
     * Where to send unauthenticated users from protected routes (default: /login)
     */
    redirectTo?: string;
    /**
     * Where to send authenticated users from auth routes (default: /dashboard)
     */
    redirectIfAuthenticated?: string;
}

/**
 * Auth guard: validates session via GET /api/auth/me (cookie is source of truth).
 * - Auth routes: valid session → redirect away; invalid → show page (clears stale cache).
 * - Protected routes: valid session → show page; invalid → redirect to login.
 */
export function AuthGuard({
    children,
    requireUnauthenticated = false,
    redirectTo = "/login",
    redirectIfAuthenticated = "/dashboard"
}: AuthGuardProps) {
    const router = useRouter();
    const pathname = usePathname();
    const [isChecking, setIsChecking] = useState(true);
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [isRedirecting, setIsRedirecting] = useState(false);

    const checkAuth = useCallback(async () => {
        const authenticated = await checkAuthStatus();

        if (requireUnauthenticated) {
            if (authenticated) {
                setIsRedirecting(true);
                setIsChecking(false);
                setIsAuthorized(false);
                router.replace(redirectIfAuthenticated);
                return;
            }
            setIsRedirecting(false);
            setIsChecking(false);
            setIsAuthorized(true);
            return;
        }

        if (authenticated) {
            setIsAuthorized(true);
            setIsChecking(false);
            return;
        }

        await clearUserFromLocalStorage();
        setIsAuthorized(false);
        setIsChecking(false);
        setIsRedirecting(true);
        const returnPath = pathname + (typeof window !== "undefined" ? window.location.search : "");
        const loginUrl =
            returnPath && returnPath !== "/login"
                ? `${redirectTo}?redirect=${encodeURIComponent(returnPath)}`
                : redirectTo;
        router.replace(loginUrl);
    }, [router, pathname, requireUnauthenticated, redirectTo, redirectIfAuthenticated]);

    useEffect(() => {
        setIsChecking(true);
        setIsRedirecting(false);
        checkAuth();
    }, [checkAuth, pathname]);

    if (isAuthorized) {
        return <>{children}</>;
    }

    if (!isChecking && !isRedirecting) {
        return null;
    }

    return (
        <div className="flex items-center justify-center min-h-svh">
            <div className="flex flex-col items-center justify-center gap-4">
                <div className="text-muted-foreground">
                    {isRedirecting ? "Redirecting..." : "Checking authentication..."}
                </div>
            </div>
        </div>
    );
}
