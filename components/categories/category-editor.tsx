"use client"

import * as React from "react"
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

export type CategoryDraft = {
  name: string
  slug: string
  parentId: string | null
  isActive: boolean
  position: string
}

export type DraftErrors = Partial<Record<keyof CategoryDraft, string>>

const ROOT_VALUE = "__root__"

function flatten(nodes: CategoryNode[], depth = 1): { node: CategoryNode; depth: number }[] {
  return nodes.flatMap((node) => [
    { node, depth },
    ...flatten(node.children, depth + 1),
  ])
}

function describeOrder(
  categories: Category[],
  editingId: string | null,
  draftParentId: string | null
) {
  const parentName = (id: string | null) => {
    const parent = categories.find((c) => c.id === id)
    return parent ? `in “${parent.name}”` : "at the top level"
  }
  const saved = editingId ? categories.find((c) => c.id === editingId) : null
  if (!saved) {
    return {
      label: `Will be added last ${parentName(draftParentId)}.`,
      canMoveUp: false,
      canMoveDown: false,
    }
  }
  if (saved.parentId !== draftParentId) {
    return {
      label: `Moves to the end ${parentName(draftParentId)} when saved.`,
      canMoveUp: false,
      canMoveDown: false,
    }
  }
  const siblings = sortedSiblings(categories, saved.parentId)
  const index = siblings.findIndex((c) => c.id === saved.id)
  return {
    label: `Position ${index + 1} of ${siblings.length} ${parentName(saved.parentId)}`,
    canMoveUp: index > 0,
    canMoveDown: index < siblings.length - 1,
  }
}

