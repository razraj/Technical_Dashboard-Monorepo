# Web Auth Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the existing `apps/web` login, signup, and forgot-password forms to the backend auth APIs, surface the real logged-in user in the sidebar, and surface meaningful auth error messages.

**Architecture:** Thin action wrappers in `apps/web/actions/auth.ts` around `fetchWithoutAuth` (which throws `Error(backend.error/message)` on non-2xx). Form components become `"use client"` with controlled inputs and `pending`/`error` state. Matches the already-wired `reset-password-form.tsx` and `actions/timesheet.ts` patterns.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, `@repo/ui` components, sonner `toast`.

**Verification note:** This repo has no test harness (`yarn test` is a no-op). Verification for every task is:
- `yarn workspace web run check-types` → expect no errors
- `yarn workspace web lint` → expect clean (`max-warnings: 0`)

Reference spec: `docs/superpowers/specs/2026-05-29-web-auth-integration-design.md`

---

### Task 1: Auth data layer (`actions/auth.ts`)

**Files:**
- Modify: `apps/web/actions/auth.ts`

- [ ] **Step 1: Replace the file contents**

Refine `login` (rename param to `email`, send it as the `username` field, drop the static error toast so the real backend message propagates) and add `signup` + `forgotPassword`. Keep `logout` unchanged.

```ts
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
```

- [ ] **Step 2: Verify**

Run: `yarn workspace web run check-types`
Expected: no errors.

Run: `yarn workspace web lint`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add apps/web/actions/auth.ts
git commit -m "feat(web): add signup/forgotPassword actions and refine login error handling"
```

---

### Task 2: Wire login form (`login-form.tsx`)

**Files:**
- Modify: `apps/web/components/login-form.tsx`

- [ ] **Step 1: Replace the file contents**

```tsx
"use client"

import { useState } from "react"
import { login } from "@/actions/auth"
import { cn } from "@repo/ui/lib/utils"
import { Button } from "@repo/ui/components/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@repo/ui/components/field"
import { Input } from "@repo/ui/components/input"
import { toast } from "@repo/ui/components"

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"form">) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setPending(true)
    try {
      // login() redirects on success, so we leave pending=true in that path.
      await login(email, password)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to log in"
      setError(message)
      toast.error(message)
      setPending(false)
    }
  }

  return (
    <form
      className={cn("flex flex-col gap-6", className)}
      onSubmit={handleSubmit}
      {...props}
    >
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">Login to your account</h1>
          <p className="text-sm text-balance text-muted-foreground">
            Enter your email below to login to your account
          </p>
        </div>
        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input
            id="email"
            type="email"
            placeholder="m@example.com"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field>
          <div className="flex items-center">
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <a
              href="/forgot-password"
              className="ml-auto text-sm underline-offset-4 hover:underline"
            >
              Forgot your password?
            </a>
          </div>
          <Input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        {error && (
          <Field>
            <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
              {error}
            </div>
          </Field>
        )}
        <Field>
          <Button type="submit" disabled={pending}>
            {pending ? "Logging in…" : "Login"}
          </Button>
        </Field>
        <FieldSeparator>Or continue with</FieldSeparator>
        <Field>
          <FieldDescription className="text-center">
            Don&apos;t have an account?{" "}
            <a href="/signup" className="underline underline-offset-4">
              Sign up
            </a>
          </FieldDescription>
        </Field>
      </FieldGroup>
    </form>
  )
}
```

- [ ] **Step 2: Verify**

Run: `yarn workspace web run check-types` → no errors.
Run: `yarn workspace web lint` → clean.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/login-form.tsx
git commit -m "feat(web): wire login form to login action"
```

---

### Task 3: Redesign + wire signup form (`signup-form.tsx`)

**Files:**
- Modify: `apps/web/components/signup-form.tsx`

- [ ] **Step 1: Replace the file contents**

Replaces "Full name" with First name + Last name + Username fields; validates username ≥ 3, password ≥ 8, password === confirm; on success toasts the backend message and redirects to `/login`.

```tsx
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { signup } from "@/actions/auth"
import { cn } from "@repo/ui/lib/utils"
import { Button } from "@repo/ui/components/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@repo/ui/components/field"
import { Input } from "@repo/ui/components/input"
import { toast } from "@repo/ui/components"

export function SignupForm({
  className,
  ...props
}: React.ComponentProps<"form">) {
  const router = useRouter()
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    if (username.trim().length < 3) {
      setError("Username must be at least 3 characters")
      return
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters")
      return
    }
    if (password !== confirm) {
      setError("Passwords do not match")
      return
    }
    setPending(true)
    try {
      const { message } = await signup({
        email,
        password,
        username: username.trim(),
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
      })
      toast.success(message ?? "Account created. Check your email to verify.")
      router.push("/login")
    } catch (err) {
      const m = err instanceof Error ? err.message : "Could not create account"
      setError(m)
      toast.error(m)
      setPending(false)
    }
  }

  return (
    <form
      className={cn("flex flex-col gap-6", className)}
      onSubmit={handleSubmit}
      {...props}
    >
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">Create your account</h1>
          <p className="text-sm text-balance text-muted-foreground">
            Enter your details below to get started
          </p>
        </div>

        <div className="flex gap-3">
          <Field>
            <FieldLabel htmlFor="firstName">First name</FieldLabel>
            <Input
              id="firstName"
              type="text"
              placeholder="John"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="lastName">Last name</FieldLabel>
            <Input
              id="lastName"
              type="text"
              placeholder="Doe"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </Field>
        </div>

        <Field>
          <FieldLabel htmlFor="username">Username</FieldLabel>
          <Input
            id="username"
            type="text"
            placeholder="johndoe"
            required
            minLength={3}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input
            id="email"
            type="email"
            placeholder="m@example.com"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <Input
            id="password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="confirmPassword">Confirm password</FieldLabel>
          <Input
            id="confirmPassword"
            type="password"
            required
            minLength={8}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </Field>

        {error && (
          <Field>
            <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
              {error}
            </div>
          </Field>
        )}

        <Field>
          <Button type="submit" disabled={pending}>
            {pending ? "Creating account…" : "Sign up"}
          </Button>
        </Field>

        <Field>
          <FieldDescription className="text-center">
            Already have an account?{" "}
            <a href="/login" className="underline underline-offset-4">
              Login
            </a>
          </FieldDescription>
        </Field>
      </FieldGroup>
    </form>
  )
}
```

