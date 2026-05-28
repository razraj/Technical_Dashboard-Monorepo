"use client";

import { fetchWithoutAuth } from "@/utils/api";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/components/card";
import { Field, FieldGroup, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { cn } from "@repo/ui/lib/utils";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export function ResetPasswordForm({ className, ...props }: React.ComponentProps<"div">) {
    const searchParams = useSearchParams();
    const router = useRouter();
    const token = searchParams.get("token")?.trim() ?? "";

    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [done, setDone] = useState(false);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError(null);
        if (password !== confirm) {
            setError("Passwords do not match");
            return;
        }
        if (!token) {
            setError("Missing reset token. Open the link from your email.");
            return;
        }
        setIsLoading(true);
        try {
            await fetchWithoutAuth("/auth/reset-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, password })
            });
            setDone(true);
            setTimeout(() => router.replace("/login"), 2000);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Could not reset password");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className={cn("flex flex-col gap-6", className)} {...props}>
            <Card>
                <CardHeader>
                    <CardTitle>Set a new password</CardTitle>
                    <CardDescription>Choose a strong password you haven&apos;t used elsewhere.</CardDescription>
                </CardHeader>
                <CardContent>
                    {!token ? (
                        <div className="space-y-4 text-sm text-muted-foreground">
                            <p>This page needs a valid reset link from your email. Request a new link from the login page.</p>
                            <Button asChild variant="outline" className="w-full">
                                <Link href="/forgot-password">Forgot password</Link>
                            </Button>
                            <Button asChild variant="ghost" className="w-full">
                                <Link href="/login">Back to login</Link>
                            </Button>
                        </div>
                    ) : done ? (
                        <p className="text-sm text-muted-foreground">
                            Your password has been updated. Redirecting to login…
                        </p>
                    ) : (
                        <form onSubmit={handleSubmit}>
                            <FieldGroup>
                                <Field>
                                    <FieldLabel htmlFor="new-password">New password</FieldLabel>
                                    <Input
                                        id="new-password"
                                        type="password"
                                        autoComplete="new-password"
                                        required
                                        minLength={8}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                    />
                                </Field>
                                <Field>
                                    <FieldLabel htmlFor="confirm-password">Confirm password</FieldLabel>
                                    <Input
                                        id="confirm-password"
                                        type="password"
                                        autoComplete="new-password"
                                        required
                                        minLength={8}
                                        value={confirm}
                                        onChange={(e) => setConfirm(e.target.value)}
                                    />
                                </Field>
                                {error && (
                                    <Field>
                                        <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
                                            {error}
                                        </div>
                                    </Field>
                                )}
                                <Field className="flex flex-col gap-2">
                                    <Button type="submit" disabled={isLoading}>
                                        {isLoading ? "Saving…" : "Update password"}
                                    </Button>
                                    <Button asChild variant="ghost" type="button" className="w-full">
                                        <Link href="/login">Back to login</Link>
                                    </Button>
                                </Field>
                            </FieldGroup>
                        </form>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
