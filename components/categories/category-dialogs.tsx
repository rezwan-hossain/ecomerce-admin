"use client"

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

/** Asks before throwing away unsaved form changes. */
export function DiscardChangesDialog({
  open,
  categoryName,
  onKeepEditing,
  onDiscard,
}: {
  open: boolean
  /** Name of the category being edited, or null for a new one. */
  categoryName: string | null
  onKeepEditing: () => void
  onDiscard: () => void
}) {
  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => !isOpen && onKeepEditing()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
          <AlertDialogDescription>
            Your edits to {categoryName ?? "the new category"} haven&apos;t been
            saved.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep editing</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onDiscard}>
            Discard
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/** Confirms deleting a category and explains what happens to its contents. */
export function DeleteCategoryDialog({
  open,
  categoryName,
  subcategoryCount,
  productCount,
  onCancel,
  onConfirm,
}: {
  open: boolean
  categoryName: string
  subcategoryCount: number
  productCount: number
  onCancel: () => void
  onConfirm: () => void
}) {
  const plural = (count: number, one: string, many: string) =>
    `${count} ${count === 1 ? one : many}`

  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {categoryName}?</AlertDialogTitle>
          <AlertDialogDescription>
            {subcategoryCount > 0 &&
              `${plural(subcategoryCount, "subcategory", "subcategories")} will move to the top level. `}
            {productCount > 0
              ? `${plural(productCount, "product", "products")} will be unlinked from this category but stay in your catalog. `
              : "No products are linked to it. "}
            This can&apos;t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            Delete category
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
