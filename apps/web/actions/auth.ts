import { User, UserResponse } from "@/types";
import { fetchWithoutAuth } from "@/utils/api";
import { toast } from "@repo/ui/components";
import { clearUserFromLocalStorage } from "./auth-check";

export async function login(username: string, password: string): Promise<User> {
    const fetchPromise = fetchWithoutAuth("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
        credentials: "include"
    });
    toast.promise(fetchPromise, {
        loading: "Logging in...",
        success: "Logged in successfully",
        error: "Failed to log in",
        duration: 3000
    });

    const data = (await fetchPromise) as { user?: User; error?: string };

    if (!data.user?.id) {
        throw new Error(data.error ?? "Invalid credentials");
    }

    // Store the user in localStorage
    localStorage.setItem("user", JSON.stringify(data.user));
    window?.location?.replace?.("/dashboard");
    return data.user;
}

/**
 * Log out: call logout API (clears cookies), clear sessionStorage, redirect to login.
 * Use this for the logout button/link.
 */
export async function logout(): Promise<void> {
    try {
        await fetch("/api/auth/logout", {
            method: "POST",
            credentials: "include"
        });
    } catch (error) {
        console.error("Logout error:", error);
    } finally {
        await clearUserFromLocalStorage();
        window?.location?.replace?.("/login");
    }
}
