"use client"

import { useState } from "react"
import { PlusIcon } from "lucide-react"
import { toast } from "sonner"

import {
  createCategory,
  deleteCategory,
  deleteCategoryCascade,
  getCategoryTree,
  moveCategory,
  updateCategory,
} from "@/app/actions/category.actions"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { flattenTree, validateMove } from "@/lib/categories/tree-utils"
import type { Category, CreateCategoryDto } from "@/types/category.type"

import { DeleteCategoryDialog, DiscardChangesDialog } from "./category-dialogs"
import { CategoryForm } from "./category-form"
import { CategoryTree } from "./category-tree"

// What the form is showing: an existing category, or a new one.
type Selection = { mode: "edit"; id: string } | { mode: "new"; parentId: string | null }

export function CategoriesManager({ initialTree }: { initialTree: Category[] }) {
  const [tree, setTree] = useState(initialTree)
  const [selection, setSelection] = useState<Selection | null>(
    initialTree.length > 0 ? { mode: "edit", id: initialTree[0].id } : null
  )
  const [isDirty, setIsDirty] = useState(false)
  const [pendingSelection, setPendingSelection] = useState<Selection | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isReordering, setIsReordering] = useState(false)

  const categories = flattenTree(tree)
  const selected =
    selection?.mode === "edit" ? categories.find((c) => c.id === selection.id) : undefined
  const deletingCategory = categories.find((c) => c.id === deletingId)

  async function refresh() {
    const res = await getCategoryTree()
    if (res.success) setTree(res.data)
  }

  // Asks before throwing away unsaved form changes.
  function handleSelect(next: Selection) {
    if (isDirty) {
      setPendingSelection(next)
    } else {
      setSelection(next)
    }
  }

  async function handleSave(values: CreateCategoryDto) {
    // New categories go last among their siblings (the backend defaults to 0).
    const siblingCount = categories.filter((c) => c.parentId === values.parentId).length
    const res = selected
      ? await updateCategory(selected.id, values)
      : await createCategory({ ...values, position: siblingCount })

    if (!res.success) {
      toast.error(res.error)
      return res
    }

    toast.success(`${values.name} saved`)
    setIsDirty(false)
    await refresh()
    // Open the newly created category (after refresh, so it's in the tree).
    setSelection({ mode: "edit", id: res.data.id })
    return res
  }

  async function handleMove(categoryId: string, newParentId: string | null, position: number) {
    const error = validateMove(categories, categoryId, newParentId)
    if (error) {
      toast.error(error)
      return
    }

    const res = await moveCategory(categoryId, { newParentId, position })
    if (res.success) {
      toast.success("Category moved")
      await refresh()
    } else {
      toast.error(res.error)
    }
  }

  // Swaps the selected category with the sibling above or below it, then
  // saves every sibling's new position (0, 1, 2…).
  async function handleReorder(direction: "up" | "down") {
    const current = selected!
    const siblings = categories.filter((c) => c.parentId === current.parentId)
    const index = siblings.findIndex((c) => c.id === current.id)
    const newIndex = direction === "up" ? index - 1 : index + 1

    const reordered = [...siblings]
    reordered[index] = siblings[newIndex]
    reordered[newIndex] = current

    setIsReordering(true)
    let error = ""
    for (const [position, category] of reordered.entries()) {
      if (category.position === position) continue

      const res = await updateCategory(category.id, { position })
      if (!res.success) {
        error = res.error
        break
      }
    }

    if (error) {
      toast.error(error)
    } else {
      toast.success(`Moved ${current.name} ${direction}`)
    }
    await refresh()
    setIsReordering(false)
  }

  async function handleDelete(cascade: boolean) {
    const id = deletingId!
    const name = deletingCategory?.name
    const res = cascade ? await deleteCategoryCascade(id) : await deleteCategory(id)

    if (!res.success) {
      toast.error(res.error)
      return
    }

    toast.success(`${name} deleted`)
    setDeletingId(null)
    if (selected?.id === id) {
      const next = tree.find((c) => c.id !== id)
      setSelection(next ? { mode: "edit", id: next.id } : null)
      setIsDirty(false)
    }
    await refresh()
  }

  return (
    <>
      <PageHeader title="Categories" description="Organize your catalog into a browsable tree.">
        <Button onClick={() => handleSelect({ mode: "new", parentId: null })}>
          <PlusIcon data-icon="inline-start" />
          New Category
        </Button>
      </PageHeader>

      <div className="grid items-start gap-4 px-4 md:grid-cols-2 lg:px-6">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Category Tree</CardTitle>
          </CardHeader>
          <CardContent>
            <CategoryTree
              tree={tree}
              categories={categories}
              selectedId={selected?.id ?? null}
              onSelect={(id) => handleSelect({ mode: "edit", id })}
              onAddChild={(parentId) => handleSelect({ mode: "new", parentId })}
              onMove={handleMove}
            />
            <p className="mt-3 text-xs text-muted-foreground">
              {categories.length} categories total
            </p>
          </CardContent>
        </Card>

        <div className="md:sticky md:top-4">
          {selection && (
            <CategoryForm
              key={selection.mode === "edit" ? selection.id : `new-${selection.parentId}`}
              categories={categories}
              category={selected ?? null}
              initialParentId={selection.mode === "new" ? selection.parentId : null}
              onDirtyChange={setIsDirty}
              onSave={handleSave}
              onDelete={selected ? () => setDeletingId(selected.id) : undefined}
              isReordering={isReordering}
              onMoveUp={() => handleReorder("up")}
              onMoveDown={() => handleReorder("down")}
            />
          )}
        </div>
      </div>

      <DiscardChangesDialog
        open={pendingSelection !== null}
        onCancel={() => setPendingSelection(null)}
        onDiscard={() => {
          setSelection(pendingSelection)
          setPendingSelection(null)
          setIsDirty(false)
        }}
      />

      <DeleteCategoryDialog
        open={deletingId !== null}
        categoryName={deletingCategory?.name ?? ""}
        childCount={deletingCategory?.children?.length ?? 0}
        productCount={deletingCategory?._count.products ?? 0}
        onCancel={() => setDeletingId(null)}
        onConfirm={handleDelete}
      />
    </>
  )
}
