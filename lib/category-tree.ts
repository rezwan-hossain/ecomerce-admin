/**
 * Helpers for working with the category tree.
 *
 * Categories are stored as a FLAT list, the same way the database stores
 * them. Each category points to its parent with `parentId` (null = top level)
 * and has a `position` that orders it among its siblings.
 *
 * Every function here is "pure": it takes the list, returns a result, and
 * never changes the list it was given. React components call these and put
 * the result into state.
 */
import type { Category } from "@/lib/demo-data"
import type { CategoryFormOutput } from "@/lib/validations/category"

/** How deep categories can be nested. A top-level category is level 1. */
export const MAX_CATEGORY_DEPTH = 5

/** A category plus its children, used to render the tree. */
export type CategoryNode = Category & { children: CategoryNode[] }

// ─── Reading the tree ──────────────────────────────────────────────────────

/** Sort by position first, then by name so equal positions stay stable. */
const byPosition = (a: Category, b: Category) =>
  a.position - b.position || a.name.localeCompare(b.name)

/** The direct children of `parentId` (null = top level), in display order. */
export function sortedSiblings(categories: Category[], parentId: string | null) {
  return categories.filter((c) => c.parentId === parentId).sort(byPosition)
}

/** Turns the flat list into nested nodes for rendering the tree. */
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
  const sortDeep = (list: CategoryNode[]) => {
    list.sort(byPosition)
    list.forEach((n) => sortDeep(n.children))
  }
  sortDeep(roots)
  return roots
}

/** The chain of parents from the top level down to `id` (inclusive). */
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

/** How deep a category sits: 1 for top level, 2 for its children, … */
export function depthOf(categories: Category[], id: string) {
  return ancestorsOf(categories, id).length
}

/** Every category below `id`: children, grandchildren, and so on. */
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

/** How many levels `id` and everything under it take up (a leaf is 1). */
export function subtreeHeight(categories: Category[], id: string): number {
  const children = categories.filter((c) => c.parentId === id)
  return 1 + Math.max(0, ...children.map((c) => subtreeHeight(categories, c.id)))
}

/** The position a new last child of `parentId` would get. */
export function nextPosition(categories: Category[], parentId: string | null) {
  const siblings = categories.filter((c) => c.parentId === parentId)
  return siblings.length ? Math.max(...siblings.map((c) => c.position)) + 1 : 0
}

/** The URL customers would see, e.g. "/categories/apparel/tops". */
export function storefrontPath(
  categories: Category[],
  parentId: string | null,
  slug: string
) {
  const parts = ancestorsOf(categories, parentId).map((c) => c.slug)
  return `/categories/${[...parts, slug || "…"].join("/")}`
}

// ─── Rules ─────────────────────────────────────────────────────────────────

/**
 * Can category `id` live under `parentId`? Returns the reason it can't,
 * or null if it can. Pass `id = null` for a category that isn't saved yet.
 *
 * Two rules:
 *   1. No loops: a category can't go inside itself or its own subcategories.
 *   2. No deeper than MAX_CATEGORY_DEPTH levels (counting its own children).
 */
export function moveError(
  categories: Category[],
  id: string | null,
  parentId: string | null
): string | null {
  if (parentId === null) return null // top level is always allowed

  if (id && (parentId === id || descendantIds(categories, id).has(parentId))) {
    return "A category can't be moved inside itself or its subcategories"
  }

  const levelsNeeded = id ? subtreeHeight(categories, id) : 1
  if (depthOf(categories, parentId) + levelsNeeded > MAX_CATEGORY_DEPTH) {
    return `Categories can only be nested ${MAX_CATEGORY_DEPTH} levels deep`
  }
  return null
}

/** Another category under `parentId` with the same name (ignoring case). */
export function findSiblingNamed(
  categories: Category[],
  name: string,
  parentId: string | null,
  exceptId: string | null
) {
  return categories.find(
    (c) =>
      c.id !== exceptId &&
      c.parentId === parentId &&
      c.name.toLowerCase() === name.toLowerCase()
  )
}

/**
 * Checks the rules the zod schema can't, because they need the other
 * categories. Returns an error message per form field (empty = all good).
 *
 * Mirrors the database constraints:
 *   slug @unique                  → no two categories share a slug
 *   @@unique([parentId, name])    → no two siblings share a name
 */
