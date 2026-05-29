"use client";

import { getUsers } from "@/actions/user";
import { AppSidebar } from "@/components/app-sidebar";
import { AuthGuard } from "@/components/auth-guard";
import { UserResponse, UserResponseDefault } from "@/types";
import { Avatar, AvatarFallback, AvatarImage } from "@repo/ui/components/avatar";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator
} from "@repo/ui/components/breadcrumb";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@repo/ui/components/card";
import { Separator } from "@repo/ui/components/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@repo/ui/components/sidebar";
import { Skeleton } from "@repo/ui/components/skeleton";
import { debounce } from "lodash";
import { Plus, User } from "lucide-react";
import { startTransition, useActionState, useEffect } from "react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const [state, action, pending] = useActionState<UserResponse>(getUsers, UserResponseDefault);

    // Load users when component mounts (after auth check passes)
    useEffect(() => {
        startTransition(action);
    }, [action]);

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
                                    <BreadcrumbItem className="hidden md:block">
                                        <BreadcrumbLink href="#">Dashboard</BreadcrumbLink>
                                    </BreadcrumbItem>
                                    <BreadcrumbSeparator className="hidden md:block" />
                                    <BreadcrumbItem>
                                        <BreadcrumbPage>Users</BreadcrumbPage>
                                    </BreadcrumbItem>
                                </BreadcrumbList>
                            </Breadcrumb>
                        </div>
                    </header>
                    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
                        <div className="flex items-center justify-between space-y-2">
                            <div>
                                <h2 className="text-2xl font-bold tracking-tight">Users</h2>
                                <p className="text-muted-foreground">Manage your team members and their permissions.</p>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Button
                                    onClick={debounce(() => {
                                        startTransition(action);
                                    }, 300)}
                                    disabled={pending}
                                >
                                    {pending ? "Loading..." : "Get Users"}
                                </Button>
                                <Button variant="outline" size="icon">
                                    <Plus className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>

                      {children}
                    </div>
                </SidebarInset>
            </SidebarProvider>
        </AuthGuard>
    );
}
