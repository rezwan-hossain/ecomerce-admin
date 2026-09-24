"use client"

/**
 * The Categories page.
 *
 * This component owns the page's data and connects the pieces:
 *
 *   ┌──────────────── CategoriesManager ─────────────────┐
 *   │  CategoryTree          │  CategoryEditor (the form) │
 *   │  (browse, drag, +)     │                            │
 *   ├────────────────────────┴────────────────────────────┤
 *   │  CategoryApiPayloads (what each action would send)  │
 *   └─────────────────────────────────────────────────────┘
 *
 * Data:
 *   categories  – the saved categories (a flat list, like the database)
 *   links       – which products are in which category
 *   selectedId  – the category open in the editor (null = creating a new one)
 *   form        – React Hook Form state for the editor (see useForm below)
 *
 * The tree logic itself (moving, deleting, rules) lives in
 * lib/category-tree.ts as plain functions, so this file stays about wiring.
 */
import * as React from "react"
import { FormProvider, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { PlusIcon } from "lucide-react"
import { toast } from "sonner"

import { CategoryApiPayloads } from "@/components/categories/category-api-payloads"
import {
  DeleteCategoryDialog,
  DiscardChangesDialog,
} from "@/components/categories/category-dialogs"
import { CategoryEditor } from "@/components/categories/category-editor"
import { CategoryTree } from "@/components/categories/category-tree"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  buildTree,
  deleteCategory,
  findCategoryConflicts,
  findSiblingNamed,
  nextPosition,
  placeCategory,
  sortedSiblings,
} from "@/lib/category-tree"
import type { Category, ProductCategoryLink } from "@/lib/demo-data"
import { uuidv7 } from "@/lib/uuid"
import {
  categoryFormSchema,
  type CategoryFormOutput,
  type CategoryFormValues,
} from "@/lib/validations/category"

/** Form values for an existing category. */
function toFormValues(category: Category): CategoryFormValues {
  return {
    name: category.name,
    slug: category.slug,
    parentId: category.parentId,
    isActive: category.isActive,
  }
}

/** Form values for a brand-new category. */
function emptyFormValues(parentId: string | null = null): CategoryFormValues {
  return { name: "", slug: "", parentId, isActive: true }
}

/** Something the user asked to open, which may need a "discard?" check first. */
type OpenRequest =
  | { type: "edit"; id: string }
  | { type: "new"; parentId: string | null }