- [ ] **Step 2: Verify**

Run: `yarn workspace web run check-types` → no errors.
Run: `yarn workspace web lint` → clean.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/signup-form.tsx
git commit -m "feat(web): redesign and wire signup form to signup action"
```

---

### Task 4: Clean up + wire forgot-password form (`forgot-password-form.tsx`)

**Files:**
- Modify: `apps/web/components/forgot-password-form.tsx`

- [ ] **Step 1: Replace the file contents**

Removes the leftover "Open Add Entry Modal" button + `AddEntryModal` import/state; wires the email submit to `forgotPassword`; shows a confirmation state on success.

```tsx
"use client";

import { useState } from "react"
import { forgotPassword } from "@/actions/auth"
import { cn } from "@repo/ui/lib/utils"
import { Button } from "@repo/ui/components/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@repo/ui/components/field"
import { Input } from "@repo/ui/components/input"
import { toast } from "@repo/ui/components"

export function ForgotPasswordForm({
  className,
  ...props
}: React.ComponentProps<"form">) {
  const [email, setEmail] = useState("")
  const [pending, setPending] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setPending(true)
    try {
      const res = await forgotPassword(email)
      setMessage(
        res.message ??
          "If an account exists for that email, you'll receive password reset instructions shortly."
      )
      setSubmitted(true)
    } catch (err) {
      const m = err instanceof Error ? err.message : "Something went wrong"
      setError(m)
      toast.error(m)
    } finally {
      setPending(false)
    }
  }

  if (submitted) {
    return (
      <div className={cn("flex flex-col gap-6", className)}>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">Check your email</h1>
          <p className="text-sm text-balance text-muted-foreground">{message}</p>
        </div>
        <a
          href="/login"
          className="text-center text-sm underline underline-offset-4"
        >
          Back to login
        </a>
      </div>
    )
  }

  return (
    <form
      className={cn("flex flex-col gap-6", className)}
      onSubmit={handleSubmit}
      {...props}
    >
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">Forgot password</h1>
          <p className="text-sm text-balance text-muted-foreground">
            Enter your email to receive a password reset link
          </p>
        </div>
        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input
            id="email"
            type="email"
            placeholder="m@example.com"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        {error && (
          <Field>
            <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
              {error}
            </div>
          </Field>
        )}
        <Field>
          <Button type="submit" disabled={pending}>
            {pending ? "Sending…" : "Send reset link"}
          </Button>
        </Field>
        <Field>
          <FieldDescription className="text-center">
            Remember your password?{" "}
            <a href="/login" className="underline underline-offset-4">
              Back to login
            </a>
          </FieldDescription>
        </Field>
      </FieldGroup>
    </form>
  )
}
```

- [ ] **Step 2: Verify**

Run: `yarn workspace web run check-types` → no errors.
Run: `yarn workspace web lint` → clean.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/forgot-password-form.tsx
git commit -m "feat(web): wire forgot-password form and remove demo modal button"
```

---

### Task 5: Show real logged-in user in sidebar (`app-sidebar.tsx`)

**Files:**
- Modify: `apps/web/components/app-sidebar.tsx`

- [ ] **Step 1: Add imports**

At the top of the file, add the action import next to the existing imports (after the `NavUser` import):

```tsx
import { NavUser } from "./nav-user";
import { getCurrentUserFromLocalStorage } from "@/actions/auth-check";
```

- [ ] **Step 2: Read the user from localStorage in `AppSidebar`**

Replace the `AppSidebar` function with this version (uses `React.useState`/`React.useEffect`, consistent with the existing `import * as React from "react"`):

```tsx
export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
    const [user, setUser] = React.useState(data.user);

    React.useEffect(() => {
        getCurrentUserFromLocalStorage().then((u) => {
            if (!u?.id) return;
            const name = [u.firstName, u.lastName].filter(Boolean).join(" ") || u.username || "User";
            setUser({
                name,
                email: u.email ?? "",
                avatar: u.profilePic ?? ""
            });
        });
    }, []);

    return (
        <Sidebar collapsible="icon" {...props}>
            <SidebarHeader>
                <TeamSwitcher teams={data.teams} />
            </SidebarHeader>
            <SidebarContent>
                <NavMain items={data.navMain} />
            </SidebarContent>
            <SidebarFooter>
                <NavUser user={user} />
            </SidebarFooter>
            <SidebarRail />
        </Sidebar>
    );
}
```

- [ ] **Step 3: Verify**

Run: `yarn workspace web run check-types` → no errors.
Run: `yarn workspace web lint` → clean.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/app-sidebar.tsx
git commit -m "feat(web): show real logged-in user in sidebar"
```

---

## Final verification

- [ ] `yarn workspace web run check-types` → no errors.
- [ ] `yarn workspace web lint` → clean (`max-warnings: 0`).
- [ ] Manual smoke (optional, requires backend + DB): login with a seeded verified user redirects to `/dashboard`; login with unverified user shows "Email not verified"; signup redirects to `/login` with a toast; forgot-password shows the confirmation state; sidebar footer shows the logged-in user's name/email.
