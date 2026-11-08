"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { CircleAlertIcon, MailIcon, PhoneIcon, TriangleAlertIcon, UserIcon } from "lucide-react"
import { z } from "zod"

import { createCustomer } from "@/app/actions/customer.actions"
import { Card, n0, Pill } from "@/components/inventory/inventory-ui"
import { customerKey, localPhone } from "@/components/orders/orders-table"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import type { Order } from "@/types/order.type"

const GENDERS = [
  { value: "none", label: "Not set" },
  { value: "Female", label: "Female" },
  { value: "Male", label: "Male" },
  { value: "Other", label: "Other" },
]

const today = () => new Date().toISOString().slice(0, 10)

const schema = z.object({
  firstName: z.string().trim().min(2, "Use at least 2 characters").max(50, "Too long"),
  lastName: z.string().trim().max(50, "Too long"),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  // Bangladesh mobile: 01 then 9 digits, with or without +88 and spaces.
  phone: z
    .string()
    .trim()
    .refine((v) => v === "" || /^(?:\+?88)?01[3-9]\d{8}$/.test(v.replace(/[\s-]/g, "")), "Enter a mobile number like 01711 000000"),
  birthDate: z.string().refine((v) => v === "" || v <= today(), "Can't be in the future"),
  gender: z.string(),
  image: z.string().trim().refine((v) => v === "" || /^https?:\/\/\S+$/.test(v), "Use a full link starting with https://"),
  isActive: z.boolean(),
})
type FormValues = z.infer<typeof schema>

