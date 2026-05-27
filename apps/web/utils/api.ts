import { BadRequestError, ForbiddenError, InternalServerError, NotFoundError } from "@/utils/errors";
import { toast } from "@repo/ui/components";

const BASE_URL = "/api";

/**
 * Fetch without authentication
 * @param endpoint - The endpoint to fetch from
 * @param options - The options to pass to the fetch function
 * @returns The response from the fetch function
 */
export async function fetchWithoutAuth(endpoint: string, options: RequestInit = {}) {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
        ...options,
        credentials: "include"
    });
    if (!response.ok) {
        const error = (await response.json().catch(() => ({}))) as { error?: string; message?: string };
        throw new Error(error?.error ?? error?.message ?? "An error occurred");
    }
    return response.json();
}

/**
 * Fetch with authentication
 * @param endpoint - The endpoint to fetch from
 * @param options - The options to pass to the fetch function
 * @returns The response from the fetch function
 */
export async function fetchWithAuth(endpoint: string, options: RequestInit = {}) {
    const headers = new Headers(options.headers);
    if (!headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
    }
    // Backend expects x-user-id for protected routes; set from session if available
    if (typeof window !== "undefined") {
        try {
            const raw = localStorage.getItem("user");
            const user = raw ? (JSON.parse(raw) as { id?: string }) : null;
            if (user?.id) headers.set("x-user-id", user.id);
        } catch {
            // ignore
        }
    }
    // If backend requires Authorization header, it should read from cookies server-side
    // if (isSessionLocked()) {
    //     throw new Error("Session locked. Please reauthenticate.");
    //   }

    const response = await fetch(`${BASE_URL}${endpoint}`, {
        ...options,
        headers,
        credentials: "include" // Include cookies in requests
    });

    if (!response.ok) {
        if (response.status === 401) {
            // Token might be expired, try to refresh
            try {
                // Refresh endpoint will set new cookies automatically
                await fetchWithoutAuth("/auth/refresh", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    credentials: "include" // Ensure cookies are sent
                });

                // Retry the original request with refreshed cookies
                return fetchWithAuth(endpoint, options);
            } catch (error) {
                // Refresh failed, redirect to login
                const currentUrl = window.location.href;
                window.location.href = "/login?redirect=" + encodeURIComponent(currentUrl);
                toast.error("Session expired. Please log in again.", {
                    position: "top-center"
                });
                throw new Error("Session expired. Please log in again.");
            }
        }
        const error = (await response.json().catch(() => ({}))) as {
            message?: string;
            error?: string;
            code?: string;
        };
        const msg = error?.message ?? error?.error ?? "An error occurred";
        const code = error?.code ?? String(response.status);
        switch (response.status) {
            case 404:
                throw new NotFoundError(msg, code);
            case 403:
                throw new ForbiddenError(msg, code);
            case 400:
                throw new BadRequestError(msg, code);
            default:
                throw new InternalServerError(msg, code);
        }
    }

    return response.json();
}
