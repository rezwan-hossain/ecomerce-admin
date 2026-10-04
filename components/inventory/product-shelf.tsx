"use client"

import { useState } from "react"
import Link from "next/link"
import { ChevronLeftIcon, ChevronRightIcon, LayoutGridIcon, ListIcon, PackageIcon, PlusIcon, SearchIcon } from "lucide-react"

import { getStock } from "@/app/actions/inventory.actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { cn } from "@/lib/utils"
import type { Product } from "@/types/product.type"
import type { StockLevel, StorageLocation, VariantStock } from "@/types/inventory.type"

import { n0, Pill, StockMeter, taka } from "./inventory-ui"
import { ProductStockSheet } from "./product-stock-sheet"
import { StockHistorySheet } from "./stock-history-sheet"
import { StockSheet, type StockAction, type Warehouse } from "./stock-sheet"

export type Health = "ok" | "low" | "out" | "none" | "hold"

// Virtual warehouses (damage, returns) hold stock that isn't for sale.
export const isSellable = (l: StockLevel) => l.warehouse.type === "PHYSICAL" || l.warehouse.type === "STORE"

// One warehouse's stock of a variant, judged against the variant's low-stock alert.
export function levelHealth(v: VariantStock, l: StockLevel): Health {
  if (!isSellable(l)) return "hold"
  if (l.available <= 0) return "out"
  if (l.available <= v.lowStockThreshold) return "low"
  return "ok"
}

// A variant across its sellable warehouses: out if nothing can be sold, low if any warehouse is low.
export function variantHealth(v: VariantStock): Health {
  const sellable = v.levels.filter(isSellable)
  if (sellable.length === 0) return "none"
  if (v.stock <= 0) return "out"
  if (sellable.some((l) => levelHealth(v, l) !== "ok")) return "low"
  return "ok"
}

export const HEALTH_DOT: Record<Health, string> = {
  ok: "bg-emerald-600",
  low: "bg-amber-500",
  out: "bg-red-600",
  none: "ring-[1.5px] ring-inset ring-muted-foreground/50",
  hold: "bg-muted-foreground/40",
}

export type ShelfItem = { product: Product; variants: VariantStock[] }

export function shelfTotals(variants: VariantStock[]) {
  return {
    available: variants.reduce((s, v) => s + v.stock, 0),
    onHand: variants.reduce((s, v) => s + v.onHand, 0),
    reserved: variants.reduce((s, v) => s + v.reserved, 0),
    incoming: variants.reduce((s, v) => s + v.incoming, 0),
    damaged: variants.reduce((s, v) => s + v.damaged, 0),
    value: variants.reduce((s, v) => s + v.levels.reduce((t, l) => t + Number(l.unitCost) * l.onHand, 0), 0),
    low: variants.filter((v) => variantHealth(v) === "low").length,
    out: variants.filter((v) => variantHealth(v) === "out").length,
  }
}

const PAGE_SIZE = 12

const FILTERS: { value: string; label: string; match: (item: ShelfItem) => boolean }[] = [
  { value: "all", label: "All", match: (i) => i.product.status !== "ARCHIVED" },
  { value: "low", label: "Low", match: (i) => { const t = shelfTotals(i.variants); return t.low + t.out > 0 } },
  { value: "out", label: "Out", match: (i) => i.variants.length > 0 && shelfTotals(i.variants).available <= 0 },
  { value: "draft", label: "Drafts", match: (i) => i.product.status === "DRAFT" },
  { value: "archived", label: "Archived", match: (i) => i.product.status === "ARCHIVED" },
]

// Every warehouse that holds stock, sellable ones first. There's no warehouses endpoint, so it comes from the levels.
function warehousesFrom(stock: VariantStock[]) {
  const map = new Map<string, Warehouse & { name: string; type: string }>()
  for (const v of stock) for (const l of v.levels) map.set(l.warehouseId, { id: l.warehouseId, ...l.warehouse })
  return [...map.values()].sort((a, b) => Number(b.type === "PHYSICAL" || b.type === "STORE") - Number(a.type === "PHYSICAL" || a.type === "STORE") || a.code.localeCompare(b.code))
}

