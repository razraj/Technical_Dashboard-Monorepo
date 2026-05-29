"use client"

import { useRouter } from "next/navigation"
import { useForm } from "@tanstack/react-form-nextjs"
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

  const form = useForm({
    defaultValues: {
      firstName: "",
      lastName: "",
      username: "",
      email: "",
      password: "",
      confirm: "",
    },
    onSubmit: async ({ value }) => {
      if (value.username.trim().length < 3) {
        throw new Error("Username must be at least 3 characters")
      }
      if (value.password.length < 8) {
        throw new Error("Password must be at least 8 characters")
      }
      if (value.password !== value.confirm) {
        throw new Error("Passwords do not match")
      }
      try {
        const { message } = await signup({
          email: value.email,
          password: value.password,
          username: value.username.trim(),
          firstName: value.firstName.trim() || undefined,
          lastName: value.lastName.trim() || undefined,
        })
        toast.success(message ?? "Account created. Check your email to verify.")
        router.push("/login")
      } catch (err) {
        const message = err instanceof Error ? err.message : "Could not create account"
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
          <h1 className="text-2xl font-bold">Create your account</h1>
          <p className="text-sm text-balance text-muted-foreground">
            Enter your details below to get started
          </p>
        </div>

        <div className="flex gap-3">
          <form.Field name="firstName">
            {(field) => (
              <Field>
                <FieldLabel htmlFor="firstName">First name</FieldLabel>
                <Input
                  id="firstName"
                  name={field.name}
                  type="text"
                  placeholder="John"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
              </Field>
            )}
          </form.Field>
          <form.Field name="lastName">
            {(field) => (
              <Field>
                <FieldLabel htmlFor="lastName">Last name</FieldLabel>
                <Input
                  id="lastName"
                  name={field.name}
                  type="text"
                  placeholder="Doe"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
              </Field>
            )}
          </form.Field>
        </div>

        <form.Field
          name="username"
          validators={{
            onChange: ({ value }) =>
              value.trim().length >= 3 ? undefined : "Username must be at least 3 characters",
          }}
        >
          {(field) => (
            <Field>
              <FieldLabel htmlFor="username">Username</FieldLabel>
              <Input
                id="username"
                name={field.name}
                type="text"
                placeholder="johndoe"
                required
                minLength={3}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
              />
              {field.state.meta.errors.length > 0 ? (
                <p className="text-sm text-destructive">{field.state.meta.errors.join(", ")}</p>
              ) : null}
            </Field>
          )}
        </form.Field>

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

        <form.Field
          name="password"
          validators={{
            onChange: ({ value }) =>
              value.length >= 8 ? undefined : "Password must be at least 8 characters",
          }}
        >
          {(field) => (
            <Field>
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <Input
                id="password"
                name={field.name}
                type="password"
                required
                minLength={8}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
              />
              {field.state.meta.errors.length > 0 ? (
                <p className="text-sm text-destructive">{field.state.meta.errors.join(", ")}</p>
              ) : null}
            </Field>
          )}
        </form.Field>

        <form.Field
          name="confirm"
          validators={{
            onChangeListenTo: ["password"],
            onChange: ({ value, fieldApi }) => {
              const password = fieldApi.form.getFieldValue("password")
              return value === password ? undefined : "Passwords do not match"
            },
          }}
        >
          {(field) => (
            <Field>
              <FieldLabel htmlFor="confirmPassword">Confirm password</FieldLabel>
              <Input
                id="confirmPassword"
                name={field.name}
                type="password"
                required
                minLength={8}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
              />
              {field.state.meta.errors.length > 0 ? (
                <p className="text-sm text-destructive">{field.state.meta.errors.join(", ")}</p>
              ) : null}
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
                {isSubmitting ? "Creating account…" : "Sign up"}
              </Button>
            </Field>
          )}
        </form.Subscribe>

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
