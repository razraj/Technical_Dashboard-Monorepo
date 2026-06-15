import { checkAuthStatus, fetchSession } from "@/actions/auth-check";

/**
 * Check if the user has a valid session (verified via GET /api/auth/me).
 */
export async function isAuthenticated(): Promise<boolean> {
    return await checkAuthStatus();
}

export { fetchSession };
