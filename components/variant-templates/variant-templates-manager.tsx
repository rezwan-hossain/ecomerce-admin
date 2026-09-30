"use client"

import { useState } from "react"
import {
  EllipsisVerticalIcon,
  LayoutTemplateIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react"
import { toast } from "sonner"

import {
  createVariantTemplate,
  deleteVariantTemplate,
  getVariantTemplates,
  updateVariantTemplate,
} from "@/app/actions/variant-template.actions"
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
import type { CreateVariantTemplateDto, VariantTemplate } from "@/types/variant-template.type"

import { TemplateFormSheet } from "./template-form-sheet"

// How many variants a template makes: 3 sizes × 2 colors = 6.
function variantCount(template: VariantTemplate) {
  return template.options.reduce((total, option) => total * option.values.length, 1)
}

export function VariantTemplatesManager({
  initialTemplates,
  options,
}: {
  initialTemplates: VariantTemplate[]
  options: Option[]
}) {
  const [templates, setTemplates] = useState(initialTemplates)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<VariantTemplate | null>(null)
  const [deleting, setDeleting] = useState<VariantTemplate | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  // Changes on every open, so the form inside the panel starts fresh.
  const [formKey, setFormKey] = useState(0)

  const usedOptionIds = new Set(templates.flatMap((t) => t.options.map((o) => o.optionId)))
  const largest = Math.max(0, ...templates.map(variantCount))

  async function refresh() {
    const res = await getVariantTemplates()
    if (res.success) setTemplates(res.data)
  }

  function openCreate() {
    setEditing(null)
    setFormKey(formKey + 1)
    setSheetOpen(true)
  }

  function openEdit(template: VariantTemplate) {
    setEditing(template)
    setFormKey(formKey + 1)
    setSheetOpen(true)
  }

  async function handleSave(values: CreateVariantTemplateDto) {
    const res = editing
      ? await updateVariantTemplate(editing.id, values)
      : await createVariantTemplate(values)

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
    const template = deleting!
    setIsDeleting(true)
    const res = await deleteVariantTemplate(template.id)
    setIsDeleting(false)

    if (!res.success) {
      toast.error(res.error)
      return
    }

    toast.success(`${template.name} deleted`)
    setDeleting(null)
    await refresh()
  }

  const columns: ListColumn<VariantTemplate>[] = [
    {
      key: "template",
      header: "Template",
      cell: (template) => (
        <button
          type="button"
          onClick={() => openEdit(template)}
          className="group flex items-center gap-3 text-left"
        >
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
            <LayoutTemplateIcon className="size-4" />
          </div>
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-medium group-hover:underline">{template.name}</span>
            {template.description && (
              <span className="max-w-64 truncate text-xs text-muted-foreground">
                {template.description}
              </span>
            )}
          </div>
        </button>
      ),
    },
    {
      key: "options",
      header: "Options",
      cell: (template) => (
        <div className="flex flex-col gap-1">
          {template.options.map((option) => (
            <div key={option.id} className="flex flex-wrap items-center gap-1 text-xs">
              <span className="mr-1 font-medium">{option.option.name}</span>
              {option.values.map((value) => (
                <span key={value.id} className="rounded-md bg-muted px-1.5 py-0.5">
                  {value.optionValue.value}
                </span>
              ))}
            </div>
          ))}
        </div>
      ),
    },
    {
      key: "variants",
      header: "Variants",
      cell: (template) => {
        const count = variantCount(template)
        return (
          <span className="tabular-nums">
            {count} {count === 1 ? "variant" : "variants"}
          </span>
        )
      },
    },
    {
      key: "updated",
      header: "Last updated",
      className: "hidden lg:table-cell",
      cell: (template) => (
        <span className="text-muted-foreground">{formatDate(template.updatedAt)}</span>
      ),
    },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      className: "w-12 text-right",
      cell: (template) => (
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
            <span className="sr-only">Actions for {template.name}</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={() => openEdit(template)}>
              <PencilIcon />
              Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => setDeleting(template)}>
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
        title="Variant templates"
        description="Reusable sets of options, like T-Shirt or Shoe Sizes, for creating product variants."
      >
        <Button onClick={openCreate}>
          <PlusIcon data-icon="inline-start" />
          Add template
        </Button>
      </PageHeader>

      <StatCards
        stats={[
          { label: "Total templates", value: String(templates.length), hint: "Ready to use on products" },
          {
            label: "Options used",
            value: String(usedOptionIds.size),
            hint: `Out of ${options.length} options`,
          },
          { label: "Largest template", value: String(largest), hint: "Variants from one template" },
          { label: "Available options", value: String(options.length), hint: "From the Options page" },
        ]}
      />

      <ListTable
        rows={[...templates].sort((a, b) => a.name.localeCompare(b.name))}
        columns={columns}
        getRowId={(template) => template.id}
        searchText={(template) =>
          `${template.name} ${template.description ?? ""} ${template.options.map((o) => o.option.name).join(" ")}`
        }
        searchPlaceholder="Search templates or options..."
        emptyText={
          templates.length === 0
            ? "No templates yet. Add your first one."
            : "No templates match your search."
        }
      />

      <TemplateFormSheet
        key={formKey}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        template={editing}
        options={options}
        onSave={handleSave}
      />

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Existing products and their variants aren&apos;t changed. This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? "Deleting..." : "Delete template"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
