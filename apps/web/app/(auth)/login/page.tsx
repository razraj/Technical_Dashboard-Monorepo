"use client";
import { AuthGuard } from "@/components/auth-guard";
import { LoginForm } from "@/components/login-form";
import { GalleryVerticalEnd } from "lucide-react";

/**
 * Login page - protected from authenticated users.
 * Uses centralized AuthGuard component for authentication check.
 * Submission, loading, and error handling live in LoginForm.
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
                            ticktock
                        </a>
                    </div>
                    <div className="flex flex-1 items-center justify-center">
                        <div className="w-full max-w-xs">
                            <LoginForm />
                        </div>
                    </div>
                </div>
                <div className="relative hidden bg-primary lg:block text-white">
                    <div className="flex h-full flex-col items-center justify-center p-10 text-left">
                        <h2 className="mb-4 text-3xl font-bold tracking-tight text-left w-full">ticktock</h2>
                        <p className="text-lg">
                            Introducing ticktock, our cutting-edge timesheet web application designed to revolutionize
                            the way you manage employee work hours. Effortlessly track and monitor attendance and
                            productivity from anywhere, anytime.
                        </p>
                    </div>
                </div>
            </div>
        </AuthGuard>
    );
}
