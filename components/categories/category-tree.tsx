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
  type DragMoveEvent,
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
  resolveDrop,
  type CategoryNode,
  type DropZone,
} from "@/lib/category-tree"
import type { Category } from "@/lib/demo-data"
import { cn } from "@/lib/utils"

const ROOT = "root"
const INDENT = 22
const ROW_PADDING = 8
const CHEVRON = 20

type DropTarget = { id: string; zone: DropZone; valid: boolean }

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
  /** Moves `id` under `parentId` at `index` among its new siblings. */
  onPlace: (id: string, parentId: string | null, index: number) => void
  onAddChild: (parentId: string) => void
}

export function CategoryTree({
  categories,
  tree,
  productCounts,
  selectedId,
  onSelect,
  onPlace,
  onAddChild,
}: TreeProps) {
  const [collapsed, setCollapsed] = React.useState<Set<string>>(new Set())
  const [activeId, setActiveId] = React.useState<string | null>(null)
  const [dropTarget, setDropTarget] = React.useState<DropTarget | null>(null)
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

  /**
   * Top edge of a row = before it, bottom edge = after it, middle = inside.
   * An expanded parent has no "after" zone: the row below it is its own
   * first child, so dropping there reads as "inside".
   */
  function computeDrop(event: DragMoveEvent | DragEndEvent): DropTarget | null {
    const id = String(event.active.id)
    const over = event.over
    if (!over) return null
    const targetId = String(over.id)
    if (targetId === ROOT) {
      return { id: ROOT, zone: "inside", valid: Boolean(resolveDrop(categories, id, null, "inside")) }
    }

    let zone: DropZone = "inside"
    const start = event.activatorEvent
    if (start instanceof PointerEvent || start instanceof MouseEvent) {
      const y = start.clientY + event.delta.y
      const ratio = (y - over.rect.top) / over.rect.height
      const hasVisibleChildren =
        !collapsed.has(targetId) && categories.some((c) => c.parentId === targetId)
      if (ratio < 0.3) zone = "before"
      else if (ratio > 0.7 && !hasVisibleChildren) zone = "after"
    }
    return {
      id: targetId,
      zone,
      valid: Boolean(resolveDrop(categories, id, targetId, zone)),
    }
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id))
  }

  function handleDragMove(event: DragMoveEvent) {
    const next = computeDrop(event)
    setDropTarget((current) =>
      current?.id === next?.id && current?.zone === next?.zone && current?.valid === next?.valid
        ? current
        : next
    )
  }

  function handleDragEnd(event: DragEndEvent) {
    const id = String(event.active.id)
    const target = computeDrop(event)
    setActiveId(null)
    setDropTarget(null)
    if (!target?.valid) return
    const result = resolveDrop(
      categories,
      id,
      target.id === ROOT ? null : target.id,
      target.zone
    )
    if (!result) return
    onPlace(id, result.parentId, result.index)
    // Reveal the category in its new place.
    if (result.parentId) expand(result.parentId)
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
    dropTarget,
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        setActiveId(null)
        setDropTarget(null)
      }}
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

      <RootDropZone
        visible={Boolean(activeId)}
        over={dropTarget?.id === ROOT}
        valid={dropTarget?.id === ROOT ? dropTarget.valid : true}
      />

      <p className="mt-4 text-xs text-muted-foreground">
        Drop on the top or bottom edge of a row to reorder. Up to{" "}
        {MAX_CATEGORY_DEPTH} levels. A category can&apos;t be moved inside its
        own subcategories.
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
  dropTarget,
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
  dropTarget: DropTarget | null
}) {
  const drag = useDraggable({ id: node.id })
  const drop = useDroppable({ id: node.id })
  const hasChildren = node.children.length > 0
  const isOpen = hasChildren && !collapsed.has(node.id)
  const isSelected = selectedId === node.id
  const isDragging = activeId === node.id
  const target = dropTarget?.id === node.id && !isDragging ? dropTarget : null
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
          "group relative flex h-9.5 cursor-pointer items-center gap-2 rounded-md pr-1 text-sm outline-none select-none hover:bg-muted/70 focus-visible:ring-2 focus-visible:ring-ring",
          isSelected && "bg-primary/10 text-primary hover:bg-primary/15",
          isDragging && "opacity-40",
          target?.valid && target.zone === "inside" && "bg-primary/10 ring-2 ring-primary",
          target && !target.valid && "cursor-not-allowed bg-destructive/10"
        )}
        style={{ paddingLeft: indent }}
      >
        {target?.valid && target.zone !== "inside" && (
          <span
            aria-hidden
            className={cn(
              "pointer-events-none absolute right-2 z-10 flex items-center",
              target.zone === "before" ? "-top-[3px]" : "-bottom-[3px]"
            )}
            style={{ left: indent }}
          >
            <span className="size-1.5 shrink-0 rounded-full border-2 border-primary bg-background" />
            <span className="h-0.5 flex-1 rounded-full bg-primary" />
          </span>
        )}
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
                dropTarget={dropTarget}
              />
            ))}
          </ul>
        </div>
      )}
    </li>
  )
}

function RootDropZone({
  visible,
  over,
  valid,
}: {
  visible: boolean
  over: boolean
  valid: boolean
}) {
  const { setNodeRef } = useDroppable({ id: ROOT })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex items-center justify-center gap-2 rounded-md border border-dashed text-sm text-muted-foreground transition-all",
        visible ? "mt-2 h-12 opacity-100" : "h-0 overflow-hidden border-0 opacity-0",
        over && valid && "border-primary bg-primary/10 text-primary",
        over && !valid && "bg-destructive/10"
      )}
    >
      <CornerLeftUpIcon className="size-4" />
      Drop here to make it a top-level category
    </div>
  )
}