export function CategoriesManager({
  initialCategories,
  initialLinks,
}: {
  initialCategories: Category[]
  initialLinks: ProductCategoryLink[]
}) {
  // ── State ────────────────────────────────────────────────────────────────
  const [categories, setCategories] = React.useState(initialCategories)
  const [links, setLinks] = React.useState(initialLinks)
  const [selectedId, setSelectedId] = React.useState<string | null>(
    () => buildTree(initialCategories)[0]?.id ?? null
  )
  // Set while the "Discard unsaved changes?" dialog is asking.
  const [waitingToOpen, setWaitingToOpen] = React.useState<OpenRequest | null>(null)
  const [confirmingDelete, setConfirmingDelete] = React.useState(false)

  const selected = categories.find((c) => c.id === selectedId) ?? null

  // ── The form ─────────────────────────────────────────────────────────────
  // zodResolver runs categoryFormSchema on submit and puts any errors into
  // form.formState.errors. formState.isDirty tells us about unsaved changes.
  const form = useForm<CategoryFormValues, unknown, CategoryFormOutput>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: selected ? toFormValues(selected) : emptyFormValues(),
  })
  const hasUnsavedChanges = form.formState.isDirty

  // ── Derived data ─────────────────────────────────────────────────────────
  const tree = React.useMemo(() => buildTree(categories), [categories])

  const productCounts = React.useMemo(() => {
    const counts = new Map<string, number>()
    for (const link of links) {
      counts.set(link.categoryId, (counts.get(link.categoryId) ?? 0) + 1)
    }
    return counts
  }, [links])

  const productCountOf = (id: string) => productCounts.get(id) ?? 0
  const childCountOf = (id: string) => categories.filter((c) => c.parentId === id).length
  const hiddenCount = categories.filter((c) => !c.isActive).length

  // ── Opening a category (or a blank form) ─────────────────────────────────

  /** Opens something in the editor, no questions asked. */
  function open(request: OpenRequest) {
    if (request.type === "edit") {
      const category = categories.find((c) => c.id === request.id)
      if (!category) return
      setSelectedId(category.id)
      form.reset(toFormValues(category))
    } else {
      setSelectedId(null)
      form.reset(emptyFormValues(request.parentId))
    }
  }

  /** Opens something, but asks first if the current form has unsaved edits. */
  function requestOpen(request: OpenRequest) {
    if (request.type === "edit" && request.id === selectedId) return
    if (hasUnsavedChanges) setWaitingToOpen(request)
    else open(request)
  }

  // ── Saving the form ──────────────────────────────────────────────────────

  /** Called by the form after the zod schema has passed. */
  function save(values: CategoryFormOutput) {
    // Rules that depend on other categories (unique slug, sibling names, depth).
    const conflicts = findCategoryConflicts(categories, selectedId, values)
    const fields = Object.keys(conflicts) as (keyof typeof conflicts)[]
    if (fields.length) {
      fields.forEach((field) => form.setError(field, { message: conflicts[field] }))
      toast.error("Please fix the highlighted fields")
      return
    }

    const now = new Date().toISOString()

    if (selected) {
      // Update. Moving to a new parent puts it at the end there.
      const parentChanged = values.parentId !== selected.parentId
      const updated: Category = {
        ...selected,
        ...values,
        position: parentChanged ? nextPosition(categories, values.parentId) : selected.position,
        updatedAt: now,
      }
      setCategories((current) => current.map((c) => (c.id === updated.id ? updated : c)))
      form.reset(toFormValues(updated)) // saved values become the new "clean" state
      toast.success(`${updated.name} saved`)
    } else {
      // Create. New categories go at the end of their parent.
      const created: Category = {
        id: uuidv7(),
        ...values,
        position: nextPosition(categories, values.parentId),
        createdAt: now,
        updatedAt: now,
      }
      setCategories((current) => [...current, created])
      setSelectedId(created.id)
      form.reset(toFormValues(created))
      toast.success(`${created.name} created`)
    }
  }

  function discardChanges() {
    if (selected) form.reset() // back to the last saved values
    else if (tree[0]) open({ type: "edit", id: tree[0].id }) // cancel "new"
  }

  // ── Moving (drag and drop, Move up / Move down) ──────────────────────────
  // Moves are saved immediately, unlike form edits.

  function move(id: string, parentId: string | null, index: number) {
    const category = categories.find((c) => c.id === id)
    if (!category) return

    const parentChanged = category.parentId !== parentId
    if (parentChanged && findSiblingNamed(categories, category.name, parentId, id)) {
      toast.error(`There's already a “${category.name}” there`)
      return
    }

    setCategories(placeCategory(categories, id, parentId, index))

    // If the open category moved, its saved parent changed too. Update the
    // form's "saved" value for parentId without losing other unsaved edits.
    if (id === selectedId) form.resetField("parentId", { defaultValue: parentId })

    const parent = categories.find((c) => c.id === parentId)
    toast.success(
      !parentChanged
        ? `Moved ${category.name} to position ${index + 1}`
        : parent
          ? `Moved ${category.name} into ${parent.name}`
          : `${category.name} is now top-level`
    )
  }

  function moveUpOrDown(direction: "up" | "down") {
    if (!selected) return
    const siblings = sortedSiblings(categories, selected.parentId)
    const index = siblings.findIndex((c) => c.id === selected.id)
    const newIndex = direction === "up" ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= siblings.length) return
    move(selected.id, selected.parentId, newIndex)
  }

  // ── Deleting ─────────────────────────────────────────────────────────────

  function confirmDelete() {
    if (!selected) return
    const orphanCount = childCountOf(selected.id)
    const remaining = deleteCategory(categories, selected.id)

    setCategories(remaining)
    setLinks((current) => current.filter((l) => l.categoryId !== selected.id))
    setConfirmingDelete(false)
    toast.success(
      orphanCount
        ? `${selected.name} deleted · ${orphanCount} moved to top level`
        : `${selected.name} deleted`
    )

    // Open the first remaining category, or a blank form if none are left.
    const first = buildTree(remaining)[0]
    if (first) {
      setSelectedId(first.id)
      form.reset(toFormValues(first))
    } else {
      open({ type: "new", parentId: null })
    }
  }

  // ── Page ─────────────────────────────────────────────────────────────────
  return (
    <FormProvider {...form}>
      <PageHeader title="Categories" description="Organize your catalog into a browsable tree.">
        <Button onClick={() => requestOpen({ type: "new", parentId: null })}>
          <PlusIcon data-icon="inline-start" />
          New category
        </Button>
      </PageHeader>

      <div className="grid items-start gap-4 px-4 lg:px-6 @5xl/main:grid-cols-2">
        <Card className="shadow-xs">
          <CardHeader>
            <CardTitle>Category tree</CardTitle>
            <CardAction className="self-center text-sm text-muted-foreground">
              Drag a category onto another to nest it.
            </CardAction>
          </CardHeader>
          <CardContent>
            <CategoryTree
              categories={categories}
              tree={tree}
              productCounts={productCounts}
              selectedId={selectedId}
              onSelect={(id) => requestOpen({ type: "edit", id })}
              onPlace={move}
              onAddChild={(parentId) => requestOpen({ type: "new", parentId })}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {categories.length} categories
              {hiddenCount ? ` · ${hiddenCount} hidden` : ""}
            </p>
          </CardContent>
        </Card>

        <div className="@5xl/main:sticky @5xl/main:top-4">
          <CategoryEditor
            // A new key per category resets the editor's own UI state
            // (like "generate slug from name") when you switch categories.
            key={selectedId ?? "new"}
            categories={categories}
            category={selected}
            productCount={selected ? productCountOf(selected.id) : 0}
            onSave={save}
            onDiscard={discardChanges}
            onDelete={() => setConfirmingDelete(true)}
            onReorder={moveUpOrDown}
          />
        </div>
      </div>

      <div className="px-4 lg:px-6">
        <CategoryApiPayloads
          categories={categories}
          original={selected}
          counts={(id) => ({ products: productCountOf(id), children: childCountOf(id) })}
        />
      </div>

      <DiscardChangesDialog
        open={waitingToOpen !== null}
        categoryName={selected?.name ?? null}
        onKeepEditing={() => setWaitingToOpen(null)}
        onDiscard={() => {
          if (waitingToOpen) open(waitingToOpen)
          setWaitingToOpen(null)
        }}
      />

      <DeleteCategoryDialog
        open={confirmingDelete}
        categoryName={selected?.name ?? ""}
        subcategoryCount={selected ? childCountOf(selected.id) : 0}
        productCount={selected ? productCountOf(selected.id) : 0}
        onCancel={() => setConfirmingDelete(false)}
        onConfirm={confirmDelete}
      />
    </FormProvider>
  )
}
