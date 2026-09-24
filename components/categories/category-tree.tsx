"use client"

import * as React from "react"
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import {
  ChevronRightIcon,
  CornerLeftUpIcon,
  PlusIcon,
  SearchIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  MAX_CATEGORY_DEPTH,
  moveError,
  type CategoryNode,
} from "@/lib/category-tree"
import type { Category } from "@/lib/demo-data"
import { cn } from "@/lib/utils"

const ROOT = "root"
const INDENT = 22
const ROW_PADDING = 8
const CHEVRON = 20

function canMove(categories: Category[], id: string, targetId: string) {
  const parentId = targetId === ROOT ? null : targetId
  const current = categories.find((c) => c.id === id)
  if (current?.parentId === parentId) return false
  return moveError(categories, id, parentId) === null
}

/** Keeps nodes that match the query, plus the ancestors leading to them. */
function filterTree(nodes: CategoryNode[], query: string): CategoryNode[] {
  return nodes.flatMap((node) => {
    const children = filterTree(node.children, query)
    const matches =
      node.name.toLowerCase().includes(query) || node.slug.includes(query)
    return matches || children.length ? [{ ...node, children }] : []
  })
}

type TreeProps = {
  categories: Category[]
  tree: CategoryNode[]
  productCounts: Map<string, number>
  selectedId: string | null
  onSelect: (id: string) => void
  onMove: (id: string, parentId: string | null) => void
  onAddChild: (parentId: string) => void
}

