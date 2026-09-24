"use client"

import * as React from "react"
import { PencilIcon, Trash2Icon, XIcon } from "lucide-react"
import { toast } from "sonner"

import { ListTable, type ListColumn } from "@/components/list-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  products,
  type Attribute,
  type Brand,
  type Category,
} from "@/lib/demo-data"

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
}

// Shared layout: an add/edit form on the left, the list on the right.
function ManagerLayout({
  title,
  description,
  editing,
  onSubmit,
  onCancel,
  fields,
  children,
}: {
  title: string
  description: string
  editing: boolean
  onSubmit: () => void
  onCancel: () => void
  fields: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-3 lg:px-6">
      <div className="px-4 lg:px-0">
        <Card>
          <CardHeader>
            <CardTitle>{editing ? `Edit ${title}` : `Add ${title}`}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault()
                onSubmit()
              }}
            >
              {fields}
              <div className="flex gap-2">
                <Button type="submit">{editing ? "Save" : `Add ${title}`}</Button>
                {editing && (
                  <Button type="button" variant="outline" onClick={onCancel}>
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
      <div className="lg:col-span-2">{children}</div>
    </div>
  )
}

function RowActions({
  onEdit,
  onDelete,
}: {
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="flex justify-end gap-1">
      <Button variant="ghost" size="icon" className="size-8" onClick={onEdit}>
        <PencilIcon />
        <span className="sr-only">Edit</span>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-8 text-destructive"
        onClick={onDelete}
      >
        <Trash2Icon />
        <span className="sr-only">Delete</span>
      </Button>
    </div>
  )
}

function productCount(match: (p: (typeof products)[number]) => boolean) {
  return products.filter(match).length
}

export function CategoriesManager({ initial }: { initial: Category[] }) {
  const [items, setItems] = React.useState(initial)
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [name, setName] = React.useState("")
  const [slug, setSlug] = React.useState("")
  const [description, setDescription] = React.useState("")

  function reset() {
    setEditingId(null)
    setName("")
    setSlug("")
    setDescription("")
  }

  function submit() {
    if (!name.trim()) return toast.error("Category name is required")
    const item = {
      id: editingId ?? slugify(name),
      name: name.trim(),
      slug: slug || slugify(name),
      description,
    }
    setItems((current) =>
      editingId
        ? current.map((c) => (c.id === editingId ? item : c))
        : [...current, item]
    )
    toast.success(editingId ? "Category updated" : "Category added")
    reset()
  }

  const columns: ListColumn<Category>[] = [
    {
      key: "name",
      header: "Name",
      cell: (c) => (
        <div className="flex flex-col">
          <span className="font-medium">{c.name}</span>
          <span className="text-xs text-muted-foreground">/{c.slug}</span>
        </div>
      ),
    },
    {
      key: "description",
      header: "Description",
      cell: (c) => <span className="text-muted-foreground">{c.description}</span>,
    },
    {
      key: "products",
      header: "Products",
      className: "text-right tabular-nums",
      cell: (c) => productCount((p) => p.category === c.name),
    },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      className: "w-24",
      cell: (c) => (
        <RowActions
          onEdit={() => {
            setEditingId(c.id)
            setName(c.name)
            setSlug(c.slug)
            setDescription(c.description)
          }}
          onDelete={() => {
            setItems((current) => current.filter((i) => i.id !== c.id))
            toast.success(`${c.name} deleted`)
          }}
        />
      ),
    },
  ]

  return (
    <ManagerLayout
      title="Category"
      description="Group products so shoppers can browse them."
      editing={Boolean(editingId)}
      onSubmit={submit}
      onCancel={reset}
      fields={
        <>
          <div className="flex flex-col gap-2">
            <Label htmlFor="category-name">Name</Label>
            <Input
              id="category-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Outdoor"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="category-slug">Slug</Label>
            <Input
              id="category-slug"
              value={slug}
              onChange={(e) => setSlug(slugify(e.target.value))}
              placeholder={slugify(name) || "auto-generated"}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="category-description">Description</Label>
            <Textarea
              id="category-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </>
      }
    >
      <ListTable
        rows={items}
        columns={columns}
        getRowId={(c) => c.id}
        searchText={(c) => `${c.name} ${c.slug}`}
        searchPlaceholder="Search categories..."
        className="px-4 lg:px-0"
      />
    </ManagerLayout>
  )
}

