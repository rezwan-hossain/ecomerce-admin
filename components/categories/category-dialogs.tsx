"use client"

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"

export function DiscardChangesDialog({
  open,
  onCancel,
  onDiscard,
}: {
  open: boolean
  onCancel: () => void
  onDiscard: () => void
}) {
  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
          <AlertDialogDescription>
            You have unsaved changes that will be lost.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep Editing</AlertDialogCancel>
          <Button variant="destructive" onClick={onDiscard}>
            Discard Changes
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export function DeleteCategoryDialog({
  open,
  categoryName,
  childCount,
  productCount,
  onCancel,
  onConfirm,
}: {
  open: boolean
  categoryName: string
  childCount: number
  productCount: number
  onCancel: () => void
  onConfirm: (cascade: boolean) => void
}) {
  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete &ldquo;{categoryName}&rdquo;?</AlertDialogTitle>
          <AlertDialogDescription render={<div className="space-y-2" />}>
            <p>
              This category has <strong>{productCount}</strong>{" "}
              {productCount === 1 ? "product" : "products"} and <strong>{childCount}</strong>{" "}
              {childCount === 1 ? "subcategory" : "subcategories"}.
            </p>
            {childCount > 0 && (
              <p className="text-xs">
                <strong className="text-foreground">Delete all</strong> removes this category and
                every subcategory inside it.
              </p>
            )}
            <p className="text-xs">
              A category can only be deleted on its own when it has no subcategories and no
              products. Products are never deleted, only unlinked.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          {childCount > 0 ? (
            <Button variant="destructive" onClick={() => onConfirm(true)}>
              Delete all
            </Button>
          ) : (
            <Button variant="destructive" onClick={() => onConfirm(false)}>
              Delete
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
