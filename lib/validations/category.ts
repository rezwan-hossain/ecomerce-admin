import { z } from "zod"

import { SLUG_PATTERN } from "@/lib/slug"

/**
 * Validation rules for the "Edit category" form.
 *
 * They mirror the Prisma `Category` model:
 *   name     String
 *   slug     String  @unique
 *   parentId String?          (null = top-level category)
 *   isActive Boolean          ("Show on storefront")
 *
 * `position` is not part of the form: it's changed with the Move up/down
 * buttons or drag and drop, and saved straight away.
 *
 * Rules that need the other categories (unique slug, unique name among
 * siblings, max depth) can't live here. They're checked in
 * `findCategoryConflicts` in `lib/category-tree.ts` when the form is saved.
 */
export const categoryFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Category name is required")
    .max(100, "Keep it under 100 characters"),
  slug: z
    .string()
    .trim()
    .min(1, "Slug is required")
    .max(100, "Keep it under 100 characters")
    .regex(SLUG_PATTERN, "Use lowercase letters, numbers and single hyphens"),
  parentId: z.string().nullable(),
  isActive: z.boolean(),
})

/** What the form holds while the user is typing. */
export type CategoryFormValues = z.input<typeof categoryFormSchema>
/** What the form gives us after validation (names and slugs trimmed). */
export type CategoryFormOutput = z.output<typeof categoryFormSchema>