export function ProductShelf({
  products,
  initialStock,
  locations,
}: {
  products: Product[]
  initialStock: VariantStock[]
  locations: StorageLocation[]
}) {
  const [stock, setStock] = useState(initialStock)
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState("all")
  const [view, setView] = useState<"grid" | "list">("list")
  const [page, setPage] = useState(0)
  const [openId, setOpenId] = useState<string | null>(null)
  // A variant opened from the product's grid, and a stock action opened from there.
  const [detail, setDetail] = useState<{ variantId: string; warehouseId?: string } | null>(null)
  const [active, setActive] = useState<{ action: StockAction; variantId: string; warehouseId?: string } | null>(null)

  const items: ShelfItem[] = products.map((product) => ({ product, variants: stock.filter((v) => v.product.id === product.id) }))
  const warehouses = warehousesFrom(stock)
  const q = query.trim().toLowerCase()
  const visible = items.filter(
    (i) =>
      FILTERS.find((f) => f.value === filter)!.match(i) &&
      (!q || `${i.product.name} ${i.product.brand?.name ?? ""} ${i.variants.map((v) => v.sku).join(" ")}`.toLowerCase().includes(q))
  )
  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount - 1)
  const shown = visible.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE)
  const open = items.find((i) => i.product.id === openId)
  const variant = (id?: string) => stock.find((v) => v.variantId === id)

  async function refresh() {
    const res = await getStock()
    if (res.success) setStock(res.data)
  }

  return (
    <>
      <div className="flex flex-col gap-2 px-4 md:flex-row md:items-center md:justify-between lg:px-6">
        <Tabs
          value={filter}
          onValueChange={(value) => {
            setFilter(value as string)
            setPage(0)
          }}
        >
          <TabsList className="h-8 max-w-full gap-0.5 overflow-x-auto overflow-y-hidden rounded-lg p-0.5">
            {FILTERS.map((f) => {
              const count = items.filter(f.match).length
              return (
                <TabsTrigger
                  key={f.value}
                  value={f.value}
                  className="group/tab h-7 flex-none px-2.5 text-[13px] data-active:shadow-xs data-active:ring-1 data-active:ring-foreground/5"
                >
                  {f.label}
                  {f.value !== "all" && count > 0 && (
                    <span className="min-w-5 rounded-full bg-foreground/[.07] px-1.5 text-center text-[11px] leading-5 font-semibold text-muted-foreground tabular-nums group-data-active/tab:bg-primary/10 group-data-active/tab:text-primary">
                      {count}
                    </span>
                  )}
                </TabsTrigger>
              )
            })}
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-2">
          <div className="relative w-full md:w-72">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => {
                setQuery(e.target.value)
                setPage(0)
              }} placeholder="Name, brand or SKU..." className="h-8 pl-8" aria-label="Search products" />
          </div>
          <ToggleGroup
            multiple={false}
            value={[view]}
            onValueChange={(value) => value[0] && setView(value[0] as "grid" | "list")}
            variant="outline"
            className="bg-card"
          >
            <ToggleGroupItem value="grid" aria-label="Show as cards" title="Cards">
              <LayoutGridIcon />
            </ToggleGroupItem>
            <ToggleGroupItem value="list" aria-label="Show as list" title="List">
              <ListIcon />
            </ToggleGroupItem>
          </ToggleGroup>
          {view === "list" && (
            <Button className="shrink-0" nativeButton={false} render={<Link href="/products/new" />}>
              <PlusIcon data-icon="inline-start" />
              New product
            </Button>
          )}
        </div>
      </div>

      {view === "list" && visible.length > 0 && <ProductList items={shown} onOpen={setOpenId} />}

        {view === "grid" && (
        <div className="grid grid-cols-1 gap-4 px-4 sm:grid-cols-2 lg:px-6 xl:grid-cols-3 2xl:grid-cols-4">
          <Link
            href="/products/new"
            className="flex min-h-64 flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-card/50 p-6 text-center transition-colors hover:border-primary/50 hover:bg-primary/5"
          >
            <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary">
              <PlusIcon className="size-5" />
            </span>
            <strong className="font-semibold">New product</strong>
            <small className="max-w-[24ch] text-[13px] text-muted-foreground">Add details and variants, then record its first stock here.</small>
          </Link>
  
          {shown.map((item) => (
            <ProductCard key={item.product.id} item={item} onOpen={() => setOpenId(item.product.id)} />
          ))}
      </div>
      )}
      {visible.length === 0 && <p className="px-4 text-center text-sm text-muted-foreground lg:px-6">No products match. Try another search or filter.</p>}
      {visible.length > 0 && (
        <div className="flex items-center justify-between px-4 text-sm text-muted-foreground lg:px-6">
          <span>
            {visible.length} {visible.length === 1 ? "product" : "products"}
          </span>
          <div className="flex items-center gap-2">
            <span className="font-medium text-foreground">
              Page {currentPage + 1} of {pageCount}
            </span>
            <Button variant="outline" size="icon" className="size-8" onClick={() => setPage(currentPage - 1)} disabled={currentPage === 0}>
              <ChevronLeftIcon />
              <span className="sr-only">Previous page</span>
            </Button>
            <Button variant="outline" size="icon" className="size-8" onClick={() => setPage(currentPage + 1)} disabled={currentPage >= pageCount - 1}>
              <ChevronRightIcon />
              <span className="sr-only">Next page</span>
            </Button>
          </div>
        </div>
      )}

      {open && (
        <ProductStockSheet
          key={open.product.id}
          item={open}
          warehouses={warehouses}
          locations={locations}
          onCell={(variantId, warehouseId) => setDetail({ variantId, warehouseId })}
          onChanged={refresh}
          onClose={() => setOpenId(null)}
        />
      )}
      {detail && variant(detail.variantId) && (
        <StockHistorySheet
          key={detail.variantId}
          variant={variant(detail.variantId)!}
          locations={locations}
          highlightWarehouseId={detail.warehouseId}
          onAction={(action, warehouseId) => setActive({ action, variantId: detail.variantId, warehouseId })}
          onChanged={refresh}
          onClose={() => setDetail(null)}
        />
      )}
      {active && variant(active.variantId) && (
        <StockSheet
          key={`${active.action}-${active.variantId}-${active.warehouseId}`}
          action={active.action}
          variant={variant(active.variantId)!}
          warehouseId={active.warehouseId}
          warehouses={warehouses}
          locations={locations}
          onClose={() => setActive(null)}
          onDone={async () => {
            setActive(null)
            await refresh()
          }}
        />
      )}
    </>
  )
}

