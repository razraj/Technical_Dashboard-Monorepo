# Authentication & Routing Flow

## Overview

End-to-end authentication flow and routing patterns between the web and backend applications.

**Not server-side sessions:** auth state is JWTs in httpOnly cookies. `auth-session.ts` is a login/cookie helper, not a session store.

## Auth Flow Step-by-Step

1. User POSTs to `/api/auth/login` on the web origin (via `fetchWithoutAuth` in `apps/web/actions/auth.ts`)
2. Web `next.config.js` rewrites `/api/*` → backend `http://localhost:3000/:path*` (dev)
3. Backend `/auth/login` validates credentials and sets `auth_token` + `refresh_token` HTTP-only cookies on the response
4. Web stores user metadata in `localStorage` as a best-effort cache (not the auth source of truth)
5. Subsequent API calls go to `/api/*` (rewritten to backend) with cookies attached
6. Backend `apps/backend/proxy.ts` reads the cookie, verifies JWT (`jose`), sets `x-user-id` header
7. Protected route handlers read `x-user-id` from `request.headers`
8. **Refresh:** `/auth/refresh` reads `refresh_token` cookie, validates against DB, reissues `auth_token`

## Route Handlers

- **Proxy file convention:** Auth gate must live in `apps/backend/proxy.ts` (Next.js 16) with default export `proxy` — not `middleware.ts`.
- **Protected route handlers:** Read `x-user-id` from headers (set by proxy). Do NOT verify tokens in route handlers.
- **New API routes:** Add under `apps/backend/app/`. If public, add the path to the skip list in `apps/backend/proxy.ts`.
- **Web API calls:** Use `fetchWithAuth()` / `fetchWithoutAuth()` from `@/utils/api`.
- **Production note:** Web rewrites use `DATABASE_HOST` in `apps/web/next.config.js` (verify before changing env var names). Dedicated web `/api/auth/*` route handlers may be needed for correct cookie domains — see architectural-decisions §3.
