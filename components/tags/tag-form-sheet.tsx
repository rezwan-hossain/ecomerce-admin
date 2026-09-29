"use client"

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { TagIcon } from "lucide-react"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import type { ActionResponse } from "@/lib/action-response"
import { slugify } from "@/lib/categories/tree-utils"
import type { CreateTagDto, Tag } from "@/types/tag.type"

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(50, "Keep it under 50 characters"),
  slug: z
    .string()
    .min(1, "Slug is required")
    .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers and hyphens"),
})

// The "Add tag" / "Edit tag" side panel.
// Render with key={tag id} so each tag starts with a fresh form.
export function TagFormSheet({
  open,
  onOpenChange,
  tag,
  onSave,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  tag: Tag | null // null when adding a new tag
  onSave: (values: CreateTagDto) => Promise<ActionResponse<Tag>>
}) {
  const isNew = !tag
  // While on, typing a name also fills in the slug. Typing a slug turns it off.
  const [autoSlug, setAutoSlug] = useState(isNew)

  const form = useForm<CreateTagDto>({
    resolver: zodResolver(schema),
    defaultValues: { name: tag?.name ?? "", slug: tag?.slug ?? "" },
  })
  const { errors, isSubmitting } = form.formState

  const name = form.watch("name")
  const slug = form.watch("slug")

  useEffect(() => {
    if (autoSlug) {
      form.setValue("slug", slugify(name), { shouldDirty: true })
    }
  }, [name, autoSlug, form])

  async function onSubmit(values: CreateTagDto) {
    const res = await onSave(values)
    if (res.success) return

    // Show the backend's validation messages under the matching fields.
    for (const [field, message] of Object.entries(res.fieldErrors ?? {})) {
      form.setError(field as keyof CreateTagDto, { message })
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 sm:max-w-md">
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex h-full flex-col">
          <SheetHeader className="border-b">
            <SheetTitle>{isNew ? "Add tag" : "Edit tag"}</SheetTitle>
            <SheetDescription>
              {isNew
                ? "Tags label products so shoppers can filter and find them."
                : "Changes apply to every product with this tag."}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto p-4">
            <FieldGroup>
              {/* Live preview */}
              <div className="flex items-center gap-4 rounded-lg border bg-muted/40 p-4">
                <div className="flex size-14 shrink-0 items-center justify-center rounded-lg border bg-background text-primary">
                  <TagIcon className="size-6" />
                </div>
                <div className="min-w-0">
                  <div className="truncate font-medium">{name.trim() || "Tag name"}</div>
                  <div className="truncate font-mono text-xs text-muted-foreground">
                    /tags/{slug || "slug"}
                  </div>
                </div>
              </div>

              <Field data-invalid={Boolean(errors.name)}>
                <FieldLabel htmlFor="tag-name">Name</FieldLabel>
                <Input
                  id="tag-name"
                  placeholder="e.g. Summer Sale"
                  aria-invalid={Boolean(errors.name)}
                  autoFocus
                  {...form.register("name")}
                />
                <FieldError>{errors.name?.message}</FieldError>
              </Field>

              <Field data-invalid={Boolean(errors.slug)}>
                <FieldLabel htmlFor="tag-slug">Slug</FieldLabel>
                <Input
                  id="tag-slug"
                  placeholder="summer-sale"
                  className="font-mono lowercase"
                  aria-invalid={Boolean(errors.slug)}
                  {...form.register("slug", {
                    setValueAs: (value: string) => value.toLowerCase(),
                    onChange: () => setAutoSlug(false),
                  })}
                />
                {errors.slug ? (
                  <FieldError>{errors.slug.message}</FieldError>
                ) : (
                  <FieldDescription>
                    Used in the storefront URL. Must be unique.
                    {!autoSlug && name && (
                      <>
                        {" "}
                        <button
                          type="button"
                          className="underline underline-offset-2 hover:text-foreground"
                          onClick={() => setAutoSlug(true)}
                        >
                          Generate from name
                        </button>
                      </>
                    )}
                  </FieldDescription>
                )}
              </Field>
            </FieldGroup>
          </div>

          <SheetFooter className="flex-row justify-end border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : isNew ? "Add tag" : "Save changes"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
