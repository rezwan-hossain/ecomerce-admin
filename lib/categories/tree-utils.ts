import type { Category } from "@/types/category.type"

// GET /categories/tree only returns 4 levels.
export const MAX_DEPTH = 4

export function flattenTree(nodes: Category[]): Category[] {
  return nodes.flatMap((node) => [node, ...flattenTree(node.children ?? [])])
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
}

// e.g. "/electronics/audio/headphones"
export function buildPath(categories: Category[], parentId: string | null, slug: string) {
  const parts = [slug || "..."]
  let current = categories.find((c) => c.id === parentId)
  while (current) {
    parts.unshift(current.slug)
    const nextId = current.parentId
    current = categories.find((c) => c.id === nextId)
  }
  return "/" + parts.join("/")
}

// 1 = top level
export function getDepth(categories: Category[], id: string) {
  let depth = 1
  let current = categories.find((c) => c.id === id)
  while (current?.parentId) {
    depth++
    const nextId = current.parentId
    current = categories.find((c) => c.id === nextId)
  }
  return depth
}

// Levels used by a category and everything under it (no children = 1).
export function getSubtreeDepth(categories: Category[], id: string): number {
  const children = categories.filter((c) => c.parentId === id)
  if (children.length === 0) return 1
  return 1 + Math.max(...children.map((c) => getSubtreeDepth(categories, c.id)))
}

export function getDescendantIds(categories: Category[], id: string) {
  const ids = new Set<string>()
  const walk = (parentId: string) => {
    for (const category of categories) {
      if (category.parentId === parentId) {
        ids.add(category.id)
        walk(category.id)
      }
    }
  }
  walk(id)
  return ids
}

// Returns why a category can't go under `newParentId`, or null if it can.
export function validateMove(
  categories: Category[],
  categoryId: string,
  newParentId: string | null
): string | null {
  if (categoryId === newParentId) return "Cannot nest within itself"
  if (!newParentId) return null

  if (getDescendantIds(categories, categoryId).has(newParentId)) {
    return "Cannot move inside its own subcategory"
  }

  const parent = categories.find((c) => c.id === newParentId)
  if (parent && !parent.isActive) {
    return "Can't nest under a hidden category"
  }

  if (getDepth(categories, newParentId) + getSubtreeDepth(categories, categoryId) > MAX_DEPTH) {
    return `Exceeds maximum nesting depth of ${MAX_DEPTH}`
  }
  return null
}

export function findSiblingWithName(
  categories: Category[],
  name: string,
  parentId: string | null,
  excludeId?: string
) {
  return categories.find(
    (c) =>
      c.parentId === parentId &&
      c.id !== excludeId &&
      c.name.toLowerCase() === name.toLowerCase()
  )
}
