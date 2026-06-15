"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { changePassword, getCurrentUser, updateProfile } from "@/actions/user";
import { queryKeys } from "@/lib/query-keys";

export function useCurrentUser() {
    return useQuery({
        queryKey: queryKeys.user.me,
        queryFn: getCurrentUser,
        select: (data) => data.user,
    });
}

export function useUpdateProfile() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ userId, data }: { userId: string; data: { firstName?: string; lastName?: string; username?: string } }) =>
            updateProfile(userId, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.user.me });
        },
    });
}

export function useChangePassword() {
    return useMutation({
        mutationFn: ({ userId, data }: { userId: string; data: { oldPassword: string; password: string } }) =>
            changePassword(userId, data),
    });
}
