"use client";

import { AuthGuard } from "@/components/auth-guard";
import { ResetPasswordForm } from "@/components/reset-password-form";
import { Suspense } from "react";

function ResetFallback() {
    return (
        <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
            <div className="text-sm text-muted-foreground">Loading…</div>
        </div>
    );
}

export default function ResetPasswordPage() {
    return (
        <AuthGuard requireUnauthenticated={true}>
            <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
                <div className="w-full max-w-sm">
                    <Suspense fallback={<ResetFallback />}>
                        <ResetPasswordForm />
                    </Suspense>
                </div>
            </div>
        </AuthGuard>
    );
}
