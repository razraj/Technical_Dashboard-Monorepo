import { User, UserResponse } from "@/types";
import { fetchWithAuth } from "@/utils/api";

export const getUsers = async (): Promise<UserResponse> =>
    fetchWithAuth(`/user`, { method: "GET" });

export const getCurrentUser = (): Promise<{ user: User }> =>
    fetchWithAuth(`/auth/me`, { method: "GET" });

export const updateProfile = (
    userId: string,
    data: { firstName?: string; lastName?: string; username?: string }
): Promise<{ message: string }> =>
    fetchWithAuth(`/user/${userId}`, {
        method: "PUT",
        body: JSON.stringify(data),
    });

export const changePassword = (
    userId: string,
    data: { oldPassword: string; password: string }
): Promise<{ message: string }> =>
    fetchWithAuth(`/user/${userId}/password`, {
        method: "PUT",
        body: JSON.stringify(data),
    });
