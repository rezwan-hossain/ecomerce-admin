"use client"

import { useState } from "react"
import { toast } from "sonner"

import { createTag } from "@/app/actions/tag.actions"

import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { slugify } from "@/lib/slug"
import { cn } from "@/lib/utils"
import type { Category } from "@/types/category.type"

import { uid } from "./product-utils"

export type Status = "ACTIVE" | "DRAFT" | "ARCHIVED"
export type BrandItem = { id: string; name: string }
export type TemplateItem = { id: string; name: string }
export type TagItem = { id: string; name: string }

const statusItems = [
  { value: "ACTIVE", label: "Active" },
  { value: "DRAFT", label: "Draft" },
  { value: "ARCHIVED", label: "Archived" },
]

const panel = "mb-5 rounded-[10px] border bg-card px-4.5 py-4"
const heading = "mb-3.5 text-[15px] font-semibold"

/* ---------- Visibility ---------- */

export function VisibilityPanel({
  status,
  isActive,
  onStatusChange,
  onIsActiveChange,
}: {
  status: Status
  isActive: boolean
  onStatusChange: (status: Status) => void
  onIsActiveChange: (isActive: boolean) => void
}) {
  let hint = "Set the status to Active to show this product on the storefront."
  if (status === "ACTIVE") {
    hint = isActive
      ? "Customers can find and buy this product."
      : "The product is active but hidden from the storefront."
  }

  return (
    <section className={panel}>
      <h2 className={heading}>Visibility</h2>
      <label htmlFor="statusSel" className="mb-1.5 block text-[13px] font-medium">
        Publish status
      </label>
      <Select value={status} onValueChange={(value) => onStatusChange(value as Status)} items={statusItems}>
        <SelectTrigger id="statusSel" className="mb-4 h-9 w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {statusItems.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <label className="flex cursor-pointer items-center gap-2 py-0.5">
        <Checkbox
          checked={status === "ACTIVE" && isActive}
          disabled={status !== "ACTIVE"}
          onCheckedChange={(checked) => onIsActiveChange(checked)}
        />
        <span className={cn(status !== "ACTIVE" && "text-muted-foreground")}>Show on public storefront</span>
      </label>
      <p className="mt-1.5 text-[12.5px] text-muted-foreground">{hint}</p>
    </section>
  )
}

/* ---------- Brand ---------- */

export function BrandPanel({
  brands,
  brandId,
  hasError,
  onBrandsChange,
  onBrandIdChange,
}: {
  brands: BrandItem[]
  brandId: string | null
  hasError: boolean
  onBrandsChange: (brands: BrandItem[]) => void
  onBrandIdChange: (id: string | null) => void
}) {
  const selectedName = brands.find((b) => b.id === brandId)?.name ?? ""
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [active, setActive] = useState(0)

  const q = query.trim().toLowerCase()
  const matches = brands.filter((b) => !q || b.name.toLowerCase().includes(q))
  const canCreate = q !== "" && !brands.some((b) => b.name.toLowerCase() === q)
  const itemCount = matches.length + (canCreate ? 1 : 0)

  function choose(index: number) {
    if (index < matches.length) {
      onBrandIdChange(matches[index].id)
    } else {
      // Only in this form for now; it isn't saved to the Brands page.
      const brand = { id: `new-${slugify(query) || uid()}`, name: query.trim() }
      onBrandsChange([...brands, brand])
      onBrandIdChange(brand.id)
      toast.success(`Brand “${brand.name}” created`)
    }
    setOpen(false)
    setQuery("")
  }

  return (
    <section id="fBrand" className={cn(panel, hasError && "border-destructive")}>
      <h2 className={heading}>
        Brand<span className="ml-0.5 text-destructive">*</span>
      </h2>
      <div className="relative">
        <Input
          role="combobox"
          aria-expanded={open}
          aria-controls="brandList"
          aria-label="Brand"
          aria-invalid={hasError}
          autoComplete="off"
          placeholder="Search brands, e.g. Nike, Adidas"
          className="h-9"
          value={open ? query : selectedName}
          onFocus={() => {
            setOpen(true)
            setQuery("")
            setActive(0)
          }}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onChange={(event) => {
            setQuery(event.target.value)
            setActive(0)
            setOpen(true)
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault()
              setActive(Math.min(active + 1, itemCount - 1))
            } else if (event.key === "ArrowUp") {
              event.preventDefault()
              setActive(Math.max(active - 1, 0))
            } else if (event.key === "Enter") {
              event.preventDefault()
              if (open && itemCount > 0) choose(active)
            } else if (event.key === "Escape") {
              setOpen(false)
            }
          }}
        />
        {open && (
          <ul
            id="brandList"
            role="listbox"
            className="absolute top-[calc(100%+4px)] right-0 left-0 z-30 max-h-62.5 overflow-auto rounded-lg border bg-popover p-1 shadow-lg"
            onMouseDown={(event) => event.preventDefault()}
          >
            {matches.map((brand, index) => (
              <li
                key={brand.id}
                role="option"
                aria-selected={brand.id === brandId}
                className={cn(
                  "flex cursor-pointer items-center justify-between rounded-md px-2.5 py-2",
                  index === active && "bg-muted"
                )}
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(index)}
              >
                <span>{brand.name}</span>
                {brand.id === brandId && <span className="font-bold text-primary">✓</span>}
              </li>
            ))}
            {canCreate && (
              <li
                role="option"
                aria-selected={false}
                className={cn(
                  "cursor-pointer rounded-b-md border-t px-2.5 py-2 font-medium text-primary",
                  active === matches.length && "bg-muted"
                )}
                onMouseEnter={() => setActive(matches.length)}
                onClick={() => choose(matches.length)}
              >
                Create brand “{query.trim()}”
              </li>
            )}
            {itemCount === 0 && <li className="px-2.5 py-2 text-muted-foreground">No brands found</li>}
          </ul>
        )}
      </div>
      <div className="mt-2.5 flex items-center justify-between text-[13px] text-muted-foreground">
        {brandId ? (
          <>
            <span>
              Selected: <b className="font-semibold text-foreground">{selectedName}</b>
            </span>
            <button type="button" className="text-[12.5px] font-medium text-primary hover:underline" onClick={() => onBrandIdChange(null)}>
              Clear
            </button>
          </>
        ) : (
          <span>No brand selected</span>
        )}
      </div>
    </section>
  )
}