export function findCategoryConflicts(
  categories: Category[],
  editingId: string | null,
  values: CategoryFormOutput
) {
  const errors: Partial<Record<keyof CategoryFormOutput, string>> = {}

  if (categories.some((c) => c.id !== editingId && c.slug === values.slug)) {
    errors.slug = "This slug is already in use"
  }
  if (findSiblingNamed(categories, values.name, values.parentId, editingId)) {
    errors.name = values.parentId
      ? "Another subcategory here already has this name"
      : "Another top-level category already has this name"
  }
  const parentError = moveError(categories, editingId, values.parentId)
  if (parentError) errors.parentId = parentError

  return errors
}

// ─── Changing the tree ─────────────────────────────────────────────────────

/**
 * Moves category `id` under `parentId`, at `index` among its new siblings.
 * Returns the updated list.
 *
 * Positions are renumbered 0, 1, 2… in the new sibling group (and in the old
 * one, if the parent changed), so they never have gaps or duplicates.
 */
export function placeCategory(
  categories: Category[],
  id: string,
  parentId: string | null,
  index: number
): Category[] {
  const moving = categories.find((c) => c.id === id)
  if (!moving) return categories

  // Work out the new position of everything that's affected.
  const newPositions = new Map<string, { parentId: string | null; position: number }>()

  const newSiblings = sortedSiblings(categories, parentId).filter((c) => c.id !== id)
  newSiblings.splice(index, 0, moving)
  newSiblings.forEach((c, i) => newPositions.set(c.id, { parentId, position: i }))

  if (moving.parentId !== parentId) {
    // Close the gap it left behind in its old parent.
    sortedSiblings(categories, moving.parentId)
      .filter((c) => c.id !== id)
      .forEach((c, i) => newPositions.set(c.id, { parentId: c.parentId, position: i }))
  }

  // Apply them, only touching categories that actually changed.
  const now = new Date().toISOString()
  return categories.map((c) => {
    const next = newPositions.get(c.id)
    const unchanged = !next || (next.parentId === c.parentId && next.position === c.position)
    return unchanged ? c : { ...c, ...next, updatedAt: now }
  })
}

/**
 * Deletes category `id`. Returns the updated list.
 *
 * Its direct children move to the top level, like the database does with
 * `onDelete: SetNull`. Their own children come along with them.
 */
export function deleteCategory(categories: Category[], id: string): Category[] {
  let position = nextPosition(categories, null)
  return categories
    .filter((c) => c.id !== id)
    .map((c) => (c.parentId === id ? { ...c, parentId: null, position: position++ } : c))
}

// ─── Drag and drop ─────────────────────────────────────────────────────────

/**
 * Where on a row the category was dropped:
 *   "before" – top edge: becomes the sibling just above that row
 *   "inside" – middle:   becomes the last child of that row
 *   "after"  – bottom edge: becomes the sibling just below that row
 */
export type DropZone = "before" | "inside" | "after"

/**
 * Turns a drop into a move: the new parent, and the index among the new
 * siblings. `targetId = null` means the "make it top-level" drop area.
 * Returns null when the drop isn't allowed or wouldn't change anything.
 */
export function resolveDrop(
  categories: Category[],
  id: string,
  targetId: string | null,
  zone: DropZone
): { parentId: string | null; index: number } | null {
  const moving = categories.find((c) => c.id === id)
  if (!moving || targetId === id) return null

  let parentId: string | null
  let index: number

  if (targetId === null || zone === "inside") {
    // Becomes the last child of the target (or last at the top level).
    parentId = targetId
    index = sortedSiblings(categories, parentId).filter((c) => c.id !== id).length
  } else {
    // Becomes a sibling of the target, just before or after it.
    const target = categories.find((c) => c.id === targetId)
    if (!target) return null
    parentId = target.parentId
    const siblings = sortedSiblings(categories, parentId).filter((c) => c.id !== id)
    const targetIndex = siblings.findIndex((c) => c.id === targetId)
    index = zone === "before" ? targetIndex : targetIndex + 1
  }

  if (moveError(categories, id, parentId)) return null

  // Dropping it exactly where it already is does nothing.
  if (moving.parentId === parentId) {
    const currentIndex = sortedSiblings(categories, parentId).findIndex((c) => c.id === id)
    if (currentIndex === index) return null
  }
  return { parentId, index }
}
