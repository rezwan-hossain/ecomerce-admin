import { z } from "zod"

import { SLUG_PATTERN } from "@/lib/slug"

// Client-side mirror of the Prisma `Category` model: name String,
// slug String @unique, isActive Boolean, position Int, parentId String?
export const categorySchema = z.object({
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
  position: z.coerce
    .number({ error: "Enter a number" })
    .int("Use a whole number")
    .min(0, "Can't be negative")
    .max(9999, "Keep it under 10,000"),
})

export type CategoryInput = z.input<typeof categorySchema>
export type CategoryValues = z.output<typeof categorySchema>
