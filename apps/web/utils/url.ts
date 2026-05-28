/**
 * Sanitizes a redirect path by:
 * 1. Handling absolute URLs (e.g. http://localhost:3001/dashboard)
 * 2. Allowing relative paths starting with "/" but not "//"
 * 3. Rejecting protocol-relative URLs (e.g. "//evil.com")
 * 4. Rejecting invalid URLs
 * 5. Logging errors to the console
 */
export function getSanitizedRedirectPath(redirect: string | null): string {
    if (!redirect) return "/";
    try {
        const decoded = decodeURIComponent(redirect);
        // Handle absolute URLs
        // Accept only if origin matches the current page; extract pathname only
        try {
            const url = new URL(decoded);
            if (typeof window !== "undefined" && url.origin === window.location.origin) {
                return url.pathname + url.search + url.hash;
            }
            // Valid absolute URL but different origin — reject
            return "/";
        } catch {
            // Not a valid absolute URL — fall through to relative path check
        }

        // Allow relative paths starting with "/" but not "//"
        // "//" is a protocol-relative URL (e.g. "//evil.com") and must be blocked
        if (decoded.startsWith("/") && !decoded.startsWith("//")) {
            return decoded;
        }
    } catch (error) {
        // decodeURIComponent threw — malformed input
        console.error("Error sanitizing redirect path:", error);
    }
    return "/";
}
