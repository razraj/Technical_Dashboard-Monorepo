import { checkAuthStatus } from "@/actions/auth-check";

/**
 * Check if user is authenticated by checking cookies server-side
 * Note: This checks the auth_token cookie validity server-side.
 * @returns Promise<boolean> - true if user has a valid token cookie, false otherwise
 */
export async function isAuthenticated(): Promise<boolean> {
    return await checkAuthStatus();
}
