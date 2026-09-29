"use client"

import { useDraggable, useDroppable } from "@dnd-kit/core"
import { ChevronRightIcon, PlusIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { MAX_DEPTH } from "@/lib/categories/tree-utils"
import { cn } from "@/lib/utils"
import type { Category } from "@/types/category.type"

const INDENT = 20

type CategoryTreeRowProps = {
  node: Category
  depth: number // 1 = top level
  collapsed: string[]
  selectedId: string | null
  draggedId: string | null
  onToggle: (id: string) => void
  onSelect: (id: string) => void
  onAddChild: (id: string) => void
}

// One row of the tree. It renders itself again for each child.
export function CategoryTreeRow(props: CategoryTreeRowProps) {
  const { node, depth, collapsed, selectedId, draggedId, onToggle, onSelect, onAddChild } = props

  const draggable = useDraggable({ id: node.id })
  const droppable = useDroppable({ id: node.id })

  const children = node.children ?? []
  const hasChildren = children.length > 0
  const isOpen = hasChildren && !collapsed.includes(node.id)
  const isSelected = selectedId === node.id
  const isDragged = draggedId === node.id
  const isDropTarget = droppable.isOver && !isDragged
  const canAddChild = depth < MAX_DEPTH

  // Stops a button click from also selecting or dragging the row.
  const stop = (event: React.SyntheticEvent) => event.stopPropagation()

  return (
    <li>
      <div
        ref={(element) => {
          draggable.setNodeRef(element)
          droppable.setNodeRef(element)
        }}
        {...draggable.attributes}
        {...draggable.listeners}
        onClick={() => onSelect(node.id)}
        style={{ paddingLeft: (depth - 1) * INDENT + 8 }}
        className={cn(
          "group flex h-10 cursor-pointer items-center gap-2 rounded-md pr-2 text-sm outline-none transition-colors hover:bg-muted/70 focus-visible:ring-2 focus-visible:ring-ring",
          isSelected && "bg-primary/10 text-primary hover:bg-primary/15",
          isDragged && "opacity-40",
          isDropTarget && "bg-primary/10 ring-2 ring-primary"
        )}
      >
        {hasChildren ? (
          <button
            type="button"
            tabIndex={-1}
            aria-label={isOpen ? "Collapse" : "Expand"}
            onPointerDown={stop}
            onClick={(event) => {
              stop(event)
              onToggle(node.id)
            }}
            className="flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ChevronRightIcon className={cn("size-4 transition-transform", isOpen && "rotate-90")} />
          </button>
        ) : (
          <span className="flex size-5 items-center justify-center">
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
            !node.isActive && !isSelected && "text-muted-foreground"
          )}
        >
          {node.name}
        </span>

        {!node.isActive && (
          <Badge
            variant="secondary"
            className="bg-amber-500/15 text-xs text-amber-700 dark:text-amber-400"
          >
            Hidden
          </Badge>
        )}

        <span
          className={cn(
            "ml-auto pl-2 text-xs tabular-nums",
            isSelected ? "text-primary" : "text-muted-foreground"
          )}
        >
          {node._count.products}
        </span>

        <button
          type="button"
          tabIndex={-1}
          disabled={!canAddChild}
          aria-label={`Add subcategory to ${node.name}`}
          title={canAddChild ? "Add subcategory" : "Max depth reached"}
          onPointerDown={stop}
          onClick={(event) => {
            stop(event)
            onAddChild(node.id)
          }}
          className="flex size-7 items-center justify-center rounded-md text-primary opacity-0 transition-opacity group-hover:opacity-100 hover:bg-primary/10 disabled:pointer-events-none disabled:opacity-30"
        >
          <PlusIcon className="size-4" />
        </button>
      </div>

      {isOpen && (
        <ul className="flex flex-col gap-0.5 pt-0.5">
          {children.map((child) => (
            <CategoryTreeRow key={child.id} {...props} node={child} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  )
}
