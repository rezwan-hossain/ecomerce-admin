import { z } from "zod"

// Client-side mirror of the Prisma `Brand` model constraints:
// name @unique, slug @unique, logoUrl String?
export const brandSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Brand name is required")
    .max(100, "Keep it under 100 characters"),
  slug: z
    .string()
    .trim()
    .min(1, "Slug is required")
    .max(100, "Keep it under 100 characters")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Use lowercase letters, numbers and single hyphens"
    ),
  logoUrl: z
    .union([
      z.literal(""),
      z
        .string()
        .trim()
        .refine(
          (value) => value.startsWith("/") || URL.canParse(value),
          "Enter a full URL (https://…) or a path starting with /"
        ),
    ])
    .transform((value) => value || null),
})

export type BrandInput = z.input<typeof brandSchema>
export type BrandValues = z.output<typeof brandSchema>

export function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
}
