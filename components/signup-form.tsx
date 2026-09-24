"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Loader2Icon } from "lucide-react"
import { toast } from "sonner"
import { cn } from "cn"

import { GithubIcon } from "@/components/github-icon"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"

type Errors = Partial<Record<"name" | "email" | "password" | "confirm", string>>

// Demo only: no account is actually created.
export function SignupForm({
  className,
  ...props
}: React.ComponentProps<"form">) {
  const router = useRouter()
  const [loading, setLoading] = React.useState(false)
  const [errors, setErrors] = React.useState<Errors>({})

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    const name = String(data.get("name") ?? "").trim()
    const email = String(data.get("email") ?? "").trim()
    const password = String(data.get("password") ?? "")
    const confirm = String(data.get("confirm-password") ?? "")

    const next: Errors = {}
    if (!name) next.name = "Enter your full name"
    if (!/^\S+@\S+\.\S+$/.test(email)) next.email = "Enter a valid email address"
    if (password.length < 8) next.password = "Must be at least 8 characters long"
    if (confirm !== password) next.confirm = "Passwords don't match"
    setErrors(next)
    if (Object.keys(next).length) return

    setLoading(true)
    await new Promise((resolve) => setTimeout(resolve, 800))
    toast.success(`Account created. Welcome, ${name.split(" ")[0]}!`)
    router.push("/dashboard")
  }

  return (
    <form
      noValidate
      onSubmit={handleSubmit}
      className={cn("flex flex-col gap-6", className)}
      {...props}
    >
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">Create your account</h1>
          <p className="text-sm text-balance text-muted-foreground">
            Fill in the form below to create your account
          </p>
        </div>
        <Field data-invalid={Boolean(errors.name)}>
          <FieldLabel htmlFor="name">Full Name</FieldLabel>
          <Input
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            placeholder="John Doe"
            aria-invalid={Boolean(errors.name)}
            required
            className="h-10 bg-background"
          />
          <FieldError>{errors.name}</FieldError>
        </Field>
        <Field data-invalid={Boolean(errors.email)}>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="m@example.com"
            aria-invalid={Boolean(errors.email)}
            required
            className="h-10 bg-background"
          />
          {errors.email ? (
            <FieldError>{errors.email}</FieldError>
          ) : (
            <FieldDescription>
              We&apos;ll use this to contact you. We will not share your email
              with anyone else.
            </FieldDescription>
          )}
        </Field>
        <Field data-invalid={Boolean(errors.password)}>
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            aria-invalid={Boolean(errors.password)}
            required
            className="h-10 bg-background"
          />
          {errors.password ? (
            <FieldError>{errors.password}</FieldError>
          ) : (
            <FieldDescription>Must be at least 8 characters long.</FieldDescription>
          )}
        </Field>
        <Field data-invalid={Boolean(errors.confirm)}>
          <FieldLabel htmlFor="confirm-password">Confirm Password</FieldLabel>
          <Input
            id="confirm-password"
            name="confirm-password"
            type="password"
            autoComplete="new-password"
            aria-invalid={Boolean(errors.confirm)}
            required
            className="h-10 bg-background"
          />
          {errors.confirm ? (
            <FieldError>{errors.confirm}</FieldError>
          ) : (
            <FieldDescription>Please confirm your password.</FieldDescription>
          )}
        </Field>
        <Field>
          <Button type="submit" size="lg" className="h-10" disabled={loading}>
            {loading && <Loader2Icon className="animate-spin" />}
            {loading ? "Creating account..." : "Create Account"}
          </Button>
        </Field>
        <FieldSeparator>Or continue with</FieldSeparator>
        <Field>
          <Button
            variant="outline"
            size="lg"
            className="h-10"
            type="button"
            onClick={() => toast.info("GitHub sign up isn't set up in this demo")}
          >
            <GithubIcon />
            Sign up with GitHub
          </Button>
          <FieldDescription className="px-6 text-center">
            Already have an account?{" "}
            <Link href="/login" className="underline underline-offset-4">
              Sign in
            </Link>
          </FieldDescription>
        </Field>
      </FieldGroup>
    </form>
  )
}