export function BrandsManager({ initial }: { initial: Brand[] }) {
  const [items, setItems] = React.useState(initial)
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [name, setName] = React.useState("")
  const [website, setWebsite] = React.useState("")

  function reset() {
    setEditingId(null)
    setName("")
    setWebsite("")
  }

  function submit() {
    if (!name.trim()) return toast.error("Brand name is required")
    const item = { id: editingId ?? slugify(name), name: name.trim(), website }
    setItems((current) =>
      editingId
        ? current.map((b) => (b.id === editingId ? item : b))
        : [...current, item]
    )
    toast.success(editingId ? "Brand updated" : "Brand added")
    reset()
  }

  const columns: ListColumn<Brand>[] = [
    {
      key: "name",
      header: "Brand",
      cell: (b) => (
        <div className="flex items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
            {b.name.slice(0, 2).toUpperCase()}
          </div>
          <span className="font-medium">{b.name}</span>
        </div>
      ),
    },
    {
      key: "website",
      header: "Website",
      cell: (b) => <span className="text-muted-foreground">{b.website || "—"}</span>,
    },
    {
      key: "products",
      header: "Products",
      className: "text-right tabular-nums",
      cell: (b) => productCount((p) => p.brand === b.name),
    },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      className: "w-24",
      cell: (b) => (
        <RowActions
          onEdit={() => {
            setEditingId(b.id)
            setName(b.name)
            setWebsite(b.website)
          }}
          onDelete={() => {
            setItems((current) => current.filter((i) => i.id !== b.id))
            toast.success(`${b.name} deleted`)
          }}
        />
      ),
    },
  ]

  return (
    <ManagerLayout
      title="Brand"
      description="Manufacturers or labels your products belong to."
      editing={Boolean(editingId)}
      onSubmit={submit}
      onCancel={reset}
      fields={
        <>
          <div className="flex flex-col gap-2">
            <Label htmlFor="brand-name">Name</Label>
            <Input
              id="brand-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Northfold"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="brand-website">Website</Label>
            <Input
              id="brand-website"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="brand.example.com"
            />
          </div>
        </>
      }
    >
      <ListTable
        rows={items}
        columns={columns}
        getRowId={(b) => b.id}
        searchText={(b) => b.name}
        searchPlaceholder="Search brands..."
        className="px-4 lg:px-0"
      />
    </ManagerLayout>
  )
}

export function AttributesManager({ initial }: { initial: Attribute[] }) {
  const [items, setItems] = React.useState(initial)
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [name, setName] = React.useState("")
  const [values, setValues] = React.useState<string[]>([])
  const [valueInput, setValueInput] = React.useState("")

  function reset() {
    setEditingId(null)
    setName("")
    setValues([])
    setValueInput("")
  }

  function addValue() {
    const value = valueInput.trim()
    if (value && !values.includes(value)) setValues([...values, value])
    setValueInput("")
  }

  function submit() {
    if (!name.trim()) return toast.error("Attribute name is required")
    if (!values.length) return toast.error("Add at least one value")
    const item = { id: editingId ?? slugify(name), name: name.trim(), values }
    setItems((current) =>
      editingId
        ? current.map((a) => (a.id === editingId ? item : a))
        : [...current, item]
    )
    toast.success(editingId ? "Attribute updated" : "Attribute added")
    reset()
  }

  const columns: ListColumn<Attribute>[] = [
    {
      key: "name",
      header: "Attribute",
      cell: (a) => <span className="font-medium">{a.name}</span>,
    },
    {
      key: "values",
      header: "Values",
      cell: (a) => (
        <div className="flex flex-wrap gap-1">
          {a.values.map((v) => (
            <Badge key={v} variant="outline">
              {v}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      className: "w-24",
      cell: (a) => (
        <RowActions
          onEdit={() => {
            setEditingId(a.id)
            setName(a.name)
            setValues(a.values)
          }}
          onDelete={() => {
            setItems((current) => current.filter((i) => i.id !== a.id))
            toast.success(`${a.name} deleted`)
          }}
        />
      ),
    },
  ]

  return (
    <ManagerLayout
      title="Attribute"
      description="Options like size or color used to create product variants."
      editing={Boolean(editingId)}
      onSubmit={submit}
      onCancel={reset}
      fields={
        <>
          <div className="flex flex-col gap-2">
            <Label htmlFor="attribute-name">Name</Label>
            <Input
              id="attribute-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Size"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="attribute-values">Values</Label>
            <Input
              id="attribute-values"
              value={valueInput}
              onChange={(e) => setValueInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault()
                  addValue()
                }
              }}
              onBlur={addValue}
              placeholder="Type a value and press Enter"
            />
            {values.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {values.map((v) => (
                  <Badge key={v} variant="secondary" className="gap-1 pr-1">
                    {v}
                    <button
                      type="button"
                      onClick={() => setValues(values.filter((x) => x !== v))}
                    >
                      <XIcon className="size-3" />
                      <span className="sr-only">Remove {v}</span>
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </>
      }
    >
      <ListTable
        rows={items}
        columns={columns}
        getRowId={(a) => a.id}
        searchText={(a) => `${a.name} ${a.values.join(" ")}`}
        searchPlaceholder="Search attributes..."
        className="px-4 lg:px-0"
      />
    </ManagerLayout>
  )
}
