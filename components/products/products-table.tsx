"use client"

import { useState } from "react"
import Link from "next/link"
import {
  BanknoteIcon,
  BoxesIcon,
  EllipsisVerticalIcon,
  EyeOffIcon,
  ImageOffIcon,
  PackageIcon,
  PlusIcon,
  ShoppingBagIcon,
  StarIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { toast } from "sonner"

import { changeProductStatus, deleteProduct, getProducts } from "@/app/actions/product.actions"
import { short } from "@/components/analytics/sales-report"
import { n0, rel } from "@/components/inventory/inventory-ui"
import { HEALTH_DOT, type Health, shelfTotals } from "@/components/inventory/product-shelf"
import { ListTable, type ListColumn, type ListFilter } from "@/components/list-table"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import type { VariantStock } from "@/types/inventory.type"
import type { Product } from "@/types/product.type"

// What the page adds to each product from inventory, orders and reviews.
export type ProductInsight = {
  variants: VariantStock[]
  sold30: number
  revenue30: number
  lastSoldAt: string | null
  ratingSum: number
  ratingCount: number
  pendingReviews: number
}

const EMPTY: ProductInsight = { variants: [], sold30: 0, revenue30: 0, lastSoldAt: null, ratingSum: 0, ratingCount: 0, pendingReviews: 0 }

const STATUS_LABEL = { ACTIVE: "Active", DRAFT: "Draft", ARCHIVED: "Archived" } as const

// Whole taka; paisa only clutter a list of prices.
const taka = (n: number) => `৳${Math.round(n).toLocaleString("en-IN")}`

function Tile({ icon: Icon, label, value, hint, warn }: { icon: typeof PackageIcon; label: string; value: string; hint: string; warn?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-2xl border bg-card p-4">
      <div className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
        <span className={cn("grid size-6 place-items-center rounded-md", warn ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" : "bg-primary/10 text-primary")}>
          <Icon className="size-3.5" />
        </span>
        {label}
      </div>
      <strong className={cn("truncate text-2xl font-bold tracking-tight tabular-nums", warn && "text-amber-700 dark:text-amber-400")}>{value}</strong>
      <span className="text-[11px] leading-snug text-muted-foreground">{hint}</span>
    </div>
  )
}

function priceRange(p: Product) {
  const prices = p.variants.map((v) => Number(v.price))
  const low = Math.min(...prices)
  const high = Math.max(...prices)
  return low === high ? taka(low) : `${taka(low)} – ${taka(high)}`
}


const SORTS = [
  { value: "newest", label: "Newest first" },
  { value: "name", label: "Name A–Z" },
  { value: "best", label: "Best selling" },
  { value: "stock", label: "Lowest stock" },
  { value: "rating", label: "Highest rated" },
  { value: "price", label: "Highest price" },
]

export function ProductsTable({ initialProducts, insights }: { initialProducts: Product[]; insights: Record<string, ProductInsight> }) {
  const [products, setProducts] = useState(initialProducts)
  const [sort, setSort] = useState("newest")
  const [deleting, setDeleting] = useState<Product | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const info = (p: Product) => insights[p.id] ?? EMPTY
  const totals = (p: Product) => shelfTotals(info(p).variants)
  const rating = (p: Product) => (info(p).ratingCount ? info(p).ratingSum / info(p).ratingCount : 0)
  const maxPrice = (p: Product) => Math.max(...p.variants.map((v) => Number(v.price)))

  // What a listing still lacks before it sells well.
  const missing = (p: Product) =>
    [p.images.length === 0 && "image", !p.brand && "brand", p.categories.length === 0 && "category"].filter((x): x is string => !!x)

  const all = products.map(totals)
  const sellable = all.reduce((s, t) => s + t.available, 0)
  const costValue = all.reduce((s, t) => s + t.value, 0)
  const retailValue = products.reduce((sum, p) => sum + p.variants.reduce((s, v) => s + Number(v.price) * v.stock, 0), 0)
  const restock = products.filter((p) => totals(p).low + totals(p).out > 0)
  const soldOut = products.filter((p) => totals(p).out > 0)
  const units30 = products.reduce((s, p) => s + info(p).sold30, 0)
  const revenue30 = products.reduce((s, p) => s + info(p).revenue30, 0)
  const ratingCount = products.reduce((s, p) => s + info(p).ratingCount, 0)
  const ratingSum = products.reduce((s, p) => s + info(p).ratingSum, 0)
  const pending = products.reduce((s, p) => s + info(p).pendingReviews, 0)

  const sorted = [...products].sort((a, b) => {
    if (sort === "name") return a.name.localeCompare(b.name)
    if (sort === "best") return info(b).sold30 - info(a).sold30
    if (sort === "stock") return totals(a).available - totals(b).available
    if (sort === "rating") return rating(b) - rating(a)
    if (sort === "price") return maxPrice(b) - maxPrice(a)
    return b.createdAt.localeCompare(a.createdAt)
  })

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
            <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted text-muted-foreground">
              {image ? (
                // eslint-disable-next-line @next/next/no-img-element -- any image host is allowed
                <img src={image.url} alt={image.altText ?? ""} className="size-full object-cover" />
              ) : (
                <PackageIcon className="size-4" />
              )}
            </div>
            <div className="flex min-w-0 flex-col">
              <span className="flex min-w-0 items-center gap-1.5">
                <Link href={`/products/${p.id}`} className="truncate font-medium hover:text-primary hover:underline">
                  {p.name}
                </Link>
                {p.status === "ACTIVE" && !p.isActive && (
                  <span className="inline-flex shrink-0 items-center gap-0.5 rounded bg-muted px-1 text-[10px] font-medium text-muted-foreground" title="Published but hidden from the store">
                    <EyeOffIcon className="size-3" />
                    Hidden
                  </span>
                )}
              </span>
              <span className="truncate text-xs text-muted-foreground">
                <span className={cn(!p.brand && "text-amber-700 dark:text-amber-400")}>{p.brand?.name ?? "No brand"}</span>
                {" · "}
                <span className={cn(p.categories.length === 0 && "text-amber-700 dark:text-amber-400")}>
                  {(p.categories.find((c) => c.isPrimary) ?? p.categories[0])?.category.name ?? "Uncategorised"}
                </span>
              </span>
              <span className="flex min-w-0 items-center gap-1.5 text-[11px]">
                <span className="truncate font-mono text-muted-foreground/80">{p.variants.length === 1 ? p.variants[0].sku : `${p.variants.length} variants`}</span>
                {p.images.length === 0 && (
                  <span className="inline-flex shrink-0 items-center gap-0.5 font-medium text-amber-700 dark:text-amber-400">
                    <ImageOffIcon className="size-3" />
                    no image
                  </span>
                )}
              </span>
            </div>
          </div>
        )
      },
    },
    {
      key: "status",
      header: "Status",
      className: "hidden sm:table-cell",
      cell: (p) => (
        <span className="flex flex-col items-start gap-1">
          <StatusBadge status={STATUS_LABEL[p.status]} />
          {p.status !== "ACTIVE" && <span className="text-[11px] text-muted-foreground">{p.status === "DRAFT" ? "not on sale yet" : "off the store"}</span>}
        </span>
      ),
    },
    {
      key: "stock",
      header: "Stock",
      cell: (p) => {
        const t = totals(p)
        const variants = info(p).variants
        if (variants.length === 0) return <span className="text-muted-foreground">Not tracked</span>
        let health: Health = "ok"
        // Nothing to sell is out of stock, whatever each variant's own flag says.
        if (t.available <= 0 || t.out === variants.length) health = "out"
        else if (t.low + t.out > 0) health = "low"
        return (
          <span className="flex flex-col">
            <span className={cn("flex items-center gap-1.5 font-medium tabular-nums", health === "out" && "text-destructive")}>
              <span className={cn("size-2 rounded-full", HEALTH_DOT[health])} aria-hidden />
              {health === "out" ? "Out of stock" : `${n0(t.available)} sellable`}
            </span>
            {health !== "out" && t.low + t.out > 0 && (
              <span className="text-[11px] text-amber-700 dark:text-amber-400">
                {[t.out && `${t.out} out`, t.low && `${t.low} low`].filter(Boolean).join(" · ")}
              </span>
            )}
            {t.reserved > 0 && <span className="text-[11px] text-muted-foreground">{n0(t.reserved)} held</span>}
          </span>
        )
      },
    },
    {
      key: "sold",
      header: "Sold (30 days)",
      className: "hidden text-right md:table-cell",
      cell: (p) => {
        const i = info(p)
        if (i.sold30 === 0) {
          return (
            <span className="flex flex-col items-end text-[11px] text-muted-foreground">
              <span className="text-sm">—</span>
              {i.lastSoldAt ? `last ${rel(i.lastSoldAt)}` : "never sold"}
            </span>
          )
        }
        return (
          <span className="flex flex-col items-end tabular-nums">
            <span className="font-medium">{n0(i.sold30)} {i.sold30 === 1 ? "unit" : "units"}</span>
            <span className="text-[11px] text-muted-foreground">{taka(i.revenue30)}</span>
          </span>
        )
      },
    },
    {
      key: "rating",
      header: "Rating",
      className: "hidden lg:table-cell",
      cell: (p) => {
        const i = info(p)
        if (i.ratingCount === 0) return <span className="text-xs text-muted-foreground">No reviews{i.pendingReviews > 0 && ` · ${i.pendingReviews} pending`}</span>
        return (
          <span className="flex flex-col">
            <span className="inline-flex items-center gap-1 font-medium tabular-nums">
              <StarIcon className="size-3.5 fill-amber-500 text-amber-500" />
              {rating(p).toFixed(1)}
            </span>
            <span className="text-[11px] text-muted-foreground">
              {n0(i.ratingCount)} {i.ratingCount === 1 ? "review" : "reviews"}
              {i.pendingReviews > 0 && ` · ${i.pendingReviews} pending`}
            </span>
          </span>
        )
      },
    },
    {
      key: "price",
      header: "Price",
      className: "text-right tabular-nums",
      cell: (p) => (
        <span className="flex flex-col items-end">
          <span className="font-semibold">{priceRange(p)}</span>
          {p.variants.length > 1 && <span className="text-[11px] text-muted-foreground">across {p.variants.length} variants</span>}
        </span>
      ),
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
            <DropdownMenuItem render={<Link href={`/products/${p.id}`} />}>View details</DropdownMenuItem>
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
      <section className="grid grid-cols-2 gap-3 px-4 md:grid-cols-3 lg:px-6 xl:grid-cols-6">
        <Tile
          icon={PackageIcon}
          label="Products"
          value={n0(products.length)}
          hint={`${n0(products.filter((p) => p.status === "ACTIVE").length)} active · ${n0(products.filter((p) => p.status === "DRAFT").length)} draft · ${n0(products.filter((p) => p.status === "ARCHIVED").length)} archived`}
        />
        <Tile icon={BoxesIcon} label="Sellable units" value={n0(sellable)} hint={`worth ${short(retailValue)} at retail`} />
        <Tile
          icon={BanknoteIcon}
          label="Stock value"
          value={short(costValue)}
          hint={costValue === 0 && sellable > 0 ? "no unit cost recorded" : `at unit cost · ${taka(costValue)}`}
          warn={costValue === 0 && sellable > 0}
        />
        <Tile icon={TriangleAlertIcon} label="Needs restock" value={n0(restock.length)} hint={`${n0(soldOut.length)} with a variant out of stock`} warn={restock.length > 0} />
        <Tile icon={ShoppingBagIcon} label="Sold (30 days)" value={`${n0(units30)} units`} hint={`${short(revenue30)} revenue · ${n0(products.filter((p) => info(p).sold30 > 0).length)} products sold`} />
        <Tile
          icon={StarIcon}
          label="Rating"
          value={ratingCount ? `${(ratingSum / ratingCount).toFixed(1)} ★` : "—"}
          hint={`${n0(ratingCount)} reviews${pending ? ` · ${n0(pending)} pending` : ""}`}
        />
      </section>

      <ListTable
        rows={sorted}
        columns={columns}
        getRowId={(p) => p.id}
        searchText={(p) =>
          `${p.name} ${p.variants.map((v) => v.sku).join(" ")} ${p.brand?.name ?? ""} ${p.categories.map((c) => c.category.name).join(" ")} ${p.tags.map((t) => t.tag.name).join(" ")}`
        }
        searchPlaceholder="Search products..."
        filters={([
          { label: "All", value: "all", match: () => true },
          { label: "Active", value: "active", match: (p) => p.status === "ACTIVE" },
          { label: "Draft", value: "draft", match: (p) => p.status === "DRAFT" },
          { label: "Archived", value: "archived", match: (p) => p.status === "ARCHIVED" },
          { label: "Needs restock", value: "restock", match: (p) => totals(p).low + totals(p).out > 0 },
          { label: "No sales", value: "no-sales", match: (p) => info(p).sold30 === 0 },
          { label: "Missing info", value: "missing", match: (p) => missing(p).length > 0 },
        ] as ListFilter<Product>[]).filter((f, index) => index === 0 || products.some(f.match))}
        emptyText={products.length === 0 ? "No products yet. Add your first one." : "No products match your search."}
        toolbar={
          <>
            <Select value={sort} items={SORTS} onValueChange={(v) => setSort(v as string)}>
              <SelectTrigger size="sm" aria-label="Sort products" className="hidden w-40 sm:flex"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SORTS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="sm" nativeButton={false} render={<Link href="/products/new" />}>
              <PlusIcon data-icon="inline-start" />
              Add product
            </Button>
          </>
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
