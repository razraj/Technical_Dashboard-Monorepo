"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    createEntry,
    deleteEntry,
    EntryPayload,
    getProjects,
    getWeekDetail,
    getWeeks,
    updateEntry,
} from "@/actions/timesheet";
import { queryKeys } from "@/lib/query-keys";

export function useWeeks(page: number, pageSize: number) {
    return useQuery({
        queryKey: queryKeys.weeks.list(page, pageSize),
        queryFn: () => getWeeks(page, pageSize),
    });
}

export function useWeekDetail(weekStart: string) {
    return useQuery({
        queryKey: queryKeys.weeks.detail(weekStart),
        queryFn: () => getWeekDetail(weekStart),
    });
}

export function useProjects(enabled = true) {
    return useQuery({
        queryKey: queryKeys.projects.all,
        queryFn: getProjects,
        enabled,
    });
}

export function useCreateEntry(weekStart: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: createEntry,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.weeks.detail(weekStart) });
            queryClient.invalidateQueries({ queryKey: queryKeys.weeks.all });
        },
    });
}

export function useUpdateEntry(weekStart: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ entryId, payload }: { entryId: string; payload: Partial<EntryPayload> }) =>
            updateEntry(entryId, payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.weeks.detail(weekStart) });
            queryClient.invalidateQueries({ queryKey: queryKeys.weeks.all });
        },
    });
}

export function useDeleteEntry(weekStart: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: deleteEntry,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.weeks.detail(weekStart) });
            queryClient.invalidateQueries({ queryKey: queryKeys.weeks.all });
        },
    });
}
