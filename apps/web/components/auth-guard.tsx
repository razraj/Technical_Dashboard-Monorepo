"use client";

import { checkAuthStatus, clearUserFromLocalStorage } from "@/actions/auth-check";
import { PageSpinner } from "@/components/page-spinner";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useState } from "react";

function hasCachedUser(): boolean {
    if (typeof window === "undefined") return false;
    try {
        const user = JSON.parse(localStorage.getItem("user") || "{}") as { id?: string };
        return Boolean(user?.id);
    } catch {
        return false;
    }
}

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
    const [isChecking, setIsChecking] = useState(!requireUnauthenticated);
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [isRedirecting, setIsRedirecting] = useState(false);

    // After login, localStorage is populated before navigation — show app shell immediately.
    useLayoutEffect(() => {
        if (!requireUnauthenticated && hasCachedUser()) {
            setIsAuthorized(true);
        }
    }, [requireUnauthenticated]);

    const checkAuth = useCallback(async () => {
        try {
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
        } catch {
            if (requireUnauthenticated) {
                setIsRedirecting(false);
                setIsChecking(false);
                setIsAuthorized(true);
                return;
            }
            await clearUserFromLocalStorage();
            setIsAuthorized(false);
            setIsChecking(false);
            setIsRedirecting(true);
            router.replace(redirectTo);
        }
    }, [router, pathname, requireUnauthenticated, redirectTo, redirectIfAuthenticated]);

    useEffect(() => {
        if (!requireUnauthenticated) {
            setIsChecking(true);
        }
        setIsRedirecting(false);
        checkAuth();
    }, [checkAuth, pathname, requireUnauthenticated]);

    if (isAuthorized) {
        return <>{children}</>;
    }

    // Auth routes (login): keep the page visible while checking; spinner only when leaving.
    if (requireUnauthenticated) {
        if (isRedirecting) {
            return <PageSpinner className="min-h-svh" label="Redirecting" />;
        }
        return <>{children}</>;
    }

    if (!isChecking && !isRedirecting) {
        return null;
    }

    return <PageSpinner className="min-h-svh" label={isRedirecting ? "Redirecting" : "Loading"} />;
}