export function CategoryTree({
  categories,
  tree,
  productCounts,
  selectedId,
  onSelect,
  onMove,
  onAddChild,
}: TreeProps) {
  const [collapsed, setCollapsed] = React.useState<Set<string>>(new Set())
  const [activeId, setActiveId] = React.useState<string | null>(null)
  const [query, setQuery] = React.useState("")
  const sensors = useSensors(
    // A short drag distance keeps plain clicks selecting the row.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor)
  )

  const searching = query.trim().length > 0
  const visibleTree = searching
    ? filterTree(tree, query.trim().toLowerCase())
    : tree
  const active = activeId ? categories.find((c) => c.id === activeId) : null
  const canDropOn = (targetId: string) =>
    activeId !== null && canMove(categories, activeId, targetId)

  function toggle(id: string) {
    setCollapsed((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function expand(id: string) {
    setCollapsed((current) => {
      if (!current.has(id)) return current
      const next = new Set(current)
      next.delete(id)
      return next
    })
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id))
  }

  function handleDragEnd(event: DragEndEvent) {
    const id = String(event.active.id)
    const target = event.over ? String(event.over.id) : null
    setActiveId(null)
    if (!target || !canMove(categories, id, target)) return
    onMove(id, target === ROOT ? null : target)
    // Reveal the category in its new place.
    if (target !== ROOT) expand(target)
  }

  const shared = {
    collapsed: searching ? new Set<string>() : collapsed,
    onToggle: toggle,
    productCounts,
    selectedId,
    onSelect,
    onAddChild: (id: string) => {
      expand(id)
      onAddChild(id)
    },
    activeId,
    canDropOn,
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
      accessibility={{
        screenReaderInstructions: {
          draggable:
            "To pick up a category, press space or enter. Use arrow keys to move over another category, then press space or enter to nest it there. Press escape to cancel.",
        },
      }}
    >
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or slug"
          aria-label="Search categories"
          className="h-10 pl-9"
        />
      </div>

      <div className="mt-3 flex items-center justify-between border-b px-2 pb-2 text-xs text-muted-foreground">
        <span>Name</span>
        <span className="pr-9">Products</span>
      </div>

      {visibleTree.length ? (
        <ul role="tree" aria-label="Category tree" className="mt-1 flex flex-col gap-0.5">
          {visibleTree.map((node) => (
            <TreeNode key={node.id} node={node} depth={1} {...shared} />
          ))}
        </ul>
      ) : (
        <p className="py-10 text-center text-sm text-muted-foreground">
          No categories match &ldquo;{query.trim()}&rdquo;.
        </p>
      )}

      <RootDropZone visible={Boolean(activeId)} enabled={canDropOn(ROOT)} />

      <p className="mt-4 text-xs text-muted-foreground">
        Up to {MAX_CATEGORY_DEPTH} levels. A category can&apos;t be moved inside
        its own subcategories.
      </p>

      <DragOverlay dropAnimation={null}>
        {active ? (
          <div className="w-fit rounded-md border bg-background px-3 py-2 text-sm font-medium shadow-lg">
            {active.name}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

function TreeNode({
  node,
  depth,
  collapsed,
  onToggle,
  productCounts,
  selectedId,
  onSelect,
  onAddChild,
  activeId,
  canDropOn,
}: {
  node: CategoryNode
  depth: number
  collapsed: Set<string>
  onToggle: (id: string) => void
  productCounts: Map<string, number>
  selectedId: string | null
  onSelect: (id: string) => void
  onAddChild: (id: string) => void
  activeId: string | null
  canDropOn: (targetId: string) => boolean
}) {
  const drag = useDraggable({ id: node.id })
  const drop = useDroppable({ id: node.id })
  const hasChildren = node.children.length > 0
  const isOpen = hasChildren && !collapsed.has(node.id)
  const isSelected = selectedId === node.id
  const isDragging = activeId === node.id
  const valid = drop.isOver && canDropOn(node.id)
  const invalid = drop.isOver && !isDragging && !canDropOn(node.id)
  const canAddChild = depth < MAX_CATEGORY_DEPTH
  const indent = (depth - 1) * INDENT + ROW_PADDING

  return (
    <li
      role="treeitem"
      aria-expanded={hasChildren ? isOpen : undefined}
      aria-selected={isSelected}
      aria-level={depth}
    >
      <div
        ref={(el) => {
          drag.setNodeRef(el)
          drop.setNodeRef(el)
        }}
        {...drag.attributes}
        {...drag.listeners}
        role="button"
        aria-roledescription="Draggable category"
        onClick={() => onSelect(node.id)}
        className={cn(
          "group flex h-11 cursor-pointer items-center gap-2 rounded-md pr-1 text-sm outline-none select-none hover:bg-muted/70 focus-visible:ring-2 focus-visible:ring-ring",
          isSelected && "bg-primary/10 text-primary hover:bg-primary/15",
          isDragging && "opacity-40",
          valid && "bg-primary/10 ring-2 ring-primary",
          invalid && "cursor-not-allowed bg-destructive/10"
        )}
        style={{ paddingLeft: indent }}
      >
        {hasChildren ? (
          <button
            type="button"
            tabIndex={-1}
            aria-label={isOpen ? `Collapse ${node.name}` : `Expand ${node.name}`}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              onToggle(node.id)
            }}
            className="flex shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
            style={{ width: CHEVRON, height: CHEVRON }}
          >
            <ChevronRightIcon
              className={cn("size-4 transition-transform", isOpen && "rotate-90")}
            />
          </button>
        ) : (
          <span
            aria-hidden
            className="flex shrink-0 items-center justify-center"
            style={{ width: CHEVRON, height: CHEVRON }}
          >
            <span
              className={cn(
                "size-1.5 rounded-full",
                isSelected ? "bg-primary/60" : "bg-muted-foreground/40"
              )}
            />
          </span>
        )}
        <span
          className={cn(
            "truncate",
            depth === 1 && "font-semibold",
            isSelected && "font-medium",
            !node.isActive && !isSelected && "text-muted-foreground"
          )}
        >
          {node.name}
        </span>
        {!node.isActive && (
          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400">
            Hidden
          </Badge>
        )}
        <span
          className={cn(
            "ml-auto pl-3 tabular-nums",
            isSelected ? "text-primary" : "text-muted-foreground"
          )}
        >
          {productCounts.get(node.id) ?? 0}
        </span>
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                disabled={!canAddChild}
                aria-label={`Add subcategory to ${node.name}`}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation()
                  onAddChild(node.id)
                }}
                className="flex size-7 shrink-0 items-center justify-center rounded-md text-primary hover:bg-primary/10 disabled:pointer-events-none disabled:opacity-30"
              />
            }
          >
            <PlusIcon className="size-4" />
          </TooltipTrigger>
          <TooltipContent>
            {canAddChild ? "Add subcategory" : "Maximum depth reached"}
          </TooltipContent>
        </Tooltip>
      </div>
      {isOpen && (
        <div className="relative">
          {/* Guide line under the parent's chevron. */}
          <span
            aria-hidden
            className="absolute top-0 bottom-0 w-px bg-border"
            style={{ left: indent + CHEVRON / 2 }}
          />
          <ul role="group" className="flex flex-col gap-0.5 pt-0.5">
            {node.children.map((child) => (
              <TreeNode
                key={child.id}
                node={child}
                depth={depth + 1}
                collapsed={collapsed}
                onToggle={onToggle}
                productCounts={productCounts}
                selectedId={selectedId}
                onSelect={onSelect}
                onAddChild={onAddChild}
                activeId={activeId}
                canDropOn={canDropOn}
              />
            ))}
          </ul>
        </div>
      )}
    </li>
  )
}

function RootDropZone({ visible, enabled }: { visible: boolean; enabled: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: ROOT, disabled: !enabled })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex items-center justify-center gap-2 rounded-md border border-dashed text-sm text-muted-foreground transition-all",
        visible && enabled
          ? "mt-2 h-12 opacity-100"
          : "h-0 overflow-hidden border-0 opacity-0",
        isOver && "border-primary bg-primary/10 text-primary"
      )}
    >
      <CornerLeftUpIcon className="size-4" />
      Drop here to make it a top-level category
    </div>
  )
}
