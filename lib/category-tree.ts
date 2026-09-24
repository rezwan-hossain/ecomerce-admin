import type { Category } from "@/lib/demo-data"

/** Deepest nesting allowed: top level = 1. */
export const MAX_CATEGORY_DEPTH = 5

export type CategoryNode = Category & { children: CategoryNode[] }

const byPosition = (a: Category, b: Category) =>
  a.position - b.position || a.name.localeCompare(b.name)

export function sortedSiblings(categories: Category[], parentId: string | null) {
  return categories.filter((c) => c.parentId === parentId).sort(byPosition)
}

export function buildTree(categories: Category[]): CategoryNode[] {
  const nodes = new Map<string, CategoryNode>(
    categories.map((c) => [c.id, { ...c, children: [] }])
  )
  const roots: CategoryNode[] = []
  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : undefined
    if (parent) parent.children.push(node)
    else roots.push(node)
  }
  const sort = (list: CategoryNode[]) => {
    list.sort(byPosition)
    list.forEach((n) => sort(n.children))
  }
  sort(roots)
  return roots
}

/** Ancestors from the top level down to the direct parent. */
export function ancestorsOf(categories: Category[], id: string | null) {
  const byId = new Map(categories.map((c) => [c.id, c]))
  const chain: Category[] = []
  let current = id ? byId.get(id) : undefined
  while (current) {
    chain.unshift(current)
    current = current.parentId ? byId.get(current.parentId) : undefined
  }
  return chain
}

/** 1 for a top-level category. */
export function depthOf(categories: Category[], id: string) {
  return ancestorsOf(categories, id).length
}

export function descendantIds(categories: Category[], id: string) {
  const result = new Set<string>()
  const walk = (parentId: string) => {
    for (const c of categories) {
      if (c.parentId === parentId && !result.has(c.id)) {
        result.add(c.id)
        walk(c.id)
      }
    }
  }
  walk(id)
  return result
}

/** Levels in the subtree rooted at `id`, counting itself (a leaf is 1). */
export function subtreeHeight(categories: Category[], id: string): number {
  const children = categories.filter((c) => c.parentId === id)
  return 1 + Math.max(0, ...children.map((c) => subtreeHeight(categories, c.id)))
}

/**
 * Why `id` can't be placed under `parentId`, or null if it can.
 * `id` is null for a category that doesn't exist yet.
 */
export function moveError(
  categories: Category[],
  id: string | null,
  parentId: string | null
): string | null {
  if (parentId === null) return null
  if (id && (parentId === id || descendantIds(categories, id).has(parentId))) {
    return "A category can't be moved inside itself or its subcategories"
  }
  const height = id ? subtreeHeight(categories, id) : 1
  if (depthOf(categories, parentId) + height > MAX_CATEGORY_DEPTH) {
    return `Categories can only be nested ${MAX_CATEGORY_DEPTH} levels deep`
  }
  return null
}

export function storefrontPath(
  categories: Category[],
  parentId: string | null,
  slug: string
) {
  const parts = ancestorsOf(categories, parentId).map((c) => c.slug)
  return `/categories/${[...parts, slug || "…"].join("/")}`
}

export function nextPosition(categories: Category[], parentId: string | null) {
  const siblings = categories.filter((c) => c.parentId === parentId)
  return siblings.length ? Math.max(...siblings.map((c) => c.position)) + 1 : 0
}

export type DropZone = "before" | "inside" | "after"

/**
 * Where dropping `id` on `targetId` (null = the top-level drop zone) puts it:
 * the new parent, and its index among the new siblings (excluding itself).
 * Returns null when the drop is invalid or wouldn't change anything.
 */
export function resolveDrop(
  categories: Category[],
  id: string,
  targetId: string | null,
  zone: DropZone
): { parentId: string | null; index: number } | null {
  const current = categories.find((c) => c.id === id)
  if (!current || targetId === id) return null

  let parentId: string | null
  let index: number
  if (targetId === null || zone === "inside") {
    parentId = targetId
    index = sortedSiblings(categories, parentId).filter((c) => c.id !== id).length
  } else {
    const target = categories.find((c) => c.id === targetId)
    if (!target) return null
    parentId = target.parentId
    const siblings = sortedSiblings(categories, parentId).filter((c) => c.id !== id)
    const targetIndex = siblings.findIndex((c) => c.id === targetId)
    index = zone === "before" ? targetIndex : targetIndex + 1
  }

  if (moveError(categories, id, parentId)) return null
  if (current.parentId === parentId) {
    const currentIndex = sortedSiblings(categories, parentId).findIndex((c) => c.id === id)
    if (currentIndex === index) return null
  }
  return { parentId, index }
}