/* ---------- Categories ---------- */

// Keeps a category when it matches, or when one of its children does.
function filterTree(nodes: Category[], q: string): Category[] {
  if (!q) return nodes
  return nodes.flatMap((node) => {
    if (node.name.toLowerCase().includes(q)) return [node]
    const children = filterTree(node.children ?? [], q)
    return children.length > 0 ? [{ ...node, children }] : []
  })
}

function descendantIds(node: Category): string[] {
  return (node.children ?? []).flatMap((child) => [child.id, ...descendantIds(child)])
}

export function CategoriesPanel({
  tree,
  selected,
  hasError,
  onChange,
}: {
  tree: Category[]
  selected: string[]
  hasError: boolean
  onChange: (ids: string[]) => void
}) {
  const [search, setSearch] = useState("")

  // Checking a category also checks its parents; unchecking one clears its children.
  function toggle(node: Category, ancestors: string[], checked: boolean) {
    if (checked) {
      onChange([...new Set([...selected, node.id, ...ancestors])])
    } else {
      const removed = [node.id, ...descendantIds(node)]
      onChange(selected.filter((id) => !removed.includes(id)))
    }
  }

  function renderNodes(nodes: Category[], ancestors: string[], nested: boolean) {
    return (
      <ul className={cn("m-0 list-none p-0", nested && "ml-1.75 border-l pl-3.5")}>
        {nodes.map((node) => (
          <li key={node.id}>
            <label className="flex cursor-pointer items-center gap-2 py-0.75">
              <Checkbox
                checked={selected.includes(node.id)}
                onCheckedChange={(checked) => toggle(node, ancestors, checked)}
              />
              <span className={cn(!node.isActive && "text-muted-foreground")}>{node.name}</span>
            </label>
            {node.children && node.children.length > 0 && renderNodes(node.children, [...ancestors, node.id], true)}
          </li>
        ))}
      </ul>
    )
  }

  const visible = filterTree(tree, search.trim().toLowerCase())

  return (
    <section id="fCats" className={cn(panel, hasError && "border-destructive")}>
      <div className="mb-3.5 flex items-baseline justify-between gap-3">
        <h2 className="text-[15px] font-semibold">
          Categories<span className="ml-0.5 text-destructive">*</span>
        </h2>
        {selected.length > 0 && <p className="text-[13px] text-muted-foreground">{selected.length} selected</p>}
      </div>
      <Input
        value={search}
        placeholder="Search categories"
        aria-label="Search categories"
        autoComplete="off"
        className="h-9"
        onChange={(event) => setSearch(event.target.value)}
      />
      <div className="mt-2.5 max-h-85 overflow-auto p-0.5">
        {visible.length > 0 ? (
          renderNodes(visible, [], false)
        ) : (
          <p className="text-[12.5px] text-muted-foreground">
            {tree.length === 0 ? "No categories yet." : "No categories match your search."}
          </p>
        )}
      </div>
    </section>
  )
}

/* ---------- Tags ---------- */

