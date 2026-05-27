import { UserResponse } from "@/types";
import { fetchWithAuth } from "@/utils/api";
import { toast } from "@repo/ui/components";

export const getUsers = async (): Promise<UserResponse> => {
    const response = fetchWithAuth(`/user`, {
        method: "GET"
    });
    toast.promise(response, {
        error: "Failed to get users, please try again later",
        loading: "Loading users...",
        success: "Users loaded successfully"
    });
    return response;
};
