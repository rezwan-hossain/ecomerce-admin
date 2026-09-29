"use client"

import * as React from "react"

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
import type { Brand } from "@/types/brand.type"

export function DeleteBrandDialog({
  brand,
  onOpenChange,
  onConfirm,
  isDeleting,
}: {
  brand: Brand | null
  onOpenChange: (open: boolean) => void
  onConfirm: (brand: Brand) => void
  isDeleting: boolean
}) {
  // Keep showing the last brand while the dialog animates closed.
  const [shown, setShown] = React.useState(brand)
  if (brand && brand !== shown) setShown(brand)
  const count = shown?._count.products ?? 0

  return (
    <AlertDialog open={Boolean(brand)} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {shown?.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            {count > 0 ? (
              <>
                {count} product{count === 1 ? "" : "s"} will stay in your
                catalog but will no longer have a brand.
              </>
            ) : (
              <>No products use this brand.</>
            )}{" "}
            This can&apos;t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          {/* Disabled while deleting, so a double-click can't send two deletes. */}
          <AlertDialogAction
            variant="destructive"
            disabled={isDeleting}
            onClick={() => brand && onConfirm(brand)}
          >
            {isDeleting ? "Deleting..." : "Delete brand"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
