"use client";

import { useState } from "react"
import { AddEntryModal } from "@/components/add-entry-modal"
import { cn } from "@repo/ui/lib/utils"
import { Button } from "@repo/ui/components/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@repo/ui/components/field"
import { Input } from "@repo/ui/components/input"

export function ForgotPasswordForm({
  className,
  ...props
}: React.ComponentProps<"form">) {
  const [modalOpen, setModalOpen] = useState(false)

  return (
    <>
      <form className={cn("flex flex-col gap-6", className)} {...props}>
        <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">Forgot password</h1>
          <p className="text-sm text-balance text-muted-foreground">
            Enter your email to receive a password reset link
          </p>
        </div>
        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input id="email" type="email" placeholder="m@example.com" required />
        </Field>
        <Field>
          <Button type="submit">Send reset link</Button>
        </Field>
        <Field>
          <FieldDescription className="text-center">
            Remember your password?{" "}
            <a href="/login" className="underline underline-offset-4">
              Back to login
            </a>
          </FieldDescription>
        </Field>
        <Field>
          <Button type="button" variant="outline" onClick={() => setModalOpen(true)}>
            Open Add Entry Modal
          </Button>
        </Field>
      </FieldGroup>
    </form>
    <AddEntryModal
      open={modalOpen}
      onOpenChange={setModalOpen}
      date={new Date().toISOString().slice(0, 10)}
      onSubmitted={() => setModalOpen(false)}
    />
    </>
  )
}
