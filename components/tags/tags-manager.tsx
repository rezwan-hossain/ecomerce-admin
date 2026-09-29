"use client"

import { useState } from "react"
import {
  ArrowDownAZIcon,
  CopyIcon,
  EllipsisVerticalIcon,
  PencilIcon,
  PlusIcon,
  TagIcon,
  Trash2Icon,
} from "lucide-react"
import { toast } from "sonner"

import { createTag, deleteTag, getTags, updateTag } from "@/app/actions/tag.actions"
import { ListTable, type ListColumn } from "@/components/list-table"
import { PageHeader } from "@/components/page-header"
import { StatCards } from "@/components/stat-cards"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatDate } from "@/lib/demo-data"
import type { CreateTagDto, Tag } from "@/types/tag.type"

import { TagFormSheet } from "./tag-form-sheet"

const sortOptions = [
  { value: "name", label: "Name A–Z" },
  { value: "products", label: "Most products" },
  { value: "newest", label: "Newest" },
  { value: "updated", label: "Recently updated" },
]

function sortTags(tags: Tag[], sort: string) {
  const sorted = [...tags]
  if (sort === "products") {
    sorted.sort((a, b) => b._count.products - a._count.products || a.name.localeCompare(b.name))
  } else if (sort === "newest") {
    sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  } else if (sort === "updated") {
    sorted.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  } else {
    sorted.sort((a, b) => a.name.localeCompare(b.name))
  }
  return sorted
}

function productsLabel(count: number) {
  return count === 1 ? "1 product" : `${count} products`
}

export function TagsManager({ initialTags }: { initialTags: Tag[] }) {
  const [tags, setTags] = useState(initialTags)
  const [sort, setSort] = useState("name")
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<Tag | null>(null)
  const [deleting, setDeleting] = useState<Tag | null>(null)
  // Changes on every open, so the form inside the panel starts fresh.
  const [formKey, setFormKey] = useState(0)

  const taggedProducts = tags.reduce((sum, t) => sum + t._count.products, 0)
  const inUse = tags.filter((t) => t._count.products > 0).length

  async function refresh() {
    const res = await getTags()
    if (res.success) setTags(res.data)
  }

  function openCreate() {
    setEditing(null)
    setFormKey(formKey + 1)
    setSheetOpen(true)
  }

  function openEdit(tag: Tag) {
    setEditing(tag)
    setFormKey(formKey + 1)
    setSheetOpen(true)
  }

  async function handleSave(values: CreateTagDto) {
    const res = editing ? await updateTag(editing.id, values) : await createTag(values)

    if (!res.success) {
      toast.error(res.error)
      return res
    }

    toast.success(editing ? `${values.name} updated` : `${values.name} added`)
    setSheetOpen(false)
    await refresh()
    return res
  }

  async function handleDelete() {
    const tag = deleting!
    const res = await deleteTag(tag.id)

    if (!res.success) {
      toast.error(res.error)
      return
    }

    toast.success(`${tag.name} deleted`)
    setDeleting(null)
    await refresh()
  }

  async function copySlug(tag: Tag) {
    await navigator.clipboard.writeText(tag.slug)
    toast.success("Slug copied")
  }

  const columns: ListColumn<Tag>[] = [
    {
      key: "tag",
      header: "Tag",
      cell: (tag) => (
        <button
          type="button"
          onClick={() => openEdit(tag)}
          className="group flex items-center gap-3 text-left"
        >
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
            <TagIcon className="size-4" />
          </div>
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-medium group-hover:underline">{tag.name}</span>
            <span className="truncate font-mono text-xs text-muted-foreground">{tag.slug}</span>
          </div>
        </button>
      ),
    },
    {
      key: "products",
      header: "Products",
      cell: (tag) =>
        tag._count.products > 0 ? (
          <span className="tabular-nums">{productsLabel(tag._count.products)}</span>
        ) : (
          <span className="text-muted-foreground">No products</span>
        ),
    },
    {
      key: "created",
      header: "Created",
      className: "hidden md:table-cell",
      cell: (tag) => <span className="text-muted-foreground">{formatDate(tag.createdAt)}</span>,
    },
    {
      key: "updated",
      header: "Last updated",
      className: "hidden lg:table-cell",
      cell: (tag) => <span className="text-muted-foreground">{formatDate(tag.updatedAt)}</span>,
    },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      className: "w-12 text-right",
      cell: (tag) => (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground data-open:bg-muted"
              />
            }
          >
            <EllipsisVerticalIcon />
            <span className="sr-only">Actions for {tag.name}</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={() => openEdit(tag)}>
              <PencilIcon />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => copySlug(tag)}>
              <CopyIcon />
              Copy slug
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => setDeleting(tag)}>
              <Trash2Icon />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  return (
    <>
      <PageHeader title="Tags" description="Labels that help shoppers filter and find products.">
        <Button onClick={openCreate}>
          <PlusIcon data-icon="inline-start" />
          Add tag
        </Button>
      </PageHeader>

      <StatCards
        stats={[
          { label: "Total tags", value: String(tags.length), hint: "In your catalog" },
          { label: "Tagged products", value: String(taggedProducts), hint: "Product–tag links" },
          { label: "In use", value: String(inUse), hint: "Tags on at least one product" },
          { label: "Unused", value: String(tags.length - inUse), hint: "Tags not used yet" },
        ]}
      />

      <ListTable
        rows={sortTags(tags, sort)}
        columns={columns}
        getRowId={(tag) => tag.id}
        searchText={(tag) => `${tag.name} ${tag.slug}`}
        searchPlaceholder="Search tags..."
        filters={[
          { label: "All", value: "all", match: () => true },
          { label: "In use", value: "in-use", match: (tag) => tag._count.products > 0 },
          { label: "Unused", value: "unused", match: (tag) => tag._count.products === 0 },
        ]}
        emptyText={tags.length === 0 ? "No tags yet. Add your first one." : "No tags match your search."}
        toolbar={
          <Select
            value={sort}
            onValueChange={(value) => setSort(value ?? "name")}
            items={sortOptions}
          >
            <SelectTrigger size="sm" className="w-44" aria-label="Sort tags">
              <ArrowDownAZIcon className="text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectGroup>
                {sortOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        }
      />

      <TagFormSheet
        key={formKey}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        tag={editing}
        onSave={handleSave}
      />

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting && deleting._count.products > 0
                ? `It will be removed from ${productsLabel(deleting._count.products)}. The products stay in your catalog. `
                : "No products use this tag. "}
              This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button variant="destructive" onClick={handleDelete}>
              Delete tag
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
