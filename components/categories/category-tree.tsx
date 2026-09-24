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
  EyeOffIcon,
  FolderIcon,
  GripVerticalIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  MAX_CATEGORY_DEPTH,
  moveError,
  type CategoryNode,
} from "@/lib/category-tree"
import type { Category } from "@/lib/demo-data"
import { cn } from "@/lib/utils"

const ROOT = "root"

function canMove(categories: Category[], id: string, targetId: string) {
  const parentId = targetId === ROOT ? null : targetId
  const current = categories.find((c) => c.id === id)
  if (current?.parentId === parentId) return false
  return moveError(categories, id, parentId) === null
}

type TreeProps = {
  categories: Category[]
  tree: CategoryNode[]
  productCounts: Map<string, number>
  selectedId: string | null
  onSelect: (id: string) => void
  onMove: (id: string, parentId: string | null) => void
}

export function CategoryTree({
  categories,
  tree,
  productCounts,
  selectedId,
  onSelect,
  onMove,
}: TreeProps) {
  const [collapsed, setCollapsed] = React.useState<Set<string>>(new Set())
  const [activeId, setActiveId] = React.useState<string | null>(null)
  const sensors = useSensors(
    // A short drag distance keeps plain clicks selecting the row.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor)
  )

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
    if (target !== ROOT) {
      setCollapsed((current) => {
        const next = new Set(current)
        next.delete(target)
        return next
      })
    }
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
      <div className="overflow-hidden rounded-lg border">
        <div className="flex items-center justify-between border-b bg-muted px-3 py-2 text-xs font-medium text-muted-foreground">
          <span className="pl-11">Name</span>
          <span>Products</span>
        </div>
        <ul role="tree" aria-label="Category tree" className="divide-y">
          {tree.map((node) => (
            <TreeNode
              key={node.id}
              node={node}
              depth={1}
              collapsed={collapsed}
              onToggle={toggle}
              productCounts={productCounts}
              selectedId={selectedId}
              onSelect={onSelect}
              activeId={activeId}
              canDropOn={canDropOn}
            />
          ))}
        </ul>
        <RootDropZone visible={Boolean(activeId)} enabled={canDropOn(ROOT)} />
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Up to {MAX_CATEGORY_DEPTH} levels. A category can&apos;t be moved inside
        its own subcategories.
      </p>

      <DragOverlay dropAnimation={null}>
        {active ? (
          <div className="flex w-fit items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm font-medium shadow-lg">
            <FolderIcon className="size-4 text-muted-foreground" />
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
          "group flex cursor-pointer items-center gap-1 py-2 pr-3 text-sm outline-none select-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
          isSelected && "bg-accent hover:bg-accent",
          isDragging && "opacity-40",
          valid && "bg-primary/10 ring-2 ring-primary ring-inset",
          invalid && "cursor-not-allowed bg-destructive/5"
        )}
        style={{ paddingLeft: `${(depth - 1) * 20 + 4}px` }}
      >
        <GripVerticalIcon
          aria-hidden
          className="size-4 shrink-0 text-muted-foreground/40 group-hover:text-muted-foreground"
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label={isOpen ? `Collapse ${node.name}` : `Expand ${node.name}`}
          onClick={(e) => {
            e.stopPropagation()
            onToggle(node.id)
          }}
          className={cn(
            "flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted",
            !hasChildren && "invisible"
          )}
        >
          <ChevronRightIcon
            className={cn("size-4 transition-transform", isOpen && "rotate-90")}
          />
        </button>
        <FolderIcon
          aria-hidden
          className={cn(
            "size-4 shrink-0",
            isSelected ? "text-primary" : "text-muted-foreground"
          )}
        />
        <span
          className={cn(
            "ml-1.5 truncate",
            isSelected && "font-medium",
            !node.isActive && "text-muted-foreground"
          )}
        >
          {node.name}
        </span>
        {!node.isActive && (
          <Badge variant="outline" className="ml-1 text-muted-foreground">
            <EyeOffIcon />
            Hidden
          </Badge>
        )}
        <span className="ml-auto pl-3 text-muted-foreground tabular-nums">
          {productCounts.get(node.id) ?? 0}
        </span>
      </div>
      {isOpen && (
        <ul role="group" className="divide-y border-t">
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
              activeId={activeId}
              canDropOn={canDropOn}
            />
          ))}
        </ul>
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
        "flex items-center justify-center gap-2 border-t border-dashed px-3 text-sm text-muted-foreground transition-all",
        visible && enabled ? "h-14 opacity-100" : "h-0 overflow-hidden border-t-0 opacity-0",
        isOver && "bg-primary/10 text-primary"
      )}
    >
      <CornerLeftUpIcon className="size-4" />
      Drop here to make it a top-level category
    </div>
  )
}
