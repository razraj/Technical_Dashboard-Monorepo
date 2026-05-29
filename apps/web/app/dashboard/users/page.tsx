"use client";

import { getUsers } from "@/actions/user";
import { AppSidebar } from "@/components/app-sidebar";
import { AuthGuard } from "@/components/auth-guard";
import { UserResponse, UserResponseDefault } from "@/types";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@repo/ui/components/card";
import { Avatar, AvatarFallback, AvatarImage } from "@repo/ui/components/avatar";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator
} from "@repo/ui/components/breadcrumb";
import { Skeleton } from "@repo/ui/components/skeleton";
import { Separator } from "@repo/ui/components/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@repo/ui/components/sidebar";
import { debounce } from "lodash";
import { Plus, User } from "lucide-react";
import { startTransition, useActionState, useEffect } from "react";

/**
 * Dashboard page - protected route requiring authentication
 * Uses centralized AuthGuard component for authentication check
 */
export default function Page() {
    const [state, action, pending] = useActionState<UserResponse>(getUsers, UserResponseDefault);

    // Load users when component mounts (after auth check passes)
    useEffect(() => {
        startTransition(action);
    }, [action]);

    return (
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
            {pending ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <Card key={i}>
                            <CardHeader className="flex flex-row items-center gap-4 space-y-0">
                                <Skeleton className="h-10 w-10 rounded-full" />
                                <div className="space-y-2">
                                    <Skeleton className="h-4 w-24" />
                                    <Skeleton className="h-3 w-32" />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <Skeleton className="h-4 w-full" />
                            </CardContent>
                            <CardFooter>
                                <Skeleton className="h-9 w-full" />
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            ) : state.users.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {state.users.map((user) => (
                        <Card key={user.id}>
                            <CardHeader className="flex flex-row items-center gap-4 space-y-0 pb-2">
                                <Avatar>
                                    <AvatarImage
                                        src={`https://avatar.vercel.sh/${user.email}`}
                                        alt={user.firstName ?? user.username ?? "User"}
                                    />
                                    <AvatarFallback>
                                        {(user.firstName || "User")
                                            .split(" ")
                                            .map((n) => n[0])
                                            .join("")
                                            .toUpperCase()
                                            .slice(0, 2)}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="flex flex-col">
                                    <CardTitle className="text-base">
                                        {user.firstName || user.username || "User"}
                                    </CardTitle>
                                    <CardDescription>{user.email ?? user.username}</CardDescription>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center justify-between text-sm text-muted-foreground">
                                    <div className="flex items-center">
                                        <div className="mr-2 h-2 w-2 rounded-full bg-green-500" />
                                        Active
                                    </div>
                                    <div className="text-xs">ID: {user.id.slice(0, 8)}</div>
                                </div>
                            </CardContent>
                            <CardFooter>
                                <Button variant="outline" className="w-full">
                                    View Profile
                                </Button>
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            ) : (
                <div className="flex h-[450px] shrink-0 items-center justify-center rounded-md border border-dashed">
                    <div className="mx-auto flex max-w-[420px] flex-col items-center justify-center text-center">
                        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
                            <User className="h-10 w-10 text-muted-foreground" />
                        </div>
                        <h3 className="mt-4 text-lg font-semibold">No users found</h3>
                        <p className="mb-4 mt-2 text-sm text-muted-foreground">
                            You have not added any users yet. Click the button above to fetch users.
                        </p>
                        <Button
                            onClick={debounce(() => {
                                startTransition(action);
                            }, 300)}
                            variant="outline"
                        >
                            Get Users
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
