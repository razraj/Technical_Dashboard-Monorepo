"use client";
import { LoginForm } from "@/components/login-form";
import { AuthGuard } from "@/components/auth-guard";

/**
 * Login page - protected from authenticated users
 * Uses centralized AuthGuard component for authentication check
 */
export default function Page() {
    return (
        <AuthGuard requireUnauthenticated={true}>
            <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
                <div className="w-full max-w-sm">
                    <LoginForm />
                </div>
            </div>
        </AuthGuard>
    );
}
