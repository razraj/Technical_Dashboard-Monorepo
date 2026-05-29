"use client";

import { Button } from "@repo/ui/components/button";
import { useRouter } from "next/navigation";

/**
 * Root page - redirects based on authentication status.
 * If user is logged in → dashboard, else → login.
 */
export default function Page() {
    const router = useRouter();

    return (
        <div className="flex items-center justify-center min-h-svh">
            <div className="flex flex-col items-center justify-center gap-4 w-full max-w-full">
                <Button variant="outline" type="button" onClick={() => router.replace("/login")}>
                    Login
                </Button>
            </div>
       
        </div>
    );
}
