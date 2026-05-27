"use client";

import { AuthGuard } from "@/components/auth-guard";
import { SignupForm } from "@/components/signup-form";
import { GalleryVerticalEnd } from "lucide-react";

/**
 * Signup page - protected from authenticated users
 * Uses centralized AuthGuard component for authentication check
 */
export default function Page() {
    return (
        <AuthGuard requireUnauthenticated={true}>
            <div className="grid min-h-svh lg:grid-cols-2">
                <div className="flex flex-col gap-4 p-6 md:p-10">
                    <div className="flex justify-center gap-2 md:justify-start">
                        <a href="#" className="flex items-center gap-2 font-medium">
                            <div className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
                                <GalleryVerticalEnd className="size-4" />
                            </div>
                            Acme Inc.
                        </a>
                    </div>
                    <div className="flex flex-1 items-center justify-center">
                        <div className="w-full max-w-xs">
                            <SignupForm />
                        </div>
                    </div>
                </div>
                <div className="relative hidden bg-primary text-white lg:block">
                    <div className="flex h-full flex-col items-center justify-center p-10 text-left">
                        <h2 className="mb-4 w-full text-left text-3xl font-bold tracking-tight">ticktock</h2>

                        <p className="text-lg">
                            Build your team workspace in minutes and start tracking time with confidence.
                            Keep projects, tasks, and weekly timesheets in one place from day one.
                        </p>
                    </div>
                </div>
            </div>
        </AuthGuard>
    );
}
