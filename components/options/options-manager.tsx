"use client"

import { useState } from "react"
import {
  EllipsisVerticalIcon,
  PencilIcon,
  PlusIcon,
  SlidersHorizontalIcon,
  Trash2Icon,
} from "lucide-react"
import { toast } from "sonner"

import { deleteOption, getOptions } from "@/app/actions/option.actions"
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
import { formatDate } from "@/lib/demo-data"
import type { Option } from "@/types/option.type"

import { OptionFormSheet } from "./option-form-sheet"

const VISIBLE_VALUES = 6

function productsLabel(count: number) {
  return count === 1 ? "1 product" : `${count} products`
}

export function OptionsManager({ initialOptions }: { initialOptions: Option[] }) {
  const [options, setOptions] = useState(initialOptions)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  // Changes on every open, so the form inside the panel starts fresh.
  const [openCount, setOpenCount] = useState(0)
  const [deleting, setDeleting] = useState<Option | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const editing = options.find((o) => o.id === editingId) ?? null
  const valueCount = options.reduce((sum, o) => sum + o.values.length, 0)
  const inUse = options.filter((o) => o._count.productOptions > 0).length

  async function refresh(openOptionId?: string) {
    const res = await getOptions()
    if (res.success) setOptions(res.data)
    if (openOptionId) setEditingId(openOptionId)
  }

  function openCreate() {
    setEditingId(null)
    setOpenCount(openCount + 1)
    setSheetOpen(true)
  }

  function openEdit(option: Option) {
    setEditingId(option.id)
    setOpenCount(openCount + 1)
    setSheetOpen(true)
  }

  async function handleDelete() {
    const option = deleting!
    setIsDeleting(true)
    const res = await deleteOption(option.id)
    setIsDeleting(false)

    if (!res.success) {
      toast.error(res.error)
      return
    }

    toast.success(`${option.name} deleted`)
    setDeleting(null)
    await refresh()
  }

  const columns: ListColumn<Option>[] = [
    {
      key: "option",
      header: "Option",
      cell: (option) => (
        <button
          type="button"
          onClick={() => openEdit(option)}
          className="group flex items-center gap-3 text-left"
        >
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
            <SlidersHorizontalIcon className="size-4" />
          </div>
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-medium group-hover:underline">{option.name}</span>
            <span className="truncate text-xs text-muted-foreground">
              {option.displayName && `Shown as ${option.displayName} · `}
              {option.values.length === 1 ? "1 value" : `${option.values.length} values`}
            </span>
          </div>
        </button>
      ),
    },
    {
      key: "values",
      header: "Values",
      cell: (option) => {
        if (option.values.length === 0) {
          return <span className="text-muted-foreground">No values yet</span>
        }
        const hidden = option.values.length - VISIBLE_VALUES
        return (
          <div className="flex max-w-md flex-wrap gap-1">
            {option.values.slice(0, VISIBLE_VALUES).map((value) => (
              <span key={value.id} className="rounded-md bg-muted px-2 py-0.5 text-xs">
                {value.value}
              </span>
            ))}
            {hidden > 0 && (
              <span className="px-1 py-0.5 text-xs text-muted-foreground">+{hidden} more</span>
            )}
          </div>
        )
      },
    },
    {
      key: "products",
      header: "Products",
      cell: (option) =>
        option._count.productOptions > 0 ? (
          <span className="tabular-nums">{productsLabel(option._count.productOptions)}</span>
        ) : (
          <span className="text-muted-foreground">No products</span>
        ),
    },
    {
      key: "updated",
      header: "Last updated",
      className: "hidden lg:table-cell",
      cell: (option) => (
        <span className="text-muted-foreground">{formatDate(option.updatedAt)}</span>
      ),
    },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      className: "w-12 text-right",
      cell: (option) => (
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
            <span className="sr-only">Actions for {option.name}</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={() => openEdit(option)}>
              <PencilIcon />
              Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => setDeleting(option)}>
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
        title="Options"
        description="Choices like color and size that make up product variants."
      >
        <Button onClick={openCreate}>
          <PlusIcon data-icon="inline-start" />
          Add option
        </Button>
      </PageHeader>

      <StatCards
        stats={[
          { label: "Total options", value: String(options.length), hint: "In your catalog" },
          { label: "Total values", value: String(valueCount), hint: "Across all options" },
          { label: "In use", value: String(inUse), hint: "Used by at least one product" },
          { label: "Unused", value: String(options.length - inUse), hint: "Not used by products yet" },
        ]}
      />

      <ListTable
        rows={[...options].sort((a, b) => a.name.localeCompare(b.name))}
        columns={columns}
        getRowId={(option) => option.id}
        searchText={(option) =>
          `${option.name} ${option.displayName ?? ""} ${option.values.map((v) => v.value).join(" ")}`
        }
        searchPlaceholder="Search options or values..."
        filters={[
          { label: "All", value: "all", match: () => true },
          { label: "In use", value: "in-use", match: (o) => o._count.productOptions > 0 },
          { label: "Unused", value: "unused", match: (o) => o._count.productOptions === 0 },
        ]}
        emptyText={
          options.length === 0 ? "No options yet. Add your first one." : "No options match your search."
        }
      />

      <OptionFormSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        option={editing}
        formKey={`${openCount}-${editingId ?? "new"}`}
        onChanged={refresh}
      />

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting && deleting._count.productOptions > 0
                ? `It's used by ${productsLabel(deleting._count.productOptions)}. Its values will be removed from their variants. `
                : "No products use this option. "}
              This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? "Deleting..." : "Delete option"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
