"use client"

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { ActionResponse } from "@/lib/action-response"
import { slugify } from "@/lib/categories/tree-utils"
import type { CreateTagDto, Tag } from "@/types/tag.type"

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(50, "Name too long"),
  slug: z
    .string()
    .min(1, "Slug is required")
    .regex(/^[a-z0-9-]+$/, "Only lowercase letters, numbers, and hyphens"),
})

// Add a new tag, or edit the selected one.
// Render with key={tag id} so each tag starts with a fresh form.
export function TagForm({
  tag,
  onSave,
  onCancel,
}: {
  tag: Tag | null // null when creating a new tag
  onSave: (values: CreateTagDto) => Promise<ActionResponse<Tag>>
  onCancel: () => void
}) {
  const isNew = !tag
  const [autoSlug, setAutoSlug] = useState(isNew)

  const form = useForm<CreateTagDto>({
    resolver: zodResolver(schema),
    defaultValues: { name: tag?.name ?? "", slug: tag?.slug ?? "" },
  })
  const { errors, isDirty, isSubmitting } = form.formState

  // Keep the slug in sync with the name while auto mode is on.
  const name = form.watch("name")
  useEffect(() => {
    if (autoSlug) {
      form.setValue("slug", slugify(name), { shouldDirty: true })
    }
  }, [name, autoSlug, form])

  async function onSubmit(values: CreateTagDto) {
    const res = await onSave(values)

    if (res.success) {
      form.reset(values) // saved values become the new "clean" state
      return
    }

    // Show the backend's validation messages under the matching fields.
    for (const [field, message] of Object.entries(res.fieldErrors ?? {})) {
      form.setError(field as keyof CreateTagDto, { message })
    }
  }

  return (
    <Card className="shadow-sm">
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-(--card-spacing)">
        <CardHeader>
          <CardTitle>{isNew ? "New Tag" : "Edit Tag"}</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tag-name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input id="tag-name" placeholder="e.g. Summer Sale" {...form.register("name")} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="tag-slug">
                Slug <span className="text-destructive">*</span>
              </Label>
              <button
                type="button"
                onClick={() => setAutoSlug(!autoSlug)}
                className="text-xs text-muted-foreground hover:text-foreground hover:underline"
              >
                {autoSlug ? "Edit manually" : "Auto-generate"}
              </button>
            </div>
            {/* readOnly, not disabled: disabled fields are left out of the submitted values */}
            <Input
              id="tag-slug"
              readOnly={autoSlug}
              className="font-mono lowercase read-only:opacity-60"
              {...form.register("slug", { onChange: () => setAutoSlug(false) })}
            />
            {errors.slug && <p className="text-xs text-destructive">{errors.slug.message}</p>}
          </div>
        </CardContent>

        <CardFooter className="justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={!isDirty || isSubmitting}>
            {isSubmitting ? "Saving..." : isNew ? "Create Tag" : "Save Changes"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
