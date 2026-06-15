# Web Auth Integration — Design

- **Date:** 2026-05-29
- **Status:** Approved (design)
- **Scope:** `apps/web`

## Problem

The backend exposes a full auth surface (`/auth/login`, `/auth/signup`,
`/auth/forgot-password`, `/auth/reset-password`, `/auth/me`, `/auth/logout`,
`/auth/refresh`, `/auth/verify-email`, `/auth/resend-verification`), but the web
app only wires up a subset:

- `login-form.tsx` — **static**; a `login()` action exists but the form never calls it.
- `signup-form.tsx` — **static**; no `signup()` action; fields don't match the API.
- `forgot-password-form.tsx` — **static**; no `forgotPassword()` action; still has a leftover "Open Add Entry Modal" dev button.
- `reset-password-form.tsx` — ✅ already fully wired.
- `nav-user.tsx` — `logout()` wired, but the sidebar shows hardcoded sample user data ("shadcn") instead of the logged-in user.

Goal: make login, signup, and forgot-password actually call the APIs, surface
the real logged-in user in the sidebar, and surface meaningful auth errors.

## Backend contracts (reference)

- `POST /auth/login` — body `{ username, password }` where `username` is validated
  as an **email** (`z.string().email()`), `password` min 8. Returns `{ user }` and
  sets session cookies. `401 { error: "Invalid credentials" }`;
  `403 { error: "Email not verified", code: "EMAIL_NOT_VERIFIED" }` for unverified accounts.
- `POST /auth/signup` — body `{ email, password(min8), username(min3), firstName?, lastName?, profilePic? }`.
  `201 { message, email }` (does **not** create a session). `409` email/username taken,
  `400` invalid, `503` verification email failed.
- `POST /auth/forgot-password` — body `{ email }`. Always returns generic
  `{ message: "If an account exists for that email, ..." }`. `503` if email send fails.
- `POST /auth/reset-password` — already consumed by `reset-password-form.tsx`.
- `GET /auth/me` — `{ user }` (not consumed in this work).

`fetchWithoutAuth` (`apps/web/utils/api.ts`) throws `Error(backend.error ?? backend.message)`
on any non-2xx response, so action wrappers only need a try/catch and callers get
the specific backend message.

## Decisions (from brainstorming)

1. **Signup fields:** redesign the form to explicit fields — First name, Last name,
   Username, Email, Password, Confirm password.
2. **Email verification UX:** minimal. No `/verify-email` web page, no resend UI.
   Login's `EMAIL_NOT_VERIFIED` simply surfaces as the error text.
3. **Post-signup:** success toast + redirect to `/login` (signup creates no session).
4. **Sidebar user source:** read from `localStorage` (populated by `login()`), no extra request.

## Design

### 1. Data layer — `apps/web/actions/auth.ts`

- **`login(email, password)`** — refine the existing action: remove the static
  `toast.promise` "Failed to log in" string (it masks the real error). Keep success
  side effects: store `user` in `localStorage`, redirect to `/dashboard`. On failure
  the thrown error (`"Invalid credentials"` / `"Email not verified"`) propagates to
  the form.
- **`signup(payload)`** — new. `POST /auth/signup` with
  `{ email, password, username, firstName, lastName }`. Returns `{ message, email }`.
  Throws on 400/409/503 with the backend message.
- **`forgotPassword(email)`** — new. `POST /auth/forgot-password` with `{ email }`.
  Returns the generic `{ message }`.
- Leave `logout()` and the reset-password flow unchanged.

### 2. `login-form.tsx`

- Convert to `"use client"` with controlled `email`, `password`, and `pending` +
  `error` state.
- `onSubmit` → `login(email, password)`. Disable submit while pending. On error:
  set inline error text and `toast.error(message)` (covers the "Email not verified"
  case). Success is handled inside `login()` (redirect). Preserve existing markup/links.

### 3. `signup-form.tsx`

- Convert to `"use client"`; replace "Full name" with First name + Last name, and add
  a Username field. Controlled inputs + `pending`/`error` state.
- Client-side validation: password ≥ 8, `password === confirm`, username ≥ 3.
- On submit → `signup(...)`; success → `toast.success(message)` + `router.push("/login")`;
  error → inline + toast.

### 4. `forgot-password-form.tsx`

- Remove the leftover "Open Add Entry Modal" button + `AddEntryModal` import/state.
- Convert to `"use client"`; controlled `email`, `pending`/`error`/`submitted` state.
- On submit → `forgotPassword(email)`; on success show inline "check your email"
  confirmation with a back-to-login link.

### 5. Real user in sidebar — `app-sidebar.tsx`

- On mount, read the user via `getCurrentUserFromLocalStorage()`; map to
  `{ name: [firstName, lastName].filter(Boolean).join(" ") || username, email, avatar: profilePic ?? "" }`
  and pass to `NavUser`. Fall back to the existing placeholder when no user is present.

## Out of scope

- No `/verify-email` web page, no resend-verification UI, no `GET /auth/me` consumption.
- No changes to `reset-password-form.tsx`, `logout()`, `fetchWithAuth`, or backend routes.

## Verification

- `yarn workspace web run check-types` (runs `next typegen` first) — clean.
- `yarn workspace web lint` — clean (`max-warnings: 0`).