export function CategoryEditor({
  categories,
  editingId,
  draft,
  errors,
  dirty,
  slugTouched,
  productCount,
  onChange,
  onSlugTouched,
  onSave,
  onDiscard,
  onDelete,
  onReorder,
}: {
  categories: Category[]
  /** Id of the category being edited, or null when creating a new one. */
  editingId: string | null
  draft: CategoryDraft
  errors: DraftErrors
  dirty: boolean
  slugTouched: boolean
  productCount: number
  onChange: <K extends keyof CategoryDraft>(field: K, value: CategoryDraft[K]) => void
  onSlugTouched: (touched: boolean) => void
  onSave: () => void
  onDiscard: () => void
  onDelete: () => void
  /** Swaps the saved category with its previous or next sibling. */
  onReorder: (direction: "up" | "down") => void
}) {
  const isNew = editingId === null
  const subcategories = editingId
    ? categories.filter((c) => c.parentId === editingId).length
    : 0

  const order = describeOrder(categories, editingId, draft.parentId)

  const parentOptions = React.useMemo(
    () =>
      flatten(buildTree(categories))
        .filter(({ node }) => node.id !== editingId)
        .map(({ node, depth }) => ({
          value: node.id,
          label: node.name,
          depth,
          disabledReason: moveError(categories, editingId, node.id),
        })),
    [categories, editingId]
  )

  const selectItems = [
    { value: ROOT_VALUE, label: "None — top level" },
    ...parentOptions.map((o) => ({ value: o.value, label: o.label })),
  ]

  return (
    <Card className="shadow-xs">
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          onSave()
        }}
        className="flex flex-col gap-(--card-spacing)"
      >
        <CardHeader>
          <CardTitle>{isNew ? "New category" : "Edit category"}</CardTitle>
          <CardDescription>
            {isNew
              ? "It will be added at the end of its parent."
              : "Changes apply after you save."}
          </CardDescription>
          {dirty && (
            <CardAction>
              <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400">
                Unsaved changes
              </Badge>
            </CardAction>
          )}
        </CardHeader>

        <CardContent>
          <FieldGroup>
            <Field data-invalid={Boolean(errors.name)}>
              <FieldLabel htmlFor="category-name">
                Name <span className="text-destructive">*</span>
              </FieldLabel>
              <Input
                id="category-name"
                value={draft.name}
                onChange={(e) => {
                  onChange("name", e.target.value)
                  if (!slugTouched) onChange("slug", slugify(e.target.value))
                }}
                placeholder="e.g. Running Shoes"
                aria-invalid={Boolean(errors.name)}
              />
              <FieldError>{errors.name}</FieldError>
            </Field>

            <Field data-invalid={Boolean(errors.slug)}>
              <div className="flex items-center justify-between">
                <FieldLabel htmlFor="category-slug">
                  Slug <span className="text-destructive">*</span>
                </FieldLabel>
                {slugTouched ? (
                  <button
                    type="button"
                    onClick={() => {
                      onSlugTouched(false)
                      onChange("slug", slugify(draft.name))
                    }}
                    className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                  >
                    Generate from name
                  </button>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    Generated from name
                  </span>
                )}
              </div>
              <Input
                id="category-slug"
                value={draft.slug}
                onChange={(e) => {
                  onSlugTouched(true)
                  onChange("slug", e.target.value.toLowerCase())
                }}
                className="font-mono"
                aria-invalid={Boolean(errors.slug)}
              />
              <FieldError>{errors.slug}</FieldError>
            </Field>

            <Field>
              <FieldLabel>Storefront URL</FieldLabel>
              <div className="truncate rounded-md border bg-muted/50 px-2.5 py-1.5 font-mono text-xs text-muted-foreground">
                acme.store
                <span className="text-foreground">
                  {storefrontPath(categories, draft.parentId, draft.slug)}
                </span>
              </div>
            </Field>

            <Field data-invalid={Boolean(errors.parentId)}>
              <FieldLabel htmlFor="category-parent">Parent category</FieldLabel>
              <Select
                value={draft.parentId ?? ROOT_VALUE}
                onValueChange={(value) =>
                  onChange("parentId", !value || value === ROOT_VALUE ? null : value)
                }
                items={selectItems}
              >
                <SelectTrigger id="category-parent" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value={ROOT_VALUE}>None — top level</SelectItem>
                    {parentOptions.map((o) => (
                      <SelectItem
                        key={o.value}
                        value={o.value}
                        disabled={Boolean(o.disabledReason)}
                        style={{ paddingLeft: `${(o.depth - 1) * 16 + 8}px` }}
                      >
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              {errors.parentId ? (
                <FieldError>{errors.parentId}</FieldError>
              ) : (
                <FieldDescription>
                  You can also drag it onto another category in the tree.
                </FieldDescription>
              )}
            </Field>

            <Field>
              <FieldLabel htmlFor="category-active">Visibility</FieldLabel>
              <div className="flex items-center gap-2">
                <Switch
                  id="category-active"
                  checked={draft.isActive}
                  onCheckedChange={(checked) => onChange("isActive", checked)}
                />
                <span className="text-sm">Show on storefront</span>
              </div>
              <FieldDescription>
                {draft.isActive
                  ? "Customers can browse this category."
                  : "Hidden from the storefront. Its products can still be found elsewhere."}
              </FieldDescription>
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1 rounded-lg border p-4">
                <div className="text-sm font-medium">Order</div>
                <p className="text-sm text-muted-foreground">{order.label}</p>
                <div className="mt-2 flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!order.canMoveUp}
                    onClick={() => onReorder("up")}
                  >
                    Move up
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!order.canMoveDown}
                    onClick={() => onReorder("down")}
                  >
                    Move down
                  </Button>
                </div>
              </div>
              <div className="flex flex-col gap-1 rounded-lg border p-4">
                <div className="text-sm font-medium">Contents</div>
                <p className="text-sm text-muted-foreground">
                  {isNew
                    ? "Empty until you add products or subcategories."
                    : `${productCount} product${productCount === 1 ? "" : "s"}, ${subcategories} direct subcategor${subcategories === 1 ? "y" : "ies"}`}
                </p>
              </div>
            </div>

            {!isNew && (
              <div className="flex items-center justify-between gap-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                <div className="text-sm">
                  <div className="font-medium">Delete category</div>
                  <div className="text-xs text-muted-foreground">
                    Subcategories move up to the top level. Products stay in
                    your catalog.
                  </div>
                </div>
                <Button type="button" variant="destructive" size="sm" onClick={onDelete}>
                  <Trash2Icon data-icon="inline-start" />
                  Delete
                </Button>
              </div>
            )}
          </FieldGroup>
        </CardContent>

        <CardFooter className="justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={onDiscard}
            disabled={!dirty && !isNew}
          >
            {isNew ? "Cancel" : "Discard"}
          </Button>
          <Button type="submit" disabled={!dirty}>
            {isNew ? "Create category" : "Save changes"}
          </Button>
        </CardFooter>
      </form>

    </Card>
  )
}
