"use client";

import { useForm } from "@tanstack/react-form-nextjs";
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
    const [done, setDone] = useState(false);

    const form = useForm({
        defaultValues: {
            password: "",
            confirm: "",
        },
        onSubmit: async ({ value }) => {
            if (value.password !== value.confirm) {
                throw new Error("Passwords do not match");
            }
            if (!token) {
                throw new Error("Missing reset token. Open the link from your email.");
            }
            await fetchWithoutAuth("/auth/reset-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, password: value.password }),
            });
            setDone(true);
            setTimeout(() => router.replace("/login"), 2000);
        },
    });

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
                        <form
                            onSubmit={(event) => {
                                event.preventDefault();
                                void form.handleSubmit();
                            }}
                        >
                            <FieldGroup>
                                <form.Field
                                    name="password"
                                    validators={{
                                        onChange: ({ value }) =>
                                            value.length >= 8 ? undefined : "Password must be at least 8 characters",
                                    }}
                                >
                                    {(field) => (
                                        <Field>
                                            <FieldLabel htmlFor="new-password">New password</FieldLabel>
                                            <Input
                                                id="new-password"
                                                name={field.name}
                                                type="password"
                                                autoComplete="new-password"
                                                required
                                                minLength={8}
                                                value={field.state.value}
                                                onChange={(e) => field.handleChange(e.target.value)}
                                            />
                                            {field.state.meta.errors.length > 0 ? (
                                                <p className="text-sm text-destructive">
                                                    {field.state.meta.errors.join(", ")}
                                                </p>
                                            ) : null}
                                        </Field>
                                    )}
                                </form.Field>
                                <form.Field
                                    name="confirm"
                                    validators={{
                                        onChangeListenTo: ["password"],
                                        onChange: ({ value, fieldApi }) => {
                                            const password = fieldApi.form.getFieldValue("password");
                                            return value === password ? undefined : "Passwords do not match";
                                        },
                                    }}
                                >
                                    {(field) => (
                                        <Field>
                                            <FieldLabel htmlFor="confirm-password">Confirm password</FieldLabel>
                                            <Input
                                                id="confirm-password"
                                                name={field.name}
                                                type="password"
                                                autoComplete="new-password"
                                                required
                                                minLength={8}
                                                value={field.state.value}
                                                onChange={(e) => field.handleChange(e.target.value)}
                                            />
                                            {field.state.meta.errors.length > 0 ? (
                                                <p className="text-sm text-destructive">
                                                    {field.state.meta.errors.join(", ")}
                                                </p>
                                            ) : null}
                                        </Field>
                                    )}
                                </form.Field>
                                <form.Subscribe selector={(state) => state.errorMap.onSubmit}>
                                    {(submitError) =>
                                        submitError ? (
                                            <Field>
                                                <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
                                                    {String(submitError)}
                                                </div>
                                            </Field>
                                        ) : null
                                    }
                                </form.Subscribe>
                                <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
                                    {([canSubmit, isSubmitting]) => (
                                        <Field className="flex flex-col gap-2">
                                            <Button type="submit" disabled={!canSubmit || isSubmitting}>
                                                {isSubmitting ? "Saving…" : "Update password"}
                                            </Button>
                                            <Button asChild variant="ghost" type="button" className="w-full">
                                                <Link href="/login">Back to login</Link>
                                            </Button>
                                        </Field>
                                    )}
                                </form.Subscribe>
                            </FieldGroup>
                        </form>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
