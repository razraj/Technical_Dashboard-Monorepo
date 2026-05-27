import { User } from "@/types";
import { jwtVerify } from "jose";

const SECRET_KEY = new TextEncoder().encode(process.env.JWT_SECRET);

export async function verifyToken(token: string) {
    try {
        const { payload } = await jwtVerify(token, SECRET_KEY);
        return payload;
    } catch {
        return null;
    }
}

/**
 * Check if user is authenticated by verifying the auth_token in localStorage
 * @returns true if user has a valid token cookie, false otherwise
 */
export async function checkAuthStatus(): Promise<boolean> {
    try {
        const user = JSON.parse(localStorage.getItem("user") || "{}") as User;
        return !!user?.id;
    } catch (error) {
        console.error("Error checking auth status:", error);
        return false;
    }
}

/**
 * Get the current user id from the auth token cookie.
 * JWT subject is the user id.
 * @returns { id } or null
 */
export async function getCurrentUserFromLocalStorage(): Promise<User | null> {
    try {
        const user = JSON.parse(localStorage.getItem("user") || "{}") as User;
        return user;
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
        console.error("Error logging out:", error);
        return false;
    }
}
