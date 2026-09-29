"use client"

import { useEffect, useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowDownIcon, ArrowUpIcon, FolderIcon, Trash2Icon } from "lucide-react"
import { z } from "zod"

import type { ActionResponse } from "@/lib/action-response"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
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

  const productCount = category?._count.products ?? 0
  const childCount = category?.children?.length ?? 0

  return (
    <Card className="gap-0 py-0 shadow-xs">
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <CardHeader className="border-b py-(--card-spacing)">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-primary/5 text-primary">
              <FolderIcon className="size-5" />
            </div>
            <div className="flex min-w-0 flex-col gap-0.5">
              <CardTitle className="truncate">
                {isNew ? "New category" : category.name}
              </CardTitle>
              <CardDescription className="truncate">
                {isNew
                  ? "Fill in the details, then create it."
                  : `${productCount} ${productCount === 1 ? "product" : "products"} · ${childCount} ${childCount === 1 ? "subcategory" : "subcategories"}`}
              </CardDescription>
            </div>
          </div>
          {isDirty && (
            <CardAction>
              <Badge variant="secondary">Unsaved changes</Badge>
            </CardAction>
          )}
        </CardHeader>

        <CardContent className="py-(--card-spacing)">
          <FieldGroup className="gap-5">
            <Field data-invalid={Boolean(errors.name)}>
              <FieldLabel htmlFor="name">Name</FieldLabel>
              <Input
                id="name"
                placeholder="e.g. Running Shoes"
                aria-invalid={Boolean(errors.name)}
                {...form.register("name")}
              />
              <FieldError>{errors.name?.message}</FieldError>
            </Field>

            <Field data-invalid={Boolean(errors.slug)}>
              <div className="flex items-center justify-between">
                <FieldLabel htmlFor="slug">Slug</FieldLabel>
                <button
                  type="button"
                  onClick={() => setAutoSlug(!autoSlug)}
                  className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                >
                  {autoSlug ? "Edit manually" : "Generate from name"}
                </button>
              </div>
              {/* readOnly, not disabled: disabled fields are left out of the submitted values */}
              <Input
                id="slug"
                readOnly={autoSlug}
                aria-invalid={Boolean(errors.slug)}
                className="font-mono lowercase read-only:bg-muted/50 read-only:text-muted-foreground"
                {...form.register("slug", { onChange: () => setAutoSlug(false) })}
              />
              {errors.slug ? (
                <FieldError>{errors.slug.message}</FieldError>
              ) : (
                <FieldDescription className="truncate font-mono text-xs">
                  yourstore.com
                  <span className="text-foreground">{buildPath(categories, parentId, slug)}</span>
                </FieldDescription>
              )}
            </Field>

            <Field data-invalid={Boolean(errors.parentId)}>
              <FieldLabel htmlFor="parent">Parent category</FieldLabel>
              <Controller
                name="parentId"
                control={form.control}
                render={({ field }) => (
                  <Select
                    value={field.value ?? TOP_LEVEL}
                    onValueChange={(value) => field.onChange(value === TOP_LEVEL ? null : value)}
                    items={[
                      { value: TOP_LEVEL, label: "None — top level" },
                      ...parentOptions.map((option) => ({ value: option.id, label: option.name })),
                    ]}
                  >
                    <SelectTrigger id="parent" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={TOP_LEVEL}>None — top level</SelectItem>
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
              <FieldError>{errors.parentId?.message}</FieldError>
            </Field>

            <FieldSeparator />

            <Field orientation="horizontal" className="has-[>[data-slot=field-content]]:items-center">
              <FieldContent>
                <FieldLabel htmlFor="active">Show on storefront</FieldLabel>
                <FieldDescription>Hidden categories stay out of the shop menu.</FieldDescription>
              </FieldContent>
              <Controller
                name="isActive"
                control={form.control}
                render={({ field }) => (
                  <Switch id="active" checked={field.value} onCheckedChange={field.onChange} />
                )}
              />
            </Field>

            {category && (
              <Field orientation="horizontal" className="has-[>[data-slot=field-content]]:items-center">
                <FieldContent>
                  <FieldLabel>Order</FieldLabel>
                  <FieldDescription>
                    Position {index + 1} of {siblings.length} in its level
                  </FieldDescription>
                </FieldContent>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    aria-label="Move up"
                    title="Move up"
                    disabled={index === 0 || isReordering}
                    onClick={onMoveUp}
                  >
                    <ArrowUpIcon />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    aria-label="Move down"
                    title="Move down"
                    disabled={index === siblings.length - 1 || isReordering}
                    onClick={onMoveDown}
                  >
                    <ArrowDownIcon />
                  </Button>
                </div>
              </Field>
            )}
          </FieldGroup>
        </CardContent>

        <CardFooter className="gap-2">
          {onDelete && (
            <Button
              type="button"
              variant="ghost"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={onDelete}
            >
              <Trash2Icon data-icon="inline-start" />
              Delete
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            className="ml-auto"
            onClick={() => form.reset()}
            disabled={!isDirty || isSubmitting}
          >
            Reset
          </Button>
          <Button type="submit" disabled={!isDirty || isSubmitting}>
            {isSubmitting ? "Saving..." : isNew ? "Create category" : "Save changes"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
