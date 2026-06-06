"use client";

import { useEffect } from "react";
import { useForm } from "@tanstack/react-form-nextjs";
import { AppSidebar } from "@/components/app-sidebar";
import { AuthGuard } from "@/components/auth-guard";
import { useCurrentUser, useUpdateProfile, useChangePassword } from "@/hooks/use-user-queries";
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage } from "@repo/ui/components/breadcrumb";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/components/card";
import { Field, FieldGroup, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { Separator } from "@repo/ui/components/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@repo/ui/components/sidebar";
import { toast } from "@repo/ui/components";

function ProfileForm({ userId, defaultValues }: { userId: string; defaultValues: { firstName: string; lastName: string; username: string } }) {
    const updateProfile = useUpdateProfile();

    const form = useForm({
        defaultValues,
        onSubmit: async ({ value }) => {
            try {
                await updateProfile.mutateAsync({ userId, data: value });
                toast.success("Profile updated");
            } catch (error) {
                toast.error(error instanceof Error ? error.message : "Failed to update profile");
            }
        },
    });

    return (
        <form
            onSubmit={(e) => {
                e.preventDefault();
                void form.handleSubmit();
            }}
        >
            <FieldGroup>
                <form.Field name="firstName">
                    {(field) => (
                        <Field>
                            <FieldLabel htmlFor="firstName">First Name</FieldLabel>
                            <Input
                                id="firstName"
                                value={field.state.value}
                                onChange={(e) => field.handleChange(e.target.value)}
                                placeholder="Enter your first name"
                            />
                        </Field>
                    )}
                </form.Field>
                <form.Field name="lastName">
                    {(field) => (
                        <Field>
                            <FieldLabel htmlFor="lastName">Last Name</FieldLabel>
                            <Input
                                id="lastName"
                                value={field.state.value}
                                onChange={(e) => field.handleChange(e.target.value)}
                                placeholder="Enter your last name"
                            />
                        </Field>
                    )}
                </form.Field>
                <form.Field name="username">
                    {(field) => (
                        <Field>
                            <FieldLabel htmlFor="username">Username</FieldLabel>
                            <Input
                                id="username"
                                value={field.state.value}
                                onChange={(e) => field.handleChange(e.target.value)}
                                placeholder="Enter your username"
                            />
                        </Field>
                    )}
                </form.Field>
            </FieldGroup>
            <div className="mt-4 flex justify-end">
                <form.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting]}>
                    {([canSubmit, isSubmitting]) => (
                        <Button type="submit" disabled={!canSubmit || updateProfile.isPending}>
                            {isSubmitting || updateProfile.isPending ? "Saving..." : "Save Changes"}
                        </Button>
                    )}
                </form.Subscribe>
            </div>
        </form>
    );
}

function ChangePasswordForm({ userId }: { userId: string }) {
    const changePassword = useChangePassword();

    const form = useForm({
        defaultValues: { oldPassword: "", password: "", confirmPassword: "" },
        onSubmit: async ({ value }) => {
            if (value.password !== value.confirmPassword) {
                toast.error("Passwords do not match");
                return;
            }
            try {
                await changePassword.mutateAsync({
                    userId,
                    data: { oldPassword: value.oldPassword, password: value.password },
                });
                toast.success("Password changed");
                form.reset();
            } catch (error) {
                toast.error(error instanceof Error ? error.message : "Failed to change password");
            }
        },
    });

    return (
        <form
            onSubmit={(e) => {
                e.preventDefault();
                void form.handleSubmit();
            }}
        >
            <FieldGroup>
                <form.Field
                    name="oldPassword"
                    validators={{ onChange: ({ value }) => (value ? undefined : "Current password is required") }}
                >
                    {(field) => (
                        <Field>
                            <FieldLabel htmlFor="oldPassword">Current Password</FieldLabel>
                            <Input
                                id="oldPassword"
                                type="password"
                                value={field.state.value}
                                onChange={(e) => field.handleChange(e.target.value)}
                                placeholder="••••••••"
                            />
                        </Field>
                    )}
                </form.Field>
                <form.Field
                    name="password"
                    validators={{ onChange: ({ value }) => (value.length >= 8 ? undefined : "Must be at least 8 characters") }}
                >
                    {(field) => (
                        <Field>
                            <FieldLabel htmlFor="newPassword">New Password</FieldLabel>
                            <Input
                                id="newPassword"
                                type="password"
                                value={field.state.value}
                                onChange={(e) => field.handleChange(e.target.value)}
                                placeholder="••••••••"
                            />
                        </Field>
                    )}
                </form.Field>
                <form.Field
                    name="confirmPassword"
                    validators={{ onChange: ({ value }) => (value ? undefined : "Please confirm your password") }}
                >
                    {(field) => (
                        <Field>
                            <FieldLabel htmlFor="confirmPassword">Confirm New Password</FieldLabel>
                            <Input
                                id="confirmPassword"
                                type="password"
                                value={field.state.value}
                                onChange={(e) => field.handleChange(e.target.value)}
                                placeholder="••••••••"
                            />
                        </Field>
                    )}
                </form.Field>
            </FieldGroup>
            <div className="mt-4 flex justify-end">
                <form.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting]}>
                    {([canSubmit, isSubmitting]) => (
                        <Button type="submit" disabled={!canSubmit || changePassword.isPending}>
                            {isSubmitting || changePassword.isPending ? "Updating..." : "Change Password"}
                        </Button>
                    )}
                </form.Subscribe>
            </div>
        </form>
    );
}

export default function SettingsPage() {
    const { data: user, isLoading } = useCurrentUser();

    return (
        <AuthGuard requireUnauthenticated={false}>
            <SidebarProvider>
                <AppSidebar />
                <SidebarInset>
                    <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
                        <div className="flex items-center gap-2 px-4">
                            <SidebarTrigger className="-ml-1" />
                            <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
                            <Breadcrumb>
                                <BreadcrumbList>
                                    <BreadcrumbItem>
                                        <BreadcrumbPage>Settings</BreadcrumbPage>
                                    </BreadcrumbItem>
                                </BreadcrumbList>
                            </Breadcrumb>
                        </div>
                    </header>

                    <div className="flex flex-1 flex-col gap-6 p-6 max-w-2xl">
                        <Card>
                            <CardHeader>
                                <CardTitle>Profile</CardTitle>
                                <CardDescription>Update your display name and username.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {isLoading || !user ? (
                                    <p className="text-sm text-muted-foreground">Loading...</p>
                                ) : (
                                    <ProfileForm
                                        userId={user.id}
                                        defaultValues={{
                                            firstName: user.firstName ?? "",
                                            lastName: user.lastName ?? "",
                                            username: user.username ?? "",
                                        }}
                                    />
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Change Password</CardTitle>
                                <CardDescription>Enter your current password and choose a new one.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {!user ? (
                                    <p className="text-sm text-muted-foreground">Loading...</p>
                                ) : (
                                    <ChangePasswordForm userId={user.id} />
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </SidebarInset>
            </SidebarProvider>
        </AuthGuard>
    );
}
