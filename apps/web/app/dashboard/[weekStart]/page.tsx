"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { AppSidebar } from "@/components/app-sidebar";
import { AuthGuard } from "@/components/auth-guard";
import { WeeksTimesheet } from "@/components/weeks_timesheet";
import { getWeekDetail } from "@/actions/timesheet";
import { WeekDetail } from "@/types";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator
} from "@repo/ui/components/breadcrumb";
import { Button } from "@repo/ui/components/button";
import { Separator } from "@repo/ui/components/separator";
import { Skeleton } from "@repo/ui/components/skeleton";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@repo/ui/components/sidebar";
import { toast } from "@repo/ui/components";

export default function Page({ params }: { params: Promise<{ weekStart: string }> }) {
    const { weekStart } = use(params);
    const [detail, setDetail] = useState<WeekDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const requestRef = useRef(0);

    const load = useCallback(() => {
        const token = ++requestRef.current;
        setLoading(true);
        setError(null);
        getWeekDetail(weekStart)
            .then((data) => {
                if (token !== requestRef.current) return;
                setDetail(data);
            })
            .catch((err) => {
                if (token !== requestRef.current) return;
                const message = err instanceof Error ? err.message : "Failed to load week";
                setError(message);
                toast.error(message);
            })
            .finally(() => {
                if (token === requestRef.current) setLoading(false);
            });
    }, [weekStart]);

    useEffect(() => {
        load();
    }, [load]);

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
                                        <BreadcrumbLink href="/dashboard">Timesheets</BreadcrumbLink>
                                    </BreadcrumbItem>
                                    <BreadcrumbSeparator className="hidden md:block" />
                                    <BreadcrumbItem>
                                        <BreadcrumbPage>{weekStart}</BreadcrumbPage>
                                    </BreadcrumbItem>
                                </BreadcrumbList>
                            </Breadcrumb>
                        </div>
                    </header>
                    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
                        <div>
                            <Button asChild variant="ghost" size="sm">
                                <Link href="/dashboard">
                                    <ArrowLeftIcon className="size-4" />
                                    Back to timesheets
                                </Link>
                            </Button>
                        </div>
                        {loading ? (
                            <div className="space-y-4 rounded-xl border bg-card p-6">
                                <Skeleton className="h-8 w-64" />
                                <Skeleton className="h-4 w-40" />
                                <Skeleton className="h-40 w-full" />
                            </div>
                        ) : error || !detail ? (
                            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed bg-card p-10 text-center">
                                <p className="text-sm text-muted-foreground">{error ?? "Week not found."}</p>
                                <Button variant="outline" size="sm" onClick={load}>
                                    Try again
                                </Button>
                            </div>
                        ) : (
                            <WeeksTimesheet detail={detail} onChanged={load} />
                        )}
                    </div>
                </SidebarInset>
            </SidebarProvider>
        </AuthGuard>
    );
}
