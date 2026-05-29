"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { User } from "@/types";
import { Button } from "@repo/ui/components/button";
import Link from "next/link";

function VerifyEmailInner() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const token = searchParams.get("token")?.trim() ?? "";
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!token) {
            setError("Missing verification token. Open the link from your email.");
            return;
        }

        let cancelled = false;

        (async () => {
            try {
                const res = await fetch(
                    `/api/auth/verify-email?token=${encodeURIComponent(token)}`,
                    { credentials: "include" }
                );
                const data = (await res.json().catch(() => ({}))) as {
                    user?: User;
                    error?: string;
                };
                if (cancelled) return;

                if (!res.ok) {
                    setError(data.error ?? "Invalid or expired verification link");
                    return;
                }

                if (data.user?.id) {
                    localStorage.setItem("user", JSON.stringify(data.user));
                }
                router.replace("/dashboard");
            } catch {
                if (!cancelled) {
                    setError("Could not verify your email. Try again or request a new link.");
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [token, router]);

    if (!token || error) {
        return (
            <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
                <h1 className="text-2xl font-bold">Email verification</h1>
                <p className="max-w-sm text-sm text-muted-foreground">
                    {error ?? "This page needs a valid link from your email."}
                </p>
                <Button asChild variant="outline">
                    <Link href="/login">Back to login</Link>
                </Button>
            </div>
        );
    }

    return (
        <div className="flex min-h-svh items-center justify-center text-sm text-muted-foreground">
            Verifying your email…
        </div>
    );
}

export default function Page() {
    return (
        <Suspense
            fallback={
                <div className="flex min-h-svh items-center justify-center text-sm text-muted-foreground">
                    Loading…
                </div>
            }
        >
            <VerifyEmailInner />
        </Suspense>
    );
}
