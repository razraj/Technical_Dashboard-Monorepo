"use client";

import { isAuthenticated } from "@/utils/auth";
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
 * Auth guard: uses server-verified token (auth_token cookie) as single source of truth.
 * - Auth routes (requireUnauthenticated): valid token → redirect to dashboard; no token/invalid → show page.
 * - Protected routes: valid token → show page; no token/invalid → redirect to login (and clear stale sessionStorage).
 */
export function AuthGuard({ children, requireUnauthenticated = false, redirectTo = "/login" }: AuthGuardProps) {
    const router = useRouter();
    const pathname = usePathname();
    const [isChecking, setIsChecking] = useState(true);
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [isRedirecting, setIsRedirecting] = useState(false);

    const checkAuth = useCallback(async () => {
        if (requireUnauthenticated) {
            // Do not rely on localStorage for auth routes. A stale user object can
            // cause login <-> dashboard redirect loops when cookies are expired.
            setIsRedirecting(false);
            setIsChecking(false);
            setIsAuthorized(true);
            return;
        } else {
            const authenticated = await isAuthenticated();
            if (authenticated) {
                setIsAuthorized(true);
                setIsChecking(false);
                return;
            } else {
                setIsAuthorized(false);
                setIsChecking(false);
                router.replace(redirectTo);
                return;
            }
        }
    }, [router, requireUnauthenticated, redirectTo]);

    useEffect(() => {
        setIsChecking(true);
        setIsRedirecting(false);
        checkAuth();
    }, [checkAuth, pathname]);

    if (isAuthorized) {
        return <>{children}</>;
    } else if (isChecking) {
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
}
