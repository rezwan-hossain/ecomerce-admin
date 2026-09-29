import { z } from "zod"

import { SLUG_PATTERN } from "@/lib/slug"

// Same rules as the backend's createBrandSchema (NestJS brand DTO).
export const brandSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Use at least 2 characters")
    .max(100, "Keep it under 100 characters"),
  slug: z
    .string()
    .trim()
    .min(2, "Use at least 2 characters")
    .max(120, "Keep it under 120 characters")
    .regex(SLUG_PATTERN, "Use lowercase letters, numbers and single hyphens"),
  // The backend accepts a full URL or an empty string (never null).
  logoUrl: z.union([
    z.literal(""),
    z.url("Enter a full URL, like https://example.com/logo.png"),
  ]),
})

export type BrandInput = z.input<typeof brandSchema>
export type BrandValues = z.output<typeof brandSchema>

export { slugify } from "@/lib/slug"
