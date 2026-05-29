"use client";
import { login } from "@/actions/auth";
import { AuthGuard } from "@/components/auth-guard";
import { LoginForm } from "@/components/login-form";
import { getSanitizedRedirectPath } from "@/utils/url";
import { GalleryVerticalEnd } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function LoginPageInner() {
    const router = useRouter();
    const searchParams = useSearchParams();

    // const [email, setEmail] = useState("carol@example.com");
    // const [password, setPassword] = useState("password123");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [done, setDone] = useState(false);

    function getRedirect() {
        return searchParams.get("redirect")?.trim() ?? "/";
    }

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);
        const redirect = getSanitizedRedirectPath(getRedirect());
        console.log("🚀 ~ handleSubmit ~ redirect:", redirect);

        const form = e.currentTarget;
        const email = (form.querySelector("#email") as HTMLInputElement | null)?.value ?? "";
        const password = (form.querySelector("#password") as HTMLInputElement | null)?.value ?? "";

        try {
            const res = await login(email, password);
            if (!res.id) {
                throw new Error("Something went wrong");
            }
            setDone(true);
            setTimeout(() => router.replace(redirect), 1000);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to log in");
        } finally {
            setIsLoading(false);
        }
    };

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
                            <LoginForm onSubmit={handleSubmit} />
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

export default function Page() {
    return (
        <Suspense>
            <LoginPageInner />
        </Suspense>
    );
}
