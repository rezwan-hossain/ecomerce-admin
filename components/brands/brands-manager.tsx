"use client"

import * as React from "react"
import {
  ArrowDownAZIcon,
  CopyIcon,
  EllipsisVerticalIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react"
import { toast } from "sonner"

import { BrandFormSheet } from "@/components/brands/brand-form-sheet"
import { BrandLogo } from "@/components/brands/brand-logo"
import { DeleteBrandDialog } from "@/components/brands/delete-brand-dialog"
import { ListTable, type ListColumn } from "@/components/list-table"
import { PageHeader } from "@/components/page-header"
import { StatCards } from "@/components/stat-cards"
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
import { formatDate, type Brand } from "@/lib/demo-data"
import { uuidv7 } from "@/lib/uuid"
import type { BrandValues } from "@/lib/validations/brand"

const sorts = {
  name: {
    label: "Name A–Z",
    compare: (a: Brand, b: Brand) => a.name.localeCompare(b.name),
  },
  products: {
    label: "Most products",
    compare: (a: Brand, b: Brand) =>
      b._count.products - a._count.products || a.name.localeCompare(b.name),
  },
  newest: {
    label: "Newest",
    compare: (a: Brand, b: Brand) => b.createdAt.localeCompare(a.createdAt),
  },
  updated: {
    label: "Recently updated",
    compare: (a: Brand, b: Brand) => b.updatedAt.localeCompare(a.updatedAt),
  },
} as const

type SortKey = keyof typeof sorts

export function BrandsManager({ initial }: { initial: Brand[] }) {
  const [brands, setBrands] = React.useState(initial)
  const [sort, setSort] = React.useState<SortKey>("name")
  const [sheetOpen, setSheetOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Brand | null>(null)
  const [deleting, setDeleting] = React.useState<Brand | null>(null)

  const sorted = React.useMemo(
    () => [...brands].sort(sorts[sort].compare),
    [brands, sort]
  )

  const branded = brands.reduce((sum, b) => sum + b._count.products, 0)
  const withoutProducts = brands.filter((b) => b._count.products === 0).length
  const withoutLogo = brands.filter((b) => !b.logoUrl).length

  function openCreate() {
    setEditing(null)
    setSheetOpen(true)
  }

  function openEdit(brand: Brand) {
    setEditing(brand)
    setSheetOpen(true)
  }

  function save(values: BrandValues) {
    const now = new Date().toISOString()
    if (editing) {
      setBrands((current) =>
        current.map((b) =>
          b.id === editing.id ? { ...b, ...values, updatedAt: now } : b
        )
      )
      toast.success(`${values.name} updated`)
    } else {
      setBrands((current) => [
        ...current,
        {
          id: uuidv7(),
          ...values,
          createdAt: now,
          updatedAt: now,
          _count: { products: 0 },
        },
      ])
      toast.success(`${values.name} added`)
    }
    setSheetOpen(false)
  }

  function remove(brand: Brand) {
    setBrands((current) => current.filter((b) => b.id !== brand.id))
    setDeleting(null)
    toast.success(`${brand.name} deleted`)
  }

  async function copySlug(brand: Brand) {
    try {
      await navigator.clipboard.writeText(brand.slug)
      toast.success("Slug copied")
    } catch {
      toast.error("Couldn't copy to clipboard")
    }
  }

  const columns: ListColumn<Brand>[] = [
    {
      key: "brand",
      header: "Brand",
      cell: (b) => (
        <button
          type="button"
          onClick={() => openEdit(b)}
          className="group flex items-center gap-3 text-left"
        >
          <BrandLogo name={b.name} logoUrl={b.logoUrl} />
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-medium group-hover:underline">
              {b.name}
            </span>
            <span className="truncate font-mono text-xs text-muted-foreground">
              {b.slug}
            </span>
          </div>
        </button>
      ),
    },
    {
      key: "products",
      header: "Products",
      cell: (b) =>
        b._count.products > 0 ? (
          <span className="tabular-nums">
            {b._count.products} product{b._count.products === 1 ? "" : "s"}
          </span>
        ) : (
          <span className="text-muted-foreground">No products</span>
        ),
    },
    {
      key: "created",
      header: "Created",
      className: "hidden md:table-cell",
      cell: (b) => (
        <span className="text-muted-foreground">{formatDate(b.createdAt)}</span>
      ),
    },
    {
      key: "updated",
      header: "Last updated",
      className: "hidden lg:table-cell",
      cell: (b) => (
        <span className="text-muted-foreground">{formatDate(b.updatedAt)}</span>
      ),
    },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      className: "w-12 text-right",
      cell: (b) => (
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
            <span className="sr-only">Actions for {b.name}</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={() => openEdit(b)}>
              <PencilIcon />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => copySlug(b)}>
              <CopyIcon />
              Copy slug
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => setDeleting(b)}>
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
      <PageHeader
        title="Brands"
        description="Manufacturers and labels your products are sold under."
      >
        <Button onClick={openCreate}>
          <PlusIcon data-icon="inline-start" />
          Add brand
        </Button>
      </PageHeader>

      <StatCards
        stats={[
          { label: "Total brands", value: String(brands.length), hint: "In your catalog" },
          { label: "Branded products", value: String(branded), hint: "Products linked to a brand" },
          { label: "Without products", value: String(withoutProducts), hint: "Brands not used yet" },
          { label: "Missing logo", value: String(withoutLogo), hint: "Showing initials instead" },
        ]}
      />

      <ListTable
        rows={sorted}
        columns={columns}
        getRowId={(b) => b.id}
        searchText={(b) => `${b.name} ${b.slug}`}
        searchPlaceholder="Search brands..."
        filters={[
          { label: "All", value: "all", match: () => true },
          { label: "In use", value: "in-use", match: (b) => b._count.products > 0 },
          { label: "Unused", value: "unused", match: (b) => b._count.products === 0 },
          { label: "Missing logo", value: "no-logo", match: (b) => !b.logoUrl },
        ]}
        emptyText="No brands match your search."
        toolbar={
          <Select
            value={sort}
            onValueChange={(value) => value && setSort(value as SortKey)}
            items={Object.entries(sorts).map(([value, s]) => ({
              value,
              label: s.label,
            }))}
          >
            <SelectTrigger size="sm" className="w-44" aria-label="Sort brands">
              <ArrowDownAZIcon className="text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectGroup>
                {Object.entries(sorts).map(([value, s]) => (
                  <SelectItem key={value} value={value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        }
      />

      <BrandFormSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        brand={editing}
        brands={brands}
        onSubmit={save}
      />
      <DeleteBrandDialog
        brand={deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        onConfirm={remove}
      />
    </>
  )
}
