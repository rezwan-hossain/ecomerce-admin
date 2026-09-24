"use client"

import * as React from "react"
import { PlusIcon } from "lucide-react"
import { toast } from "sonner"

import { CategoryApiPayloads } from "@/components/categories/category-api-payloads"
import {
  CategoryEditor,
  type CategoryDraft,
  type DraftErrors,
} from "@/components/categories/category-editor"
import { CategoryTree } from "@/components/categories/category-tree"
import { PageHeader } from "@/components/page-header"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { buildTree, moveError, nextPosition } from "@/lib/category-tree"
import type { Category, ProductCategoryLink } from "@/lib/demo-data"
import { uuidv7 } from "@/lib/uuid"
import { categorySchema } from "@/lib/validations/category"

function draftFrom(category: Category): CategoryDraft {
  return {
    name: category.name,
    slug: category.slug,
    parentId: category.parentId,
    isActive: category.isActive,
    position: String(category.position),
  }
}

function sameDraft(a: CategoryDraft, b: CategoryDraft) {
  return (
    a.name === b.name &&
    a.slug === b.slug &&
    a.parentId === b.parentId &&
    a.isActive === b.isActive &&
    a.position === b.position
  )
}

type Pending = { type: "select"; id: string } | { type: "new" }

export function CategoriesManager({
  initialCategories,
  initialLinks,
}: {
  initialCategories: Category[]
  initialLinks: ProductCategoryLink[]
}) {
  const [categories, setCategories] = React.useState(initialCategories)
  const [links, setLinks] = React.useState(initialLinks)
  const firstId = buildTree(initialCategories)[0]?.id ?? null
  // null while creating a new category.
  const [selectedId, setSelectedId] = React.useState<string | null>(firstId)
  const original = selectedId
    ? (categories.find((c) => c.id === selectedId) ?? null)
    : null
  const [draft, setDraft] = React.useState<CategoryDraft>(() => {
    const first = initialCategories.find((c) => c.id === firstId)
    return first ? draftFrom(first) : emptyDraft(initialCategories)
  })
  const [slugTouched, setSlugTouched] = React.useState(true)
  const [errors, setErrors] = React.useState<DraftErrors>({})
  const [pending, setPending] = React.useState<Pending | null>(null)
  const [confirmDelete, setConfirmDelete] = React.useState(false)

  const tree = React.useMemo(() => buildTree(categories), [categories])
  const productCounts = React.useMemo(() => {
    const counts = new Map<string, number>()
    for (const link of links) {
      counts.set(link.categoryId, (counts.get(link.categoryId) ?? 0) + 1)
    }
    return counts
  }, [links])
  const counts = (id: string) => ({
    products: productCounts.get(id) ?? 0,
    children: categories.filter((c) => c.parentId === id).length,
  })

  const dirty = original
    ? !sameDraft(draft, draftFrom(original))
    : Boolean(draft.name.trim() || draft.slug.trim())
  const hiddenCount = categories.filter((c) => !c.isActive).length

  function emptyDraft(list: Category[]): CategoryDraft {
    return {
      name: "",
      slug: "",
      parentId: null,
      isActive: true,
      position: String(nextPosition(list, null)),
    }
  }

  function load(target: Pending) {
    setErrors({})
    if (target.type === "new") {
      setSelectedId(null)
      setDraft(emptyDraft(categories))
      setSlugTouched(false)
    } else {
      const category = categories.find((c) => c.id === target.id)
      if (!category) return
      setSelectedId(category.id)
      setDraft(draftFrom(category))
      setSlugTouched(true)
    }
  }

  function request(target: Pending) {
    if (target.type === "select" && target.id === selectedId) return
    if (dirty) setPending(target)
    else load(target)
  }

  function update<K extends keyof CategoryDraft>(field: K, value: CategoryDraft[K]) {
    setDraft((current) => {
      const next = { ...current, [field]: value }
      // A new parent places it last there; switching back restores its order.
      if (field === "parentId" && value !== current.parentId) {
        next.position =
          original && value === original.parentId
            ? String(original.position)
            : String(
                nextPosition(
                  categories.filter((c) => c.id !== selectedId),
                  value as string | null
                )
              )
      }
      return next
    })
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  function validate(): Category | null {
    const result = categorySchema.safeParse(draft)
    const next: DraftErrors = {}
    if (!result.success) {
      for (const issue of result.error.issues) {
        const field = issue.path[0] as keyof CategoryDraft
        next[field] ??= issue.message
      }
      setErrors(next)
      return null
    }
    const values = result.data
    const others = categories.filter((c) => c.id !== selectedId)
    if (others.some((c) => c.slug === values.slug)) {
      next.slug = "This slug is already in use"
    }
    if (
      others.some(
        (c) =>
          c.parentId === values.parentId &&
          c.name.toLowerCase() === values.name.toLowerCase()
      )
    ) {
      next.name = values.parentId
        ? "Another subcategory here already has this name"
        : "Another top-level category already has this name"
    }
    const parentError = moveError(categories, selectedId, values.parentId)
    if (parentError) next.parentId = parentError
    setErrors(next)
    if (Object.keys(next).length) return null

    const now = new Date().toISOString()
    return original
      ? { ...original, ...values, updatedAt: now }
      : { id: uuidv7(), ...values, createdAt: now, updatedAt: now }
  }

  function save() {
    const saved = validate()
    if (!saved) {
      toast.error("Please fix the highlighted fields")
      return
    }
    if (original) {
      setCategories((current) => current.map((c) => (c.id === saved.id ? saved : c)))
      toast.success(`${saved.name} saved`)
    } else {
      setCategories((current) => [...current, saved])
      setSelectedId(saved.id)
      setSlugTouched(true)
      toast.success(`${saved.name} created`)
    }
    setDraft(draftFrom(saved))
  }

  function move(id: string, parentId: string | null) {
    const category = categories.find((c) => c.id === id)
    if (!category) return
    const clash = categories.some(
      (c) =>
        c.id !== id &&
        c.parentId === parentId &&
        c.name.toLowerCase() === category.name.toLowerCase()
    )
    if (clash) {
      toast.error(`There's already a “${category.name}” there`)
      return
    }
    const position = nextPosition(
      categories.filter((c) => c.id !== id),
      parentId
    )
    const moved = { ...category, parentId, position, updatedAt: new Date().toISOString() }
    setCategories((current) => current.map((c) => (c.id === id ? moved : c)))
    if (id === selectedId) {
      setDraft((current) => ({ ...current, parentId, position: String(position) }))
    }
    const parent = categories.find((c) => c.id === parentId)
    toast.success(
      parent ? `Moved ${category.name} into ${parent.name}` : `${category.name} is now top-level`
    )
  }

  function remove() {
    if (!original) return
    const orphans = categories.filter((c) => c.parentId === original.id)
    let position = nextPosition(categories, null)
    const remaining = categories
      .filter((c) => c.id !== original.id)
      .map((c) =>
        c.parentId === original.id ? { ...c, parentId: null, position: position++ } : c
      )
    setCategories(remaining)
    setLinks((current) => current.filter((l) => l.categoryId !== original.id))
    setConfirmDelete(false)
    toast.success(
      orphans.length
        ? `${original.name} deleted · ${orphans.length} moved to top level`
        : `${original.name} deleted`
    )
    const next = buildTree(remaining)[0]
    if (next) {
      setSelectedId(next.id)
      setDraft(draftFrom(next))
      setSlugTouched(true)
    } else {
      load({ type: "new" })
    }
    setErrors({})
  }

  const deleteCounts = original ? counts(original.id) : { products: 0, children: 0 }

  return (
    <>
      <PageHeader title="Categories" description="Organize your catalog into a browsable tree.">
        <Button onClick={() => request({ type: "new" })}>
          <PlusIcon data-icon="inline-start" />
          New category
        </Button>
      </PageHeader>

      <div className="grid items-start gap-4 px-4 lg:px-6 @5xl/main:grid-cols-[minmax(0,1fr)_400px]">
        <Card className="shadow-xs">
          <CardHeader>
            <CardTitle>Category tree</CardTitle>
            <CardDescription>
              Drag a category onto another to nest it.{" "}
              <span className="text-muted-foreground/80">
                {categories.length} categories
                {hiddenCount ? ` · ${hiddenCount} hidden` : ""}
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CategoryTree
              categories={categories}
              tree={tree}
              productCounts={productCounts}
              selectedId={selectedId}
              onSelect={(id) => request({ type: "select", id })}
              onMove={move}
            />
          </CardContent>
        </Card>

        <div className="@5xl/main:sticky @5xl/main:top-4">
          <CategoryEditor
            categories={categories}
            editingId={selectedId}
            draft={draft}
            errors={errors}
            dirty={dirty}
            slugTouched={slugTouched}
            productCount={original ? (productCounts.get(original.id) ?? 0) : 0}
            onChange={update}
            onSlugTouched={setSlugTouched}
            onSave={save}
            onDiscard={() => {
              if (original) {
                setDraft(draftFrom(original))
                setErrors({})
              } else {
                const first = buildTree(categories)[0]
                if (first) load({ type: "select", id: first.id })
              }
            }}
            onDelete={() => setConfirmDelete(true)}
          />
        </div>
      </div>

      <div className="px-4 lg:px-6">
        <CategoryApiPayloads
          categories={categories}
          original={original}
          draft={draft}
          counts={counts}
        />
      </div>

      <AlertDialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
            <AlertDialogDescription>
              Your edits to {original?.name ?? "the new category"} haven&apos;t
              been saved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (pending) load(pending)
                setPending(null)
              }}
            >
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {original?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteCounts.children > 0 &&
                `${deleteCounts.children} subcategor${deleteCounts.children === 1 ? "y" : "ies"} will move to the top level. `}
              {deleteCounts.products > 0
                ? `${deleteCounts.products} product${deleteCounts.products === 1 ? "" : "s"} will be unlinked from this category but stay in your catalog. `
                : "No products are linked to it. "}
              This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={remove}>
              Delete category
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

