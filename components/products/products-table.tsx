"use client"

import * as React from "react"
import Link from "next/link"
import { EllipsisVerticalIcon, PlusIcon } from "lucide-react"
import { toast } from "sonner"

import { ListTable, type ListColumn } from "@/components/list-table"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { currency, type Product } from "@/lib/demo-data"

const LOW_STOCK = 10

function StockLevel({ stock }: { stock: number }) {
  if (stock === 0) {
    return <span className="text-destructive">Out of stock</span>
  }
  if (stock < LOW_STOCK) {
    return (
      <span className="text-amber-600 dark:text-amber-400">
        {stock} left · Low
      </span>
    )
  }
  return <span>{stock} in stock</span>
}

export function ProductsTable({ products: initial }: { products: Product[] }) {
  const [products, setProducts] = React.useState(initial)

  function remove(product: Product) {
    setProducts((current) => current.filter((p) => p.id !== product.id))
    toast.success(`${product.name} deleted`)
  }

  function duplicate(product: Product) {
    setProducts((current) => [
      {
        ...product,
        id: `${product.id}-copy-${current.length}`,
        name: `${product.name} (Copy)`,
        status: "Draft",
      },
      ...current,
    ])
    toast.success(`${product.name} duplicated as a draft`)
  }

  const columns: ListColumn<Product>[] = [
    {
      key: "name",
      header: "Product",
      cell: (p) => (
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-sm font-semibold text-muted-foreground">
            {p.name.charAt(0)}
          </div>
          <div className="flex flex-col">
            <Link
              href={`/dashboard/products/${p.id}/edit`}
              className="font-medium hover:underline"
            >
              {p.name}
            </Link>
            <span className="text-xs text-muted-foreground">{p.sku}</span>
          </div>
        </div>
      ),
    },
    { key: "status", header: "Status", cell: (p) => <StatusBadge status={p.status} /> },
    { key: "category", header: "Category", cell: (p) => p.category },
    { key: "brand", header: "Brand", cell: (p) => p.brand },
    { key: "stock", header: "Inventory", cell: (p) => <StockLevel stock={p.stock} /> },
    {
      key: "price",
      header: "Price",
      className: "text-right tabular-nums",
      cell: (p) => (
        <div className="flex flex-col items-end">
          <span>{currency.format(p.price)}</span>
          {p.compareAtPrice && (
            <span className="text-xs text-muted-foreground line-through">
              {currency.format(p.compareAtPrice)}
            </span>
          )}
        </div>
      ),
    },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      className: "w-12 text-right",
      cell: (p) => (
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
            <span className="sr-only">Open menu</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-36">
            <DropdownMenuItem
              render={<Link href={`/dashboard/products/${p.id}/edit`} />}
            >
              Edit product
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => duplicate(p)}>
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => remove(p)}>
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  return (
    <ListTable
      rows={products}
      columns={columns}
      getRowId={(p) => p.id}
      searchText={(p) => `${p.name} ${p.sku} ${p.category} ${p.brand}`}
      searchPlaceholder="Search products..."
      filters={[
        { label: "All", value: "all", match: () => true },
        { label: "Active", value: "active", match: (p) => p.status === "Active" },
        { label: "Draft", value: "draft", match: (p) => p.status === "Draft" },
        { label: "Archived", value: "archived", match: (p) => p.status === "Archived" },
        { label: "Low Stock", value: "low-stock", match: (p) => p.stock < LOW_STOCK },
      ]}
      toolbar={
        <Button
          size="sm"
          nativeButton={false}
          render={<Link href="/dashboard/products/new" />}
        >
          <PlusIcon data-icon="inline-start" />
          Add Product
        </Button>
      }
    />
  )
}
