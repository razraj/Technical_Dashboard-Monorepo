"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    createEntry,
    deleteEntry,
    EntryPayload,
    getWeekDetail,
    getWeeks,
    updateEntry,
} from "@/actions/timesheet";
import { invalidateWeekCaches } from "@/lib/invalidate-week-caches";
import { queryKeys } from "@/lib/query-keys";
import { TimesheetScope } from "@/types";

export function useWeeks(page: number, pageSize: number, scope?: TimesheetScope) {
    return useQuery({
        queryKey: queryKeys.weeks.list(page, pageSize, scope),
        queryFn: () => getWeeks(page, pageSize, scope ? { scope } : undefined),
    });
}

export function useWeekDetail(weekStart: string, options?: { scope?: TimesheetScope; projectId?: string }) {
    return useQuery({
        queryKey: queryKeys.weeks.detail(weekStart, options?.scope, options?.projectId),
        queryFn: () => getWeekDetail(weekStart, options),
    });
}

export function useCreateEntry(weekStart: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: createEntry,
        onSuccess: () => {
            invalidateWeekCaches(queryClient, weekStart);
        },
    });
}

export function useUpdateEntry(weekStart: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ entryId, payload }: { entryId: string; payload: Partial<EntryPayload> }) =>
            updateEntry(entryId, payload),
        onSuccess: () => {
            invalidateWeekCaches(queryClient, weekStart);
        },
    });
}

export function useDeleteEntry(weekStart: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: deleteEntry,
        onSuccess: () => {
            invalidateWeekCaches(queryClient, weekStart);
        },
    });
}
