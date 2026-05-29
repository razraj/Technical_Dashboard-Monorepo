"use client"

import { useForm } from "@tanstack/react-form-nextjs"
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
  redirectTo = "/dashboard",
  ...props
}: React.ComponentProps<"form"> & { redirectTo?: string }) {
  const form = useForm({
    defaultValues: {
      email: "",
      password: "",
    },
    onSubmit: async ({ value }) => {
      try {
        await login(value.email, value.password, redirectTo)
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to log in"
        toast.error(message)
        throw err
      }
    },
  })

  return (
    <form
      className={cn("flex flex-col gap-6", className)}
      onSubmit={(event) => {
        event.preventDefault()
        void form.handleSubmit()
      }}
      {...props}
    >
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">Login to your account</h1>
          <p className="text-sm text-balance text-muted-foreground">
            Enter your email below to login to your account
          </p>
        </div>
        <form.Field name="email">
          {(field) => (
            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input
                id="email"
                name={field.name}
                type="email"
                placeholder="m@example.com"
                required
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
              />
            </Field>
          )}
        </form.Field>
        <form.Field name="password">
          {(field) => (
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
                name={field.name}
                type="password"
                required
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
              />
            </Field>
          )}
        </form.Field>
        <form.Subscribe selector={(state) => state.errorMap.onSubmit}>
          {(submitError) =>
            submitError ? (
              <Field>
                <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
                  {String(submitError)}
                </div>
              </Field>
            ) : null
          }
        </form.Subscribe>
        <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
          {([canSubmit, isSubmitting]) => (
            <Field>
              <Button type="submit" disabled={!canSubmit || isSubmitting}>
                {isSubmitting ? "Logging in…" : "Login"}
              </Button>
            </Field>
          )}
        </form.Subscribe>
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