export function CustomerForm({ orders }: { orders: Order[] }) {
  const router = useRouter()
  const [error, setError] = useState("")
  const {
    register,
    control,
    handleSubmit,
    watch,
    setError: setFieldError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { firstName: "", lastName: "", email: "", phone: "", birthDate: "", gender: "none", image: "", isActive: true },
  })

  const values = watch()
  const name = [values.firstName, values.lastName].map((v) => v.trim()).filter(Boolean).join(" ")
  const phoneDigits = values.phone.replace(/\D/g, "")

  // Someone who already ordered with this phone or email, so staff don't make a second record.
  const match = (() => {
    const email = values.email.trim().toLowerCase()
    const byPhone = phoneDigits.length >= 11 ? orders.filter((o) => customerKey(o) === phoneDigits.slice(-10)) : []
    const byEmail = email.includes("@") ? orders.filter((o) => o.customerEmail.toLowerCase() === email) : []
    const found = byPhone.length ? byPhone : byEmail
    if (!found.length) return null
    return { name: found[0].customerName || found[0].customerEmail, orders: found.length, account: found.some((o) => o.userId), by: byPhone.length ? "phone" : "email" }
  })()

  async function onSubmit(form: FormValues) {
    setError("")
    const res = await createCustomer({
      email: form.email,
      firstName: form.firstName,
      lastName: form.lastName || undefined,
      phone: form.phone ? localPhone(form.phone) : undefined,
      birthDate: form.birthDate ? new Date(form.birthDate).toISOString() : undefined,
      gender: form.gender === "none" ? undefined : form.gender,
      image: form.image || undefined,
      isActive: form.isActive,
    })
    if (!res.success) {
      setError(res.error)
      for (const [field, message] of Object.entries(res.fieldErrors ?? {})) setFieldError(field as keyof FormValues, { message })
      return
    }
    toast.success(`${name} added`)
    router.push("/customers")
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-4 px-4 md:gap-6 lg:grid-cols-3 lg:px-6">
      <div className="flex min-w-0 flex-col gap-4 md:gap-6 lg:col-span-2">
        {error && (
          <Alert variant="destructive">
            <CircleAlertIcon />
            <AlertTitle>Couldn’t add the customer</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Card title="Contact">
          <div className="grid gap-4 px-4 pb-4 sm:grid-cols-2">
            <Field data-invalid={Boolean(errors.firstName)}>
              <FieldLabel htmlFor="firstName">First name</FieldLabel>
              <Input id="firstName" autoFocus placeholder="Jannat" aria-invalid={Boolean(errors.firstName)} {...register("firstName")} />
              <FieldError>{errors.firstName?.message}</FieldError>
            </Field>
            <Field data-invalid={Boolean(errors.lastName)}>
              <FieldLabel htmlFor="lastName">
                Last name <span className="font-normal text-muted-foreground">(optional)</span>
              </FieldLabel>
              <Input id="lastName" placeholder="Ara" aria-invalid={Boolean(errors.lastName)} {...register("lastName")} />
              <FieldError>{errors.lastName?.message}</FieldError>
            </Field>
            <Field data-invalid={Boolean(errors.email)}>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <div className="relative">
                <MailIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="email" type="email" placeholder="jannat@example.com" className="pl-8" aria-invalid={Boolean(errors.email)} {...register("email")} />
              </div>
              <FieldDescription>Their sign-in; each email can have one account.</FieldDescription>
              <FieldError>{errors.email?.message}</FieldError>
            </Field>
            <Field data-invalid={Boolean(errors.phone)}>
              <FieldLabel htmlFor="phone">
                Mobile <span className="font-normal text-muted-foreground">(optional)</span>
              </FieldLabel>
              <div className="relative">
                <PhoneIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="phone" inputMode="tel" placeholder="01711 000000" className="pl-8 font-mono" aria-invalid={Boolean(errors.phone)} {...register("phone")} />
              </div>
              <FieldDescription>Couriers call this number on delivery.</FieldDescription>
              <FieldError>{errors.phone?.message}</FieldError>
            </Field>
          </div>
          {match && (
            <div className="mx-4 mb-4 flex items-start gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
              <TriangleAlertIcon className="mt-px size-3.5 shrink-0" />
              <span>
                This {match.by} already belongs to <strong>{match.name}</strong>, who placed {n0(match.orders)} {match.orders === 1 ? "order" : "orders"}
                {match.account ? " with an account" : " as a guest"}.{" "}
                <Link href="/customers" className="font-medium underline">
                  Find them in Customers
                </Link>
              </span>
            </div>
          )}
        </Card>

        <Card title="About them">
          <div className="grid gap-4 px-4 pb-4 sm:grid-cols-2">
            <Field data-invalid={Boolean(errors.birthDate)}>
              <FieldLabel htmlFor="birthDate">
                Birthday <span className="font-normal text-muted-foreground">(optional)</span>
              </FieldLabel>
              <Input id="birthDate" type="date" max={today()} aria-invalid={Boolean(errors.birthDate)} {...register("birthDate")} />
              <FieldDescription>For birthday offers.</FieldDescription>
              <FieldError>{errors.birthDate?.message}</FieldError>
            </Field>
            <Field>
              <FieldLabel>Gender</FieldLabel>
              <Controller
                control={control}
                name="gender"
                render={({ field }) => (
                  <Select value={field.value} items={GENDERS} onValueChange={(v) => field.onChange(v as string)}>
                    <SelectTrigger className="w-full" aria-label="Gender">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {GENDERS.map((g) => (
                        <SelectItem key={g.value} value={g.value}>
                          {g.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field data-invalid={Boolean(errors.image)} className="sm:col-span-2">
              <FieldLabel htmlFor="image">
                Photo link <span className="font-normal text-muted-foreground">(optional)</span>
              </FieldLabel>
              <Input id="image" placeholder="https://…" aria-invalid={Boolean(errors.image)} {...register("image")} />
              <FieldError>{errors.image?.message}</FieldError>
            </Field>
          </div>
        </Card>
      </div>

      <div className="flex min-w-0 flex-col gap-4 md:gap-6">
        <Card title="Preview">
          <div className="flex flex-col items-center gap-2 px-4 pb-5 text-center">
            {values.image && !errors.image ? (
              // eslint-disable-next-line @next/next/no-img-element -- any image host is allowed
              <img src={values.image} alt="" className="size-16 rounded-full object-cover" />
            ) : (
              <span className="grid size-16 place-items-center rounded-full bg-primary/10 text-lg font-semibold text-primary uppercase">
                {name ? (
                  name
                    .split(/\s+/)
                    .map((w) => w[0])
                    .join("")
                    .slice(0, 2)
                ) : (
                  <UserIcon className="size-6" />
                )}
              </span>
            )}
            <div>
              <div className="font-semibold">{name || "New customer"}</div>
              <div className="text-xs text-muted-foreground">{values.email || "email@example.com"}</div>
              {phoneDigits.length >= 11 && <div className="font-mono text-xs text-muted-foreground">{localPhone(values.phone)}</div>}
            </div>
            <div className="flex gap-1.5">
              <Pill tone="blue">Account</Pill>
              <Pill tone={values.isActive ? "green" : "grey"}>{values.isActive ? "Active" : "Inactive"}</Pill>
            </div>
          </div>
        </Card>

        <Card title="Account">
          <div className="flex flex-col gap-4 px-4 pb-4">
            <Controller
              control={control}
              name="isActive"
              render={({ field }) => (
                <label className="flex items-start justify-between gap-3 text-sm">
                  <span>
                    <span className="font-medium">Active</span>
                    <span className="block text-xs text-muted-foreground">Inactive customers can’t sign in or check out.</span>
                  </span>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </label>
              )}
            />
            <div className="flex gap-2 border-t pt-4">
              <Button type="button" variant="outline" className="flex-1" nativeButton={false} render={<Link href="/customers" />}>
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={isSubmitting}>
                {isSubmitting ? "Adding..." : "Add customer"}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </form>
  )
}
