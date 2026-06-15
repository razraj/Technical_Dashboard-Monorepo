"use client";

import { useForm } from "@tanstack/react-form-nextjs";
import { AppSidebar } from "@/components/app-sidebar";
import { AuthGuard } from "@/components/auth-guard";
import { FormFieldError } from "@/components/form-field-error";
import { useCurrentUser, useUpdateProfile, useChangePassword } from "@/hooks/use-user-queries";
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage } from "@repo/ui/components/breadcrumb";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/components/card";
import { Field, FieldGroup, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { Separator } from "@repo/ui/components/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@repo/ui/components/sidebar";
import { toast } from "@repo/ui/components";

function ProfileForm({
    userId,
    formKey,
    defaultValues,
}: {
    userId: string;
    formKey: string;
    defaultValues: { firstName: string; lastName: string; username: string };
}) {
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
            key={formKey}
            onSubmit={(e) => {
                e.preventDefault();
                void form.handleSubmit();
            }}
        >
            <FieldGroup>
                <form.Field
                    name="firstName"
                    validators={{ onChange: ({ value }) => (value.trim() ? undefined : "First name is required") }}
                >
                    {(field) => (
                        <Field>
                            <FieldLabel htmlFor="firstName">First Name</FieldLabel>
                            <Input
                                id="firstName"
                                value={field.state.value}
                                onChange={(e) => field.handleChange(e.target.value)}
                                placeholder="Enter your first name"
                            />
                            <FormFieldError errors={field.state.meta.errors} />
                        </Field>
                    )}
                </form.Field>
                <form.Field
                    name="lastName"
                    validators={{ onChange: ({ value }) => (value.trim() ? undefined : "Last name is required") }}
                >
                    {(field) => (
                        <Field>
                            <FieldLabel htmlFor="lastName">Last Name</FieldLabel>
                            <Input
                                id="lastName"
                                value={field.state.value}
                                onChange={(e) => field.handleChange(e.target.value)}
                                placeholder="Enter your last name"
                            />
                            <FormFieldError errors={field.state.meta.errors} />
                        </Field>
                    )}
                </form.Field>
                <form.Field
                    name="username"
                    validators={{
                        onChange: ({ value }) =>
                            value.trim().length >= 3 ? undefined : "Username must be at least 3 characters",
                    }}
                >
                    {(field) => (
                        <Field>
                            <FieldLabel htmlFor="username">Username</FieldLabel>
                            <Input
                                id="username"
                                value={field.state.value}
                                onChange={(e) => field.handleChange(e.target.value)}
                                placeholder="Enter your username"
                            />
                            <FormFieldError errors={field.state.meta.errors} />
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
                            <FormFieldError errors={field.state.meta.errors} />
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
                            <FormFieldError errors={field.state.meta.errors} />
                        </Field>
                    )}
                </form.Field>
                <form.Field
                    name="confirmPassword"
                    validators={{
                        onChangeListenTo: ["password"],
                        onChange: ({ value, fieldApi }) => {
                            const password = fieldApi.form.getFieldValue("password");
                            if (value && password && value !== password) {
                                return "Passwords do not match";
                            }
                            return value ? undefined : "Please confirm your password";
                        },
                    }}
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
                            <FormFieldError errors={field.state.meta.errors} />
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
    const { data: user, isLoading, isError, refetch } = useCurrentUser();

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
                                {isLoading ? (
                                    <p className="text-sm text-muted-foreground">Loading...</p>
                                ) : isError || !user ? (
                                    <div className="flex items-center gap-2">
                                        <p className="text-sm text-muted-foreground">Failed to load profile.</p>
                                        <Button type="button" variant="outline" size="sm" onClick={() => refetch()}>
                                            Try again
                                        </Button>
                                    </div>
                                ) : (
                                    <ProfileForm
                                        userId={user.id}
                                        formKey={`${user.id}-${user.updatedAt ?? ""}`}
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
                                {isLoading ? (
                                    <p className="text-sm text-muted-foreground">Loading...</p>
                                ) : isError || !user ? (
                                    <div className="flex items-center gap-2">
                                        <p className="text-sm text-muted-foreground">Failed to load profile.</p>
                                        <Button type="button" variant="outline" size="sm" onClick={() => refetch()}>
                                            Try again
                                        </Button>
                                    </div>
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
