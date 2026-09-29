"use client"

import { useState } from "react"
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import { CornerLeftUpIcon, SearchIcon } from "lucide-react"

import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { Category } from "@/types/category.type"

import { CategoryTreeRow } from "./category-tree-row"

const TOP_LEVEL_ID = "__root__"

// Keeps matching categories, plus their parents so you can see where they are.
function filterTree(nodes: Category[], search: string): Category[] {
  return nodes.flatMap((node) => {
    const children = filterTree(node.children ?? [], search)
    const matches =
      node.name.toLowerCase().includes(search) || node.slug.toLowerCase().includes(search)
    return matches || children.length > 0 ? [{ ...node, children }] : []
  })
}

export function CategoryTree({
  tree,
  categories,
  selectedId,
  onSelect,
  onAddChild,
  onMove,
}: {
  tree: Category[]
  categories: Category[]
  selectedId: string | null
  onSelect: (id: string) => void
  onAddChild: (parentId: string) => void
  onMove: (categoryId: string, parentId: string | null, position: number) => void
}) {
  const [search, setSearch] = useState("")
  const [collapsed, setCollapsed] = useState<string[]>([])
  const [draggedId, setDraggedId] = useState<string | null>(null)

  // A drag starts after moving 6px, so a normal click still selects the row.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  function toggle(id: string) {
    if (collapsed.includes(id)) {
      setCollapsed(collapsed.filter((c) => c !== id))
    } else {
      setCollapsed([...collapsed, id])
    }
  }

  function expand(id: string) {
    setCollapsed(collapsed.filter((c) => c !== id))
  }

  // Dropping on a row makes the category its last child.
  function handleDragEnd(event: DragEndEvent) {
    setDraggedId(null)
    const activeId = String(event.active.id)
    const overId = event.over ? String(event.over.id) : null
    if (!overId || activeId === overId) return

    const newParentId = overId === TOP_LEVEL_ID ? null : overId
    const siblings = categories.filter((c) => c.parentId === newParentId)
    onMove(activeId, newParentId, siblings.length)

    if (newParentId) expand(newParentId)
  }

  const searchText = search.trim().toLowerCase()
  const visibleTree = searchText ? filterTree(tree, searchText) : tree
  const visibleCollapsed = searchText ? [] : collapsed
  const draggedCategory = categories.find((c) => c.id === draggedId)

  return (
    <DndContext
      sensors={sensors}
      onDragStart={(event) => setDraggedId(String(event.active.id))}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setDraggedId(null)}
    >
      <div className="relative mb-3">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by name or slug"
          className="pl-9"
        />
      </div>

      <div className="flex items-center justify-between border-b px-2 pb-2 text-xs font-medium text-muted-foreground">
        <span>Name</span>
        <span className="pr-10">Products</span>
      </div>

      {visibleTree.length > 0 ? (
        <ul className="mt-1 flex flex-col gap-0.5">
          {visibleTree.map((node) => (
            <CategoryTreeRow
              key={node.id}
              node={node}
              depth={1}
              collapsed={visibleCollapsed}
              selectedId={selectedId}
              draggedId={draggedId}
              onToggle={toggle}
              onSelect={onSelect}
              onAddChild={(parentId) => {
                expand(parentId)
                onAddChild(parentId)
              }}
            />
          ))}
        </ul>
      ) : (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {searchText
            ? `No categories match "${search}"`
            : "No categories yet. Create your first one!"}
        </p>
      )}

      <TopLevelDropZone visible={draggedId !== null} />

      <DragOverlay dropAnimation={null}>
        {draggedCategory && (
          <div className="rounded-md border bg-background px-3 py-2 text-sm font-medium shadow-lg">
            {draggedCategory.name}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}

// Drop a category here to make it top-level. Only visible while dragging.
function TopLevelDropZone({ visible }: { visible: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: TOP_LEVEL_ID })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex items-center justify-center gap-2 rounded-md border border-dashed text-sm text-muted-foreground transition-all",
        visible ? "mt-3 h-12 opacity-100" : "h-0 overflow-hidden border-0 opacity-0",
        isOver && "border-primary bg-primary/10 text-primary"
      )}
    >
      <CornerLeftUpIcon className="size-4" />
      Drop here to make it a top-level category
    </div>
  )
}
