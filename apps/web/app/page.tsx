"use client";

import { checkAuthStatus } from "@/actions/auth-check";
import { PageSpinner } from "@/components/page-spinner";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Root page — redirects to dashboard when session is valid, otherwise to login.
 */
export default function Page() {
    const router = useRouter();
    const [checking, setChecking] = useState(true);

    useEffect(() => {
        checkAuthStatus()
            .then((authenticated) => {
                router.replace(authenticated ? "/dashboard" : "/login");
            })
            .finally(() => setChecking(false));
    }, [router]);

    if (checking) {
        return <PageSpinner className="min-h-svh" label="Redirecting" />;
    }

    return null;
}
