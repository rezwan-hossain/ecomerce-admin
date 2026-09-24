"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeftIcon, ImagePlusIcon, XIcon } from "lucide-react"
import { toast } from "sonner"

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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  brands,
  categories,
  type Product,
  type ProductStatus,
} from "@/lib/demo-data"

const statuses: ProductStatus[] = ["Active", "Draft", "Archived"]

function SelectField({
  id,
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  options: string[]
  placeholder: string
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Select
        value={value || null}
        onValueChange={(v) => onChange(v ?? "")}
        items={options.map((o) => ({ label: o, value: o }))}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {options.map((o) => (
              <SelectItem key={o} value={o}>
                {o}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  )
}

export function ProductForm({ product }: { product?: Product }) {
  const router = useRouter()
  const isEdit = Boolean(product)
  const [form, setForm] = React.useState({
    name: product?.name ?? "",
    description: product?.description ?? "",
    price: product?.price.toString() ?? "",
    compareAtPrice: product?.compareAtPrice?.toString() ?? "",
    sku: product?.sku ?? "",
    stock: product?.stock.toString() ?? "0",
    trackInventory: true,
    category: product?.category ?? "",
    brand: product?.brand ?? "",
    status: product?.status ?? ("Draft" as ProductStatus),
    tags: product?.tags ?? [],
  })
  const [tagInput, setTagInput] = React.useState("")
  const [images, setImages] = React.useState<string[]>([])
  const [errors, setErrors] = React.useState<Record<string, string>>({})

  const imagesRef = React.useRef(images)
  React.useEffect(() => {
    imagesRef.current = images
  }, [images])

  // Free the preview object URLs when leaving the page.
  React.useEffect(() => {
    return () => imagesRef.current.forEach((url) => URL.revokeObjectURL(url))
  }, [])

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: "" }))
  }

  function addTag() {
    const tag = tagInput.trim().toLowerCase()
    if (tag && !form.tags.includes(tag)) update("tags", [...form.tags, tag])
    setTagInput("")
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const next: Record<string, string> = {}
    if (!form.name.trim()) next.name = "Product name is required"
    if (!form.price || Number(form.price) <= 0) next.price = "Enter a price above 0"
    if (!form.category) next.category = "Choose a category"
    setErrors(next)
    if (Object.keys(next).length) {
      toast.error("Please fix the highlighted fields")
      return
    }
    toast.success(isEdit ? `${form.name} updated` : `${form.name} created`)
    router.push("/dashboard/products")
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 px-4 py-4 md:gap-6 md:py-6 lg:px-6"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            nativeButton={false}
            render={<Link href="/dashboard/products" />}
          >
            <ArrowLeftIcon />
            <span className="sr-only">Back to products</span>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {isEdit ? `Edit ${product!.name}` : "Create Product"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isEdit
                ? "Update product details, pricing and inventory."
                : "Add a new product to your store catalog."}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isEdit && (
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                toast.success(`${product!.name} deleted`)
                router.push("/dashboard/products")
              }}
            >
              Delete
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            nativeButton={false}
            render={<Link href="/dashboard/products" />}
          >
            Cancel
          </Button>
          <Button type="submit">{isEdit ? "Save changes" : "Create product"}</Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>General</CardTitle>
              <CardDescription>Name and description shown to shoppers.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="name">Product name</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                  placeholder="e.g. Wireless Headphones"
                  aria-invalid={Boolean(errors.name)}
                />
                {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  rows={5}
                  value={form.description}
                  onChange={(e) => update("description", e.target.value)}
                  placeholder="Describe the product..."
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Media</CardTitle>
              <CardDescription>Upload product images (preview only in this demo).</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
                {images.map((src, index) => (
                  <div key={src} className="group relative aspect-square overflow-hidden rounded-md border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt={`Product image ${index + 1}`} className="size-full object-cover" />
                    <button
                      type="button"
                      onClick={() => {
                        URL.revokeObjectURL(src)
                        setImages(images.filter((i) => i !== src))
                      }}
                      className="absolute top-1 right-1 rounded-full bg-background/80 p-0.5 opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      <XIcon className="size-3.5" />
                      <span className="sr-only">Remove image</span>
                    </button>
                  </div>
                ))}
                <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed text-xs text-muted-foreground hover:bg-muted/50">
                  <ImagePlusIcon className="size-5" />
                  Add image
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="sr-only"
                    onChange={(e) => {
                      const files = Array.from(e.target.files ?? [])
                      setImages([...images, ...files.map((f) => URL.createObjectURL(f))])
                      e.target.value = ""
                    }}
                  />
                </label>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pricing</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="price">Price ($)</Label>
                <Input
                  id="price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.price}
                  onChange={(e) => update("price", e.target.value)}
                  placeholder="0.00"
                  aria-invalid={Boolean(errors.price)}
                />
                {errors.price && <p className="text-sm text-destructive">{errors.price}</p>}
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="compareAtPrice">Compare-at price ($)</Label>
                <Input
                  id="compareAtPrice"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.compareAtPrice}
                  onChange={(e) => update("compareAtPrice", e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Inventory</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="sku">SKU</Label>
                  <Input
                    id="sku"
                    value={form.sku}
                    onChange={(e) => update("sku", e.target.value)}
                    placeholder="e.g. EL-WH-001"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="stock">Quantity in stock</Label>
                  <Input
                    id="stock"
                    type="number"
                    min="0"
                    value={form.stock}
                    disabled={!form.trackInventory}
                    onChange={(e) => update("stock", e.target.value)}
                  />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  id="trackInventory"
                  checked={form.trackInventory}
                  onCheckedChange={(checked) => update("trackInventory", checked)}
                />
                <Label htmlFor="trackInventory">Track inventory for this product</Label>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Status</CardTitle>
            </CardHeader>
            <CardContent>
              <SelectField
                id="status"
                label="Product status"
                value={form.status}
                onChange={(v) => update("status", v as ProductStatus)}
                options={statuses}
                placeholder="Select a status"
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Organization</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <SelectField
                  id="category"
                  label="Category"
                  value={form.category}
                  onChange={(v) => update("category", v)}
                  options={categories.map((c) => c.name)}
                  placeholder="Select a category"
                />
                {errors.category && (
                  <p className="text-sm text-destructive">{errors.category}</p>
                )}
              </div>
              <SelectField
                id="brand"
                label="Brand"
                value={form.brand}
                onChange={(v) => update("brand", v)}
                options={brands.map((b) => b.name)}
                placeholder="Select a brand"
              />
              <div className="flex flex-col gap-2">
                <Label htmlFor="tags">Tags</Label>
                <Input
                  id="tags"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === ",") {
                      e.preventDefault()
                      addTag()
                    }
                  }}
                  onBlur={addTag}
                  placeholder="Type a tag and press Enter"
                />
                {form.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {form.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="gap-1 pr-1">
                        {tag}
                        <button
                          type="button"
                          onClick={() => update("tags", form.tags.filter((t) => t !== tag))}
                        >
                          <XIcon className="size-3" />
                          <span className="sr-only">Remove {tag}</span>
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </form>
  )
}