// Tags come from the /tags API. Typing a new name creates the tag there too.
export function TagsPanel({
  allTags,
  selectedIds,
  onAllTagsChange,
  onChange,
}: {
  allTags: TagItem[]
  selectedIds: string[]
  onAllTagsChange: (tags: TagItem[]) => void
  onChange: (ids: string[]) => void
}) {
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [isCreating, setIsCreating] = useState(false)

  const selected = selectedIds.map((id) => allTags.find((t) => t.id === id)!)
  const q = query.trim().toLowerCase()
  const matches = allTags.filter((t) => !selectedIds.includes(t.id) && t.name.toLowerCase().includes(q))
  const canCreate = q !== "" && !allTags.some((t) => t.name.toLowerCase() === q)
  const itemCount = matches.length + (canCreate ? 1 : 0)

  async function choose(index: number) {
    if (index < matches.length) {
      onChange([...selectedIds, matches[index].id])
      setQuery("")
      setActive(0)
      return
    }

    setIsCreating(true)
    const res = await createTag({ name: query.trim(), slug: slugify(query) })
    setIsCreating(false)
    if (!res.success) {
      toast.error(res.error)
      return
    }
    onAllTagsChange([...allTags, { id: res.data.id, name: res.data.name }])
    onChange([...selectedIds, res.data.id])
    toast.success(`Tag “${res.data.name}” created`)
    setQuery("")
    setActive(0)
  }

  return (
    <section className={panel}>
      <h2 className={heading}>Tags</h2>
      <div className="relative">
        <div
          className="flex min-h-11 cursor-text flex-wrap items-center gap-1.5 rounded-md border border-input p-1.5 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50"
          onClick={(event) => (event.currentTarget.querySelector("input") as HTMLInputElement).focus()}
        >
          {selected.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-1.5 rounded-full border bg-muted py-0.75 pr-0.75 pl-2.5 text-[13px] font-medium"
            >
              {tag.name}
              <button
                type="button"
                aria-label={`Remove tag ${tag.name}`}
                className="size-5.5 rounded-full text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                onClick={() => onChange(selectedIds.filter((id) => id !== tag.id))}
              >
                ✕
              </button>
            </span>
          ))}
          <input
            value={query}
            role="combobox"
            aria-expanded={open}
            aria-controls="tagList"
            aria-label="Add tag"
            placeholder={allTags.length > 0 ? "Search tags" : "Type a tag name"}
            autoComplete="off"
            disabled={isCreating}
            className="min-w-37.5 flex-1 bg-transparent p-1 outline-none"
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 120)}
            onChange={(event) => {
              setQuery(event.target.value)
              setActive(0)
              setOpen(true)
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault()
                setActive(Math.min(active + 1, itemCount - 1))
              } else if (event.key === "ArrowUp") {
                event.preventDefault()
                setActive(Math.max(active - 1, 0))
              } else if (event.key === "Enter") {
                event.preventDefault()
                if (itemCount > 0) choose(active)
              } else if (event.key === "Escape") {
                setOpen(false)
              } else if (event.key === "Backspace" && !query && selectedIds.length > 0) {
                onChange(selectedIds.slice(0, -1))
              }
            }}
          />
        </div>

        {open && (
          <ul
            id="tagList"
            role="listbox"
            className="absolute top-[calc(100%+4px)] right-0 left-0 z-30 max-h-62.5 overflow-auto rounded-lg border bg-popover p-1 shadow-lg"
            onMouseDown={(event) => event.preventDefault()}
          >
            {matches.map((tag, index) => (
              <li
                key={tag.id}
                role="option"
                aria-selected={false}
                className={cn("cursor-pointer rounded-md px-2.5 py-2", index === active && "bg-muted")}
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(index)}
              >
                {tag.name}
              </li>
            ))}
            {canCreate && (
              <li
                role="option"
                aria-selected={false}
                className={cn(
                  "cursor-pointer rounded-b-md border-t px-2.5 py-2 font-medium text-primary",
                  active === matches.length && "bg-muted"
                )}
                onMouseEnter={() => setActive(matches.length)}
                onClick={() => choose(matches.length)}
              >
                {isCreating ? "Creating…" : `Create tag “${query.trim()}”`}
              </li>
            )}
            {itemCount === 0 && (
              <li className="px-2.5 py-2 text-muted-foreground">
                {allTags.length === selectedIds.length && allTags.length > 0 ? "All tags are added" : "No tags yet. Type a name to create one."}
              </li>
            )}
          </ul>
        )}
      </div>
    </section>
  )
}

/* ---------- Variant template ---------- */

export function TemplatePanel({
  templates,
  templateId,
  onChange,
}: {
  templates: TemplateItem[]
  templateId: string
  onChange: (id: string) => void
}) {
  const items = [{ value: "none", label: "No template" }, ...templates.map((t) => ({ value: t.id, label: t.name }))]

  return (
    <section className={panel}>
      <h2 className={heading}>Variant template</h2>
      <Select value={templateId} onValueChange={(value) => value && onChange(value)} items={items}>
        <SelectTrigger aria-label="Variant template" className="h-9 w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="mt-1.5 text-[12.5px] text-muted-foreground">
        Choosing a template replaces the current options. You can undo it.
      </p>
    </section>
  )
}
