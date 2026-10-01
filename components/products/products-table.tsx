"use client"

import { useState } from "react"
import Link from "next/link"
import { EllipsisVerticalIcon, PackageIcon, PlusIcon } from "lucide-react"
import { toast } from "sonner"

import { changeProductStatus, deleteProduct, getProducts } from "@/app/actions/product.actions"
import { ListTable, type ListColumn } from "@/components/list-table"
import { StatCards } from "@/components/stat-cards"
import { StatusBadge } from "@/components/status-badge"
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
import type { Product } from "@/types/product.type"

const LOW_STOCK = 10

const STATUS_LABEL = { ACTIVE: "Active", DRAFT: "Draft", ARCHIVED: "Archived" } as const

const taka = (n: number) => `৳${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`

const totalStock = (p: Product) => p.variants.reduce((sum, v) => sum + v.stock, 0)

function priceRange(p: Product) {
  const prices = p.variants.map((v) => Number(v.price))
  const low = Math.min(...prices)
  const high = Math.max(...prices)
  return low === high ? taka(low) : `${taka(low)} – ${taka(high)}`
}

function StockLevel({ stock }: { stock: number }) {
  if (stock === 0) {
    return <span className="text-destructive">Out of stock</span>
  }
  if (stock < LOW_STOCK) {
    return <span className="text-amber-600 dark:text-amber-400">{stock} left · Low</span>
  }
  return <span>{stock} in stock</span>
}

export function ProductsTable({ initialProducts }: { initialProducts: Product[] }) {
  const [products, setProducts] = useState(initialProducts)
  const [deleting, setDeleting] = useState<Product | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const inventoryValue = products.reduce(
    (sum, p) => sum + p.variants.reduce((s, v) => s + Number(v.price) * v.stock, 0),
    0
  )

  async function refresh() {
    const res = await getProducts()
    if (res.success) setProducts(res.data)
  }

  async function changeStatus(product: Product, action: "publish" | "archive" | "unarchive") {
    const res = await changeProductStatus(product.id, action)
    if (!res.success) {
      toast.error(res.error)
      return
    }
    toast.success(`${product.name} is now ${STATUS_LABEL[res.data.status].toLowerCase()}`)
    await refresh()
  }

  async function handleDelete() {
    const product = deleting!
    setIsDeleting(true)
    const res = await deleteProduct(product.id)
    setIsDeleting(false)

    if (!res.success) {
      toast.error(res.error)
      return
    }

    toast.success(`${product.name} deleted`)
    setDeleting(null)
    await refresh()
  }

  const columns: ListColumn<Product>[] = [
    {
      key: "name",
      header: "Product",
      cell: (p) => {
        const image = p.images.find((i) => i.isPrimary) ?? p.images[0]
        return (
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted text-muted-foreground">
              {image ? (
                // eslint-disable-next-line @next/next/no-img-element -- any image host is allowed
                <img src={image.url} alt={image.altText ?? ""} className="size-full object-cover" />
              ) : (
                <PackageIcon className="size-4" />
              )}
            </div>
            <div className="flex min-w-0 flex-col">
              <Link href={`/products/${p.id}/edit`} className="truncate font-medium hover:underline">
                {p.name}
              </Link>
              <span className="truncate text-xs text-muted-foreground">
                {p.variants.length === 1 ? p.variants[0].sku : `${p.variants.length} variants`}
              </span>
            </div>
          </div>
        )
      },
    },
    { key: "status", header: "Status", cell: (p) => <StatusBadge status={STATUS_LABEL[p.status]} /> },
    {
      key: "category",
      header: "Category",
      className: "hidden md:table-cell",
      cell: (p) => {
        const primary = p.categories.find((c) => c.isPrimary) ?? p.categories[0]
        if (!primary) return <span className="text-muted-foreground">None</span>
        return (
          <span>
            {primary.category.name}
            {p.categories.length > 1 && <span className="text-muted-foreground"> +{p.categories.length - 1}</span>}
          </span>
        )
      },
    },
    {
      key: "brand",
      header: "Brand",
      className: "hidden lg:table-cell",
      cell: (p) => p.brand?.name ?? <span className="text-muted-foreground">No brand</span>,
    },
    { key: "stock", header: "Inventory", cell: (p) => <StockLevel stock={totalStock(p)} /> },
    {
      key: "price",
      header: "Price",
      className: "text-right tabular-nums",
      cell: (p) => priceRange(p),
    },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      className: "w-12 text-right",
      cell: (p) => (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="ghost" size="icon" className="size-8 text-muted-foreground data-open:bg-muted" />}
          >
            <EllipsisVerticalIcon />
            <span className="sr-only">Actions for {p.name}</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-36">
            <DropdownMenuItem render={<Link href={`/products/${p.id}/edit`} />}>Edit</DropdownMenuItem>
            {p.status !== "ACTIVE" && p.status !== "ARCHIVED" && (
              <DropdownMenuItem onClick={() => changeStatus(p, "publish")}>Publish</DropdownMenuItem>
            )}
            {p.status !== "ARCHIVED" && (
              <DropdownMenuItem onClick={() => changeStatus(p, "archive")}>Archive</DropdownMenuItem>
            )}
            {p.status === "ARCHIVED" && (
              <DropdownMenuItem onClick={() => changeStatus(p, "unarchive")}>Unarchive</DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => setDeleting(p)}>
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  return (
    <>
      <StatCards
        stats={[
          { label: "Total products", value: String(products.length), hint: "In your catalog" },
          {
            label: "Active",
            value: String(products.filter((p) => p.status === "ACTIVE").length),
            hint: "Visible in the store",
          },
          {
            label: "Low / out of stock",
            value: String(products.filter((p) => totalStock(p) < LOW_STOCK).length),
            hint: "Need restocking",
          },
          { label: "Inventory value", value: taka(inventoryValue), hint: "Stock at retail price" },
        ]}
      />

      <ListTable
        rows={products}
        columns={columns}
        getRowId={(p) => p.id}
        searchText={(p) =>
          `${p.name} ${p.variants.map((v) => v.sku).join(" ")} ${p.brand?.name ?? ""} ${p.categories.map((c) => c.category.name).join(" ")}`
        }
        searchPlaceholder="Search products..."
        filters={[
          { label: "All", value: "all", match: () => true },
          { label: "Active", value: "active", match: (p) => p.status === "ACTIVE" },
          { label: "Draft", value: "draft", match: (p) => p.status === "DRAFT" },
          { label: "Archived", value: "archived", match: (p) => p.status === "ARCHIVED" },
          { label: "Low stock", value: "low-stock", match: (p) => totalStock(p) < LOW_STOCK },
        ]}
        emptyText={products.length === 0 ? "No products yet. Add your first one." : "No products match your search."}
        toolbar={
          <Button size="sm" nativeButton={false} render={<Link href="/products/new" />}>
            <PlusIcon data-icon="inline-start" />
            Add product
          </Button>
        }
      />

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              It’s removed from the store and this list. Past orders keep their copy of the product.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? "Deleting..." : "Delete product"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
