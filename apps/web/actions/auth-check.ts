import { User } from "@/types";

/**
 * Validate session via auth cookies (GET /auth/me). Updates localStorage cache on success.
 * Clears stale localStorage when the session is invalid.
 */
export async function fetchSession(): Promise<User | null> {
    try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        if (!res.ok) {
            await clearUserFromLocalStorage();
            return null;
        }
        const data = (await res.json()) as { user?: User };
        if (!data.user?.id) {
            await clearUserFromLocalStorage();
            return null;
        }
        localStorage.setItem("user", JSON.stringify(data.user));
        return data.user;
    } catch (error) {
        console.error("Error fetching session:", error);
        await clearUserFromLocalStorage();
        return null;
    }
}

/**
 * Check if the user has a valid session (auth_token cookie verified by backend).
 */
export async function checkAuthStatus(): Promise<boolean> {
    const user = await fetchSession();
    return !!user?.id;
}

/**
 * Read cached user from localStorage (best-effort; may be stale until fetchSession runs).
 */
export async function getCurrentUserFromLocalStorage(): Promise<User | null> {
    try {
        const user = JSON.parse(localStorage.getItem("user") || "{}") as User;
        return user?.id ? user : null;
    } catch (error) {
        console.error("Error getting current user from localStorage:", error);
        return null;
    }
}

export async function clearUserFromLocalStorage(): Promise<boolean> {
    try {
        localStorage.removeItem("user");
        return true;
    } catch (error) {
        console.error("Error clearing user from localStorage:", error);
        return false;
    }
}
