import { User } from "@/types";
import { fetchWithoutAuth } from "@/utils/api";
import { toast } from "@repo/ui/components";
import { clearUserFromLocalStorage } from "./auth-check";

export async function login(email: string, password: string) {
    const data = (await fetchWithoutAuth("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: email, password }),
        credentials: "include"
    })) as { user?: User };

    if (!data.user?.id) {
        throw new Error("Invalid credentials");
    }

    // Store the user in localStorage
    localStorage.setItem("user", JSON.stringify(data.user));
    toast.success("Logged in successfully");
    window?.location?.replace?.("/dashboard");
    return data;
}

export interface SignupPayload {
    email: string;
    password: string;
    username: string;
    firstName?: string;
    lastName?: string;
}

export async function signup(payload: SignupPayload): Promise<{ message: string; email: string }> {
    return (await fetchWithoutAuth("/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    })) as { message: string; email: string };
}

export async function forgotPassword(email: string): Promise<{ message: string }> {
    return (await fetchWithoutAuth("/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
    })) as { message: string };
}

/**
 * Log out: call logout API (clears cookies), clear localStorage, redirect to login.
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