// The same products as rows: one line each, variants as dots, then the totals.
function ProductList({ items, onOpen }: { items: ShelfItem[]; onOpen: (id: string) => void }) {
  return (
    <div className="mx-4 overflow-x-auto rounded-2xl border bg-card shadow-xs lg:mx-6">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
          <tr className="border-b [&>th]:px-3 [&>th]:py-2.5 [&>th]:font-medium [&>th]:whitespace-nowrap [&>th:first-child]:pl-4">
            <th>Product</th>
            <th className="hidden lg:table-cell">Variants</th>
            <th className="hidden md:table-cell">Stock</th>
            <th className="text-right">On hand</th>
            <th className="hidden text-right sm:table-cell">Held</th>
            <th className="text-right">Available</th>
            <th className="hidden text-right md:table-cell">Value</th>
            <th className="w-10">
              <span className="sr-only">Open</span>
            </th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {items.map(({ product: p, variants }) => {
            const t = shelfTotals(variants)
            const active = variants.filter((v) => v.isActive)
            const image = p.images.find((i) => i.isPrimary) ?? p.images[0]
            const category = p.categories.find((c) => c.isPrimary) ?? p.categories[0]
            return (
              <tr
                key={p.id}
                tabIndex={0}
                onClick={() => onOpen(p.id)}
                onKeyDown={(e) => e.key === "Enter" && onOpen(p.id)}
                className="group cursor-pointer border-b border-border/60 transition-colors last:border-b-0 hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none [&>td]:px-3 [&>td]:py-3 [&>td:first-child]:pl-4"
              >
                <td>
                  <div className="flex min-w-64 items-center gap-3">
                    <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-lg border bg-muted/60 text-muted-foreground">
                      {image ? (
                        // eslint-disable-next-line @next/next/no-img-element -- any image host is allowed
                        <img src={image.url} alt="" className="size-full object-cover" />
                      ) : (
                        <PackageIcon className="size-4" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate font-medium group-hover:text-primary">{p.name}</span>
                        {p.status === "DRAFT" && <Pill tone="grey">Draft</Pill>}
                        {p.status === "ARCHIVED" && <Pill tone="amber">Archived</Pill>}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="truncate">{p.brand?.name ?? "No brand"}</span>
                        <span aria-hidden className="text-muted-foreground/50">·</span>
                        <span className="truncate">{category?.category.name ?? "Uncategorised"}</span>
                        {t.out > 0 && <span className="shrink-0 rounded bg-red-50 px-1.5 text-[11px] leading-[18px] font-medium text-red-700 dark:bg-red-950 dark:text-red-300">{t.out} out</span>}
                        {t.low > 0 && <span className="shrink-0 rounded bg-amber-50 px-1.5 text-[11px] leading-[18px] font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">{t.low} low</span>}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="hidden lg:table-cell">
                  <div className="flex max-w-80 flex-wrap gap-1">
                    {active.slice(0, 4).map((v) => (
                      <span key={v.variantId} className="inline-flex items-center gap-1.5 rounded-md bg-muted/70 px-1.5 py-0.5 text-xs whitespace-nowrap">
                        <span className={cn("size-1.5 rounded-full", HEALTH_DOT[variantHealth(v)])} aria-hidden />
                        <span className="text-muted-foreground">{v.name === v.sku ? "Default" : v.name}</span>
                        <span className="font-semibold">{n0(v.stock)}</span>
                      </span>
                    ))}
                    {active.length > 4 && <span className="self-center px-1 text-xs text-muted-foreground">+{active.length - 4}</span>}
                    {variants.length === 0 && <span className="text-xs text-muted-foreground">Not tracked yet</span>}
                  </div>
                </td>
                <td className="hidden w-40 md:table-cell">
                  <StockMeter available={t.available} reserved={t.reserved} incoming={t.incoming} damaged={t.damaged} />
                  <div className="mt-1 text-[11.5px] text-muted-foreground">
                    {n0(t.available)} of {n0(t.onHand)} sellable
                  </div>
                </td>
                <td className="text-right text-muted-foreground">{n0(t.onHand)}</td>
                <td className="hidden text-right text-muted-foreground sm:table-cell">{n0(t.reserved)}</td>
                <td className="text-right text-[15px] font-semibold">{n0(t.available)}</td>
                <td className="hidden text-right whitespace-nowrap text-muted-foreground md:table-cell">{taka(t.value)}</td>
                <td className="text-right">
                  <ChevronRightIcon className="ml-auto size-4 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// A shelf card: brand and flags, the name, every variant's sellable stock, then the totals.
function ProductCard({ item, onOpen }: { item: ShelfItem; onOpen: () => void }) {
  const { product: p, variants } = item
  const t = shelfTotals(variants)
  const shown = variants.filter((v) => v.isActive).slice(0, 4)
  const hidden = variants.filter((v) => v.isActive).length - shown.length
  const image = p.images.find((i) => i.isPrimary) ?? p.images[0]
  const category = p.categories.find((c) => c.isPrimary) ?? p.categories[0]

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex min-h-64 flex-col gap-3 rounded-2xl border bg-card p-4 shadow-xs text-left transition-[border-color,box-shadow] hover:border-foreground/25 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-lg border bg-muted text-muted-foreground">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element -- any image host is allowed
            <img src={image.url} alt="" className="size-full object-cover" />
          ) : (
            <PackageIcon className="size-4" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-1">
            <span className="text-xs text-muted-foreground">{p.brand?.name ?? "No brand"}</span>
            {p.status === "DRAFT" && <Pill tone="grey">Draft</Pill>}
            {p.status === "ARCHIVED" && <Pill tone="amber">Archived</Pill>}
            {t.out > 0 && <span className="rounded bg-red-50 px-1.5 text-[11px] leading-5 font-semibold text-red-700 dark:bg-red-950 dark:text-red-300">{t.out} out</span>}
            {t.low > 0 && <span className="rounded bg-amber-50 px-1.5 text-[11px] leading-5 font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300">{t.low} low</span>}
          </div>
          <div className="line-clamp-2 leading-snug font-medium">{p.name}</div>
          <div className="truncate text-xs text-muted-foreground">{category?.category.name ?? "Uncategorised"}</div>
        </div>
      </div>

      <ul className="flex flex-col gap-1 text-[13px]">
        {shown.map((v) => (
          <li key={v.variantId} className="flex min-w-0 items-center gap-2">
            <span className={cn("size-2 shrink-0 rounded-full", HEALTH_DOT[variantHealth(v)])} aria-hidden />
            <span className="min-w-0 flex-1 truncate text-muted-foreground">{v.name === v.sku ? "Default" : v.name}</span>
            <b className="font-semibold tabular-nums">{n0(v.stock)}</b>
          </li>
        ))}
        {hidden > 0 && <li className="pl-4 text-xs text-muted-foreground">{hidden} more {hidden === 1 ? "variant" : "variants"}</li>}
        {variants.length === 0 && <li className="text-muted-foreground">No variants in stock tracking yet.</li>}
      </ul>

      <div className="mt-auto flex flex-col gap-3">
        <StockMeter available={t.available} reserved={t.reserved} incoming={t.incoming} damaged={t.damaged} />
        <div className="flex items-end justify-between gap-3 border-t pt-3">
          <span>
            <strong className="block text-2xl leading-none font-semibold tabular-nums">{n0(t.available)}</strong>
            <small className="text-xs text-muted-foreground">available of {n0(t.onHand)} on hand</small>
          </span>
          <span className="text-right">
            <strong className="block font-semibold tabular-nums">{taka(t.value)}</strong>
            <small className="text-xs text-muted-foreground">stock value</small>
          </span>
        </div>
      </div>
    </button>
  )
}
