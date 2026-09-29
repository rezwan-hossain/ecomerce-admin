"use client"

import { useEffect, useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowDownIcon, ArrowUpIcon, Trash2Icon } from "lucide-react"
import { z } from "zod"

import type { ActionResponse } from "@/lib/action-response"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import {
  MAX_DEPTH,
  buildPath,
  findSiblingWithName,
  getDepth,
  slugify,
  validateMove,
} from "@/lib/categories/tree-utils"
import type { Category, CreateCategoryDto } from "@/types/category.type"

// A <Select> value can't be null, so "no parent" uses this value.
const TOP_LEVEL = "__top_level__"

const schema = z.object({
  name: z.string().trim().min(2, "Use at least 2 characters").max(100, "Name too long"),
  slug: z
    .string()
    .min(1, "Slug is required")
    .regex(/^[a-z0-9-]+$/, "Only lowercase letters, numbers, and hyphens"),
  parentId: z.string().nullable(),
  isActive: z.boolean(),
})

export function CategoryForm({
  categories,
  category,
  initialParentId,
  onDirtyChange,
  onSave,
  onDelete,
  isReordering,
  onMoveUp,
  onMoveDown,
}: {
  categories: Category[]
  category: Category | null // null when creating a new category
  initialParentId: string | null
  onDirtyChange: (dirty: boolean) => void
  onSave: (values: CreateCategoryDto) => Promise<ActionResponse<Category>>
  onDelete?: () => void
  isReordering: boolean
  onMoveUp: () => void
  onMoveDown: () => void
}) {
  const isNew = !category
  const [autoSlug, setAutoSlug] = useState(isNew)

  const form = useForm<CreateCategoryDto>({
    resolver: zodResolver(schema),
    defaultValues: category
      ? {
          name: category.name,
          slug: category.slug,
          parentId: category.parentId,
          isActive: category.isActive,
        }
      : { name: "", slug: "", parentId: initialParentId, isActive: true },
  })

  const { errors, isDirty, isSubmitting } = form.formState

  useEffect(() => {
    onDirtyChange(isDirty)
  }, [isDirty, onDirtyChange])

  const name = form.watch("name")
  const slug = form.watch("slug")
  const parentId = form.watch("parentId")

  // Keep the slug in sync with the name while auto mode is on.
  useEffect(() => {
    if (autoSlug && name) {
      form.setValue("slug", slugify(name), { shouldDirty: true })
    }
  }, [name, autoSlug, form])

  // Parents that would break the tree are disabled.
  const parentOptions = categories
    .filter((c) => c.id !== category?.id)
    .map((c) => ({
      id: c.id,
      name: c.name,
      depth: getDepth(categories, c.id),
      disabled: category
        ? validateMove(categories, category.id, c.id) !== null
        : !c.isActive || getDepth(categories, c.id) >= MAX_DEPTH,
    }))

  // Where the saved category sits among its siblings.
  const siblings = category ? categories.filter((c) => c.parentId === category.parentId) : []
  const index = siblings.findIndex((c) => c.id === category?.id)

  async function onSubmit(values: CreateCategoryDto) {
    if (findSiblingWithName(categories, values.name, values.parentId, category?.id)) {
      form.setError("name", { message: "A sibling with this name already exists" })
      return
    }

    const res = await onSave(values)

    if (res.success) {
      form.reset(values) // saved values become the new "clean" state
      return
    }

    // Show the backend's validation messages under the matching fields.
    for (const [field, message] of Object.entries(res.fieldErrors ?? {})) {
      form.setError(field as keyof CreateCategoryDto, { message })
    }
  }

  return (
    <Card className="shadow-sm">
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-(--card-spacing)">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{isNew ? "New Category" : "Edit Category"}</CardTitle>
          {isDirty && <Badge variant="secondary">Unsaved Changes</Badge>}
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input id="name" placeholder="e.g. Running Shoes" {...form.register("name")} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="slug">
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
              id="slug"
              readOnly={autoSlug}
              className="font-mono lowercase read-only:opacity-60"
              {...form.register("slug", { onChange: () => setAutoSlug(false) })}
            />
            {errors.slug && <p className="text-xs text-destructive">{errors.slug.message}</p>}
          </div>

          <div className="space-y-2">
            <Label>Storefront URL Preview</Label>
            <div className="truncate rounded-md border bg-muted/50 px-3 py-2 font-mono text-xs text-muted-foreground">
              yourstore.com
              <span className="text-foreground">{buildPath(categories, parentId, slug)}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="parent">Parent Category</Label>
            <Controller
              name="parentId"
              control={form.control}
              render={({ field }) => (
                <Select
                  value={field.value ?? TOP_LEVEL}
                  onValueChange={(value) => field.onChange(value === TOP_LEVEL ? null : value)}
                  items={[
                    { value: TOP_LEVEL, label: "None — Top Level" },
                    ...parentOptions.map((option) => ({ value: option.id, label: option.name })),
                  ]}
                >
                  <SelectTrigger id="parent" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={TOP_LEVEL}>None — Top Level</SelectItem>
                    {parentOptions.map((option) => (
                      <SelectItem
                        key={option.id}
                        value={option.id}
                        disabled={option.disabled}
                        style={{ paddingLeft: (option.depth - 1) * 12 + 8 }}
                      >
                        {option.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.parentId && (
              <p className="text-xs text-destructive">{errors.parentId.message}</p>
            )}
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label htmlFor="active">Show on storefront</Label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Controls customer visibility for this category
              </p>
            </div>
            <Controller
              name="isActive"
              control={form.control}
              render={({ field }) => (
                <Switch id="active" checked={field.value} onCheckedChange={field.onChange} />
              )}
            />
          </div>

          {category && (
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <div className="text-sm font-medium">Order</div>
                <p className="text-xs text-muted-foreground">
                  Position {index + 1} of {siblings.length}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={index === 0 || isReordering}
                  onClick={onMoveUp}
                >
                  <ArrowUpIcon data-icon="inline-start" />
                  Move up
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={index === siblings.length - 1 || isReordering}
                  onClick={onMoveDown}
                >
                  <ArrowDownIcon data-icon="inline-start" />
                  Move down
                </Button>
              </div>
            </div>
          )}

          {category && (
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border p-3 text-center">
                <div className="text-xs text-muted-foreground">Products</div>
                <div className="text-lg font-semibold">{category._count.products}</div>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <div className="text-xs text-muted-foreground">Subcategories</div>
                <div className="text-lg font-semibold">{category.children?.length ?? 0}</div>
              </div>
            </div>
          )}

          {onDelete && (
            <div className="flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/5 p-3">
              <div className="text-sm">
                <div className="font-medium">Delete category</div>
                <div className="text-xs text-muted-foreground">This action cannot be undone</div>
              </div>
              <Button type="button" variant="destructive" size="sm" onClick={onDelete}>
                <Trash2Icon data-icon="inline-start" />
                Delete
              </Button>
            </div>
          )}
        </CardContent>

        <CardFooter className="justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => form.reset()}
            disabled={!isDirty || isSubmitting}
          >
            Reset
          </Button>
          <Button type="submit" disabled={!isDirty || isSubmitting}>
            {isSubmitting ? "Saving..." : isNew ? "Create Category" : "Save Changes"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
