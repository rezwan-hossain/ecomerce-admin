"use client"

import * as React from "react"
import { Controller, useFormContext, useWatch } from "react-hook-form"
import { Trash2Icon } from "lucide-react"

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
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import {
  buildTree,
  moveError,
  sortedSiblings,
  storefrontPath,
  type CategoryNode,
} from "@/lib/category-tree"
import type { Category } from "@/lib/demo-data"
import { slugify } from "@/lib/slug"
import type {
  CategoryFormOutput,
  CategoryFormValues,
} from "@/lib/validations/category"

type CategoryEditorProps = {
  categories: Category[]
  /** The saved category being edited, or null when creating a new one. */
  category: Category | null
  productCount: number
  onSave: (values: CategoryFormOutput) => void
  onDiscard: () => void
  onDelete: () => void
  /** Swaps the category with the sibling above or below it. */
  onReorder: (direction: "up" | "down") => void
}

/**
 * The "Edit category" / "New category" panel.
 *
 * The form itself (values, validation, dirty state) lives in the parent's
 * `useForm`, shared through <FormProvider>. This component only draws it.
 *
 * Give it a `key` of the category id, so switching categories starts fresh.
 */
export function CategoryEditor({
  categories,
  category,
  productCount,
  onSave,
  onDiscard,
  onDelete,
  onReorder,
}: CategoryEditorProps) {
  const isNew = category === null
  const form = useFormContext<CategoryFormValues, unknown, CategoryFormOutput>()
  const { isDirty, errors } = form.formState

  return (
    <Card className="shadow-xs">
      {/* handleSubmit validates with the zod schema first, then calls onSave. */}
      <form
        noValidate
        onSubmit={form.handleSubmit(onSave)}
        className="flex flex-col gap-(--card-spacing)"
      >
        <CardHeader>
          <CardTitle>{isNew ? "New category" : "Edit category"}</CardTitle>
          <CardDescription>
            {isNew
              ? "It will be added at the end of its parent."
              : "Changes apply after you save."}
          </CardDescription>
          {isDirty && (
            <CardAction>
              <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400">
                Unsaved changes
              </Badge>
            </CardAction>
          )}
        </CardHeader>

        <CardContent>
          <FieldGroup>
            <NameAndSlugFields autoSlugByDefault={isNew} />

            <StorefrontUrl categories={categories} />

            <ParentField categories={categories} editingId={category?.id ?? null} />

            <Field>
              <FieldLabel htmlFor="category-active">Visibility</FieldLabel>
              <Controller
                name="isActive"
                control={form.control}
                render={({ field }) => (
                  <>
                    <div className="flex items-center gap-2">
                      <Switch
                        id="category-active"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                      <span className="text-sm">Show on storefront</span>
                    </div>
                    <FieldDescription>
                      {field.value
                        ? "Customers can browse this category."
                        : "Hidden from the storefront. Its products can still be found elsewhere."}
                    </FieldDescription>
                  </>
                )}
              />
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <OrderCard
                categories={categories}
                category={category}
                onReorder={onReorder}
              />
              <InfoCard title="Contents">
                {isNew
                  ? "Empty until you add products or subcategories."
                  : contentsSummary(categories, category.id, productCount)}
              </InfoCard>
            </div>

            {!isNew && <DeleteZone onDelete={onDelete} />}

            {/* Errors that don't belong to one field, e.g. a failed save. */}
            {errors.root && <FieldError>{errors.root.message}</FieldError>}
          </FieldGroup>
        </CardContent>

        <CardFooter className="justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={onDiscard}
            disabled={!isDirty && !isNew}
          >
            {isNew ? "Cancel" : "Discard"}
          </Button>
          <Button type="submit" disabled={!isDirty}>
            {isNew ? "Create category" : "Save changes"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}

// ─── Fields ────────────────────────────────────────────────────────────────

/**
 * Name + slug. While `autoSlug` is on, typing a name also fills in the slug
 * ("Running Shoes" → "running-shoes"). Editing the slug by hand turns it off.
 */
function NameAndSlugFields({ autoSlugByDefault }: { autoSlugByDefault: boolean }) {
  const { register, setValue, getValues, formState } =
    useFormContext<CategoryFormValues>()
  const [autoSlug, setAutoSlug] = React.useState(autoSlugByDefault)
  const { errors } = formState

  function fillSlugFromName(name: string) {
    setValue("slug", slugify(name), {
      shouldDirty: true,
      // Re-check the slug right away if the user already tried to save.
      shouldValidate: formState.isSubmitted,
    })
  }

  return (
    <>
      <Field data-invalid={Boolean(errors.name)}>
        <FieldLabel htmlFor="category-name">
          Name <span className="text-destructive">*</span>
        </FieldLabel>
        <Input
          id="category-name"
          placeholder="e.g. Running Shoes"
          aria-invalid={Boolean(errors.name)}
          {...register("name", {
            onChange: (e) => {
              if (autoSlug) fillSlugFromName(e.target.value)
            },
          })}
        />
        <FieldError>{errors.name?.message}</FieldError>
      </Field>

      <Field data-invalid={Boolean(errors.slug)}>
        <div className="flex items-center justify-between">
          <FieldLabel htmlFor="category-slug">
            Slug <span className="text-destructive">*</span>
          </FieldLabel>
          {autoSlug ? (
            <span className="text-xs text-muted-foreground">Generated from name</span>
          ) : (
            <button
              type="button"
              onClick={() => {
                setAutoSlug(true)
                fillSlugFromName(getValues("name"))
              }}
              className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              Generate from name
            </button>
          )}
        </div>
        <Input
          id="category-slug"
          className="font-mono lowercase"
          aria-invalid={Boolean(errors.slug)}
          {...register("slug", {
            // Slugs are always lowercase, so lowercase as the user types.
            setValueAs: (value: string) => value.toLowerCase(),
            onChange: () => setAutoSlug(false),
          })}
        />
        <FieldError>{errors.slug?.message}</FieldError>
      </Field>
    </>
  )
}

/** Read-only preview of the category's URL, updated as you type. */
function StorefrontUrl({ categories }: { categories: Category[] }) {
  const { control } = useFormContext<CategoryFormValues>()
  const [slug, parentId] = useWatch({ control, name: ["slug", "parentId"] })

  return (
    <Field>
      <FieldLabel>Storefront URL</FieldLabel>
      <div className="truncate rounded-md border bg-muted/50 px-2.5 py-1.5 font-mono text-xs text-muted-foreground">
        acme.store
        <span className="text-foreground">
          {storefrontPath(categories, parentId, slug)}
        </span>
      </div>
    </Field>
  )
}

/** Value used in the <Select> for "no parent", since it can't hold null. */
const TOP_LEVEL = "__top_level__"

/**
 * Parent picker. Lists every category indented by depth, and disables the
 * ones that would break the tree (itself, its own subcategories, too deep).
 */
function ParentField({
  categories,
  editingId,
}: {
  categories: Category[]
  editingId: string | null
}) {
  const { control } = useFormContext<CategoryFormValues>()

  const options = React.useMemo(
    () =>
      flattenTree(buildTree(categories))
        .filter(({ node }) => node.id !== editingId)
        .map(({ node, depth }) => ({
          value: node.id,
          label: node.name,
          depth,
          disabled: moveError(categories, editingId, node.id) !== null,
        })),
    [categories, editingId]
  )

  return (
    <Controller
      name="parentId"
      control={control}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel htmlFor="category-parent">Parent category</FieldLabel>
          <Select
            value={field.value ?? TOP_LEVEL}
            onValueChange={(value) =>
              field.onChange(!value || value === TOP_LEVEL ? null : value)
            }
            items={[
              { value: TOP_LEVEL, label: "None — top level" },
              ...options.map(({ value, label }) => ({ value, label })),
            ]}
          >
            <SelectTrigger id="category-parent" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value={TOP_LEVEL}>None — top level</SelectItem>
                {options.map((option) => (
                  <SelectItem
                    key={option.value}
                    value={option.value}
                    disabled={option.disabled}
                    style={{ paddingLeft: `${(option.depth - 1) * 16 + 8}px` }}
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          {fieldState.error ? (
            <FieldError>{fieldState.error.message}</FieldError>
          ) : (
            <FieldDescription>
              You can also drag it onto another category in the tree.
            </FieldDescription>
          )}
        </Field>
      )}
    />
  )
}

function flattenTree(
  nodes: CategoryNode[],
  depth = 1
): { node: CategoryNode; depth: number }[] {
  return nodes.flatMap((node) => [
    { node, depth },
    ...flattenTree(node.children, depth + 1),
  ])
}

// ─── Cards ─────────────────────────────────────────────────────────────────

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border p-4">
      <div className="text-sm font-medium">{title}</div>
      <div className="text-sm text-muted-foreground">{children}</div>
    </div>
  )
}

/**
 * "Position 2 of 3 in “Apparel”" plus Move up / Move down.
 * Moving only works for a saved category that isn't switching parents.
 */
function OrderCard({
  categories,
  category,
  onReorder,
}: {
  categories: Category[]
  category: Category | null
  onReorder: (direction: "up" | "down") => void
}) {
  const { control } = useFormContext<CategoryFormValues>()
  const parentId = useWatch({ control, name: "parentId" })

  const whereLabel = (id: string | null) => {
    const parent = categories.find((c) => c.id === id)
    return parent ? `in “${parent.name}”` : "at the top level"
  }

  let text: string
  let index = -1
  let total = 0
  if (!category) {
    text = `Will be added last ${whereLabel(parentId)}.`
  } else if (category.parentId !== parentId) {
    text = `Moves to the end ${whereLabel(parentId)} when saved.`
  } else {
    const siblings = sortedSiblings(categories, category.parentId)
    index = siblings.findIndex((c) => c.id === category.id)
    total = siblings.length
    text = `Position ${index + 1} of ${total} ${whereLabel(category.parentId)}`
  }

  return (
    <InfoCard title="Order">
      <p>{text}</p>
      <div className="mt-3 flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={index <= 0}
          onClick={() => onReorder("up")}
        >
          Move up
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={index < 0 || index >= total - 1}
          onClick={() => onReorder("down")}
        >
          Move down
        </Button>
      </div>
    </InfoCard>
  )
}

function contentsSummary(categories: Category[], id: string, productCount: number) {
  const subcategories = categories.filter((c) => c.parentId === id).length
  const products = `${productCount} product${productCount === 1 ? "" : "s"}`
  const subs = `${subcategories} direct subcategor${subcategories === 1 ? "y" : "ies"}`
  return `${products}, ${subs}`
}

function DeleteZone({ onDelete }: { onDelete: () => void }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
      <div className="text-sm">
        <div className="font-medium">Delete category</div>
        <div className="text-xs text-muted-foreground">
          Subcategories move up to the top level. Products stay in your catalog.
        </div>
      </div>
      <Button type="button" variant="destructive" size="sm" onClick={onDelete}>
        <Trash2Icon data-icon="inline-start" />
        Delete
      </Button>
    </div>
  )
}
