"use client"

import * as React from "react"

import { BrandLogo } from "@/components/brands/brand-logo"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import type { Brand } from "@/lib/demo-data"
import {
  brandSchema,
  slugify,
  type BrandInput,
  type BrandValues,
} from "@/lib/validations/brand"

type Errors = Partial<Record<keyof BrandInput, string>>

const empty: BrandInput = { name: "", slug: "", logoUrl: "" }

export function BrandFormSheet({
  open,
  onOpenChange,
  brand,
  brands,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The brand being edited, or null to create a new one. */
  brand: Brand | null
  /** All brands, used to enforce the unique name and slug constraints. */
  brands: Brand[]
  onSubmit: (values: BrandValues) => void
}) {
  const [values, setValues] = React.useState<BrandInput>(empty)
  const [errors, setErrors] = React.useState<Errors>({})
  // Keep the slug in sync with the name until the user edits it by hand.
  const [slugTouched, setSlugTouched] = React.useState(false)

  // Reset the form whenever the sheet opens for a different brand.
  const [lastKey, setLastKey] = React.useState<string | null>(null)
  const key = open ? (brand?.id ?? "new") : null
  if (key !== lastKey) {
    setLastKey(key)
    if (key) {
      setValues(
        brand
          ? { name: brand.name, slug: brand.slug, logoUrl: brand.logoUrl ?? "" }
          : empty
      )
      setErrors({})
      setSlugTouched(Boolean(brand))
    }
  }

  function update(field: keyof BrandInput, value: string) {
    setValues((current) => {
      const next = { ...current, [field]: value }
      if (field === "name" && !slugTouched) next.slug = slugify(value)
      return next
    })
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const result = brandSchema.safeParse(values)
    const next: Errors = {}
    if (!result.success) {
      for (const issue of result.error.issues) {
        const field = issue.path[0] as keyof BrandInput
        next[field] ??= issue.message
      }
    } else {
      const others = brands.filter((b) => b.id !== brand?.id)
      const name = result.data.name.toLowerCase()
      if (others.some((b) => b.name.toLowerCase() === name)) {
        next.name = "A brand with this name already exists"
      }
      if (others.some((b) => b.slug === result.data.slug)) {
        next.slug = "This slug is already in use"
      }
    }
    setErrors(next)
    if (result.success && !Object.keys(next).length) onSubmit(result.data)
  }

  const previewUrl = values.logoUrl.trim() || null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 sm:max-w-md">
        <form onSubmit={handleSubmit} noValidate className="flex h-full flex-col">
          <SheetHeader className="border-b">
            <SheetTitle>{brand ? "Edit brand" : "Add brand"}</SheetTitle>
            <SheetDescription>
              {brand
                ? "Changes apply to every product under this brand."
                : "Brands group products by manufacturer or label."}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto p-4">
            <FieldGroup>
              <div className="flex items-center gap-4 rounded-lg border bg-muted/40 p-4">
                <BrandLogo
                  name={values.name || "?"}
                  logoUrl={previewUrl}
                  className="size-14 bg-background text-sm"
                />
                <div className="min-w-0">
                  <div className="truncate font-medium">
                    {values.name.trim() || "Brand name"}
                  </div>
                  <div className="truncate font-mono text-xs text-muted-foreground">
                    /brands/{values.slug || "slug"}
                  </div>
                </div>
              </div>

              <Field data-invalid={Boolean(errors.name)}>
                <FieldLabel htmlFor="brand-name">Name</FieldLabel>
                <Input
                  id="brand-name"
                  value={values.name}
                  onChange={(e) => update("name", e.target.value)}
                  placeholder="e.g. Northfold"
                  aria-invalid={Boolean(errors.name)}
                  autoFocus
                />
                <FieldError>{errors.name}</FieldError>
              </Field>

              <Field data-invalid={Boolean(errors.slug)}>
                <FieldLabel htmlFor="brand-slug">Slug</FieldLabel>
                <Input
                  id="brand-slug"
                  value={values.slug}
                  onChange={(e) => {
                    setSlugTouched(true)
                    update("slug", e.target.value.toLowerCase())
                  }}
                  placeholder="northfold"
                  className="font-mono"
                  aria-invalid={Boolean(errors.slug)}
                />
                {errors.slug ? (
                  <FieldError>{errors.slug}</FieldError>
                ) : (
                  <FieldDescription>
                    Used in the storefront URL. Must be unique.
                    {slugTouched && values.name && (
                      <>
                        {" "}
                        <button
                          type="button"
                          className="underline underline-offset-2 hover:text-foreground"
                          onClick={() => {
                            setSlugTouched(false)
                            update("slug", slugify(values.name))
                          }}
                        >
                          Generate from name
                        </button>
                      </>
                    )}
                  </FieldDescription>
                )}
              </Field>

              <Field data-invalid={Boolean(errors.logoUrl)}>
                <FieldLabel htmlFor="brand-logo">
                  Logo URL{" "}
                  <span className="font-normal text-muted-foreground">(optional)</span>
                </FieldLabel>
                <Input
                  id="brand-logo"
                  type="url"
                  value={values.logoUrl}
                  onChange={(e) => update("logoUrl", e.target.value)}
                  placeholder="https://cdn.example.com/logo.svg"
                  aria-invalid={Boolean(errors.logoUrl)}
                />
                {errors.logoUrl ? (
                  <FieldError>{errors.logoUrl}</FieldError>
                ) : (
                  <FieldDescription>
                    Square SVG or PNG works best. Initials are shown when empty.
                  </FieldDescription>
                )}
              </Field>
            </FieldGroup>
          </div>

          <SheetFooter className="flex-row justify-end border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">{brand ? "Save changes" : "Add brand"}</Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
