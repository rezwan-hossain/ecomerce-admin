"use client"

import Link from "next/link"
import { useState } from "react"
import { toast } from "sonner"
import { ArchiveIcon, ArrowLeftIcon, BadgeCheckIcon, BoxesIcon, CheckIcon, ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, CircleDashedIcon, CopyIcon, PackageIcon, PencilIcon, SendIcon, StarIcon } from "lucide-react"
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts"

import { changeProductStatus } from "@/app/actions/product.actions"
import { moderateReview } from "@/app/actions/review.actions"
import { Card, fmtDate, fmtDateTime, Kpis, n0, Pill, RackTag, rel, taka, type Tone, WarehouseTag } from "@/components/inventory/inventory-ui"
import { MovementTag } from "@/components/inventory/movements-table"
import { HEALTH_DOT, isSellable, shelfTotals, variantHealth } from "@/components/inventory/product-shelf"
import { localPhone, ORDER_STATUS_LABEL, paidSoFar } from "@/components/orders/orders-table"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { cn } from "@/lib/utils"
import type { LedgerMovement, VariantStock } from "@/types/inventory.type"
import type { Order, OrderAddress } from "@/types/order.type"
import type { ProductDetail } from "@/types/product.type"
import type { Review } from "@/types/review.type"

const STATUS_LABEL = { ACTIVE: "Active", DRAFT: "Draft", ARCHIVED: "Archived" } as const
const REVIEW_TONE: Record<Review["status"], Tone> = { APPROVED: "green", PENDING: "amber", REJECTED: "red" }
// These orders never took the stock, so they don't count as sold.
const NOT_SOLD = ["CANCELLED", "FAILED", "REFUNDED", "RETURNED"]

const OUTCOMES = [
  { label: "Delivered", statuses: ["DELIVERED", "COMPLETED"], color: "bg-emerald-500" },
  { label: "In progress", statuses: ["PENDING", "CONFIRMED", "PROCESSING", "READY_TO_SHIP", "SHIPPED"], color: "bg-blue-500" },
  { label: "Returned", statuses: ["RETURNED", "PARTIALLY_RETURNED", "REFUNDED"], color: "bg-amber-500" },
  { label: "Cancelled", statuses: ["CANCELLED", "FAILED"], color: "bg-red-500" },
]
// Orders whose units left the warehouse, for the return rate.
const SHIPPED = ["SHIPPED", "DELIVERED", "COMPLETED", "RETURNED", "PARTIALLY_RETURNED", "REFUNDED"]
const ORDERS_PAGE = 20
const SIZES = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL"]
const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0)

const WEEKS = 12
const DAY = 86_400_000
const chartConfig = { units: { label: "Units sold", color: "var(--chart-1)" } } satisfies ChartConfig

// Monday 00:00 of the week holding this date.
function weekStart(date: Date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d
}

const th = "px-3 py-2 font-medium whitespace-nowrap first:pl-4 last:pr-4"
const td = "px-3 py-2.5 first:pl-4 last:pr-4"

function priceText(min: number, max: number) {
  if (min === max) return taka(min)
  return `${taka(min)} – ${taka(max)}`
}

export function ProductDetailPage({
  product,
  stock,
  movements,
  orders,
  reviews,
  addresses,
}: {
  product: ProductDetail
  stock: VariantStock[]
  movements: LedgerMovement[]
  orders: Order[]
  reviews: Review[]
  addresses: Record<string, OrderAddress> // order id → shipping address
}) {
  const images = [...product.images].sort((a, b) => a.position - b.position)
  const [imageIndex, setImageIndex] = useState(Math.max(0, images.findIndex((i) => i.isPrimary)))
  const image = images[imageIndex]
  const category = product.categories.find((c) => c.isPrimary) ?? product.categories[0]

  const stockById = new Map(stock.map((v) => [v.variantId, v]))
  const totals = shelfTotals(stock)

  const prices = product.variants.map((v) => Number(v.pricing?.effectivePrice ?? v.price))
  const originals = product.variants.map((v) => Number(v.price))
  const promotions = [
    ...new Map(product.variants.flatMap((v) => (v.pricing?.promotion ? [[v.pricing.promotion.id, v.pricing.promotion] as const] : []))).values(),
  ]

  // This product's lines in each order; an order can hold several of its variants.
  const orderLines = orders.map((o) => {
    const items = o.items.filter((i) => i.productId === product.id)
    return {
      order: o,
      items,
      // Units that came back weren't sold.
      quantity: items.reduce((s, i) => s + i.quantity - (i.returnedQuantity ?? 0), 0),
      total: items.reduce((s, i) => s + (Number(i.totalAmount) / i.quantity) * (i.quantity - (i.returnedQuantity ?? 0)), 0),
    }
  })
  const sold = orderLines.filter((l) => !NOT_SOLD.includes(l.order.status))
  const unitsSold = sold.reduce((s, l) => s + l.quantity, 0)
  const revenue = sold.reduce((s, l) => s + l.total, 0)

  // Units per week for the chart, and the last 30 days against the 30 before for the pace.
  const thisWeek = weekStart(new Date())
  const weeks = Array.from({ length: WEEKS }, (_, i) => {
    const start = new Date(thisWeek)
    start.setDate(start.getDate() - (WEEKS - 1 - i) * 7)
    return { start: start.getTime(), week: start.toLocaleDateString("en-GB", { day: "numeric", month: "short" }), units: 0, revenue: 0 }
  })
  const now = Date.now()
  let units30 = 0
  let revenue30 = 0
  let unitsBefore = 0
  for (const l of sold) {
    const at = new Date(l.order.placedAt ?? l.order.createdAt)
    const week = weeks.find((w) => w.start === weekStart(at).getTime())
    if (week) {
      week.units += l.quantity
      week.revenue += l.total
    }
    const age = now - at.getTime()
    if (age <= 30 * DAY) {
      units30 += l.quantity
      revenue30 += l.total
    } else if (age <= 60 * DAY) {
      unitsBefore += l.quantity
    }
  }
  const daysOfCover = units30 > 0 ? Math.round(totals.available / (units30 / 30)) : null

  const [allMovements, setAllMovements] = useState(false)
  const [allReviews, setAllReviews] = useState(false)
  const [orderFilter, setOrderFilter] = useState("All")
  const [orderPage, setOrderPage] = useState(0)

  const approved = reviews.filter((r) => r.status === "APPROVED")
  const pending = reviews.filter((r) => r.status === "PENDING").length
  const rating = approved.length ? approved.reduce((s, r) => s + r.rating, 0) / approved.length : 0

  // Who buys it most, by email.
  const buyers = new Map<string, { name: string; email: string; units: number; spent: number; orders: number }>()
  for (const l of sold) {
    const key = l.order.customerEmail.toLowerCase()
    const b = buyers.get(key) ?? { name: l.order.customerName ?? l.order.customerEmail, email: l.order.customerEmail, units: 0, spent: 0, orders: 0 }
    b.units += l.quantity
    b.spent += l.total
    b.orders++
    buyers.set(key, b)
  }
  const topBuyers = [...buyers.values()].sort((a, b) => b.spent - a.spent).slice(0, 5)
  const repeatBuyers = [...buyers.values()].filter((b) => b.orders >= 2).length

  // Units and revenue per variant; list value is what the units cost before discounts.
  const byVariant = new Map<string, { units: number; revenue: number }>()
  let listValue = 0
  for (const l of sold) {
    for (const i of l.items) {
      const kept = i.quantity - (i.returnedQuantity ?? 0)
      const v = byVariant.get(i.variantId ?? "") ?? { units: 0, revenue: 0 }
      v.units += kept
      v.revenue += (Number(i.totalAmount) / i.quantity) * kept
      byVariant.set(i.variantId ?? "", v)
      listValue += Number(i.unitPrice) * kept
    }
  }
  const discountGiven = Math.max(0, listValue - revenue)

  // How the orders holding it ended up.
  const outcomes = OUTCOMES.map((o) => ({ ...o, count: orders.filter((x) => o.statuses.includes(x.status)).length }))
  const unitsOrdered = orderLines.reduce((s, l) => s + l.items.reduce((t, i) => t + i.quantity, 0), 0)
  const unitsReturned = orderLines.reduce((s, l) => s + l.items.reduce((t, i) => t + (i.returnedQuantity ?? 0), 0), 0)
  const unitsShipped = orderLines
    .filter((l) => SHIPPED.includes(l.order.status))
    .reduce((s, l) => s + l.items.reduce((t, i) => t + i.quantity, 0), 0)
  const cancelled = outcomes.find((o) => o.label === "Cancelled")!.count
  const sellThrough = unitsSold + totals.onHand > 0 ? unitsSold / (unitsSold + totals.onHand) : 0
  const codOrders = sold.filter((l) => l.order.payments.some((p) => p.provider === "COD")).length
  const firstSold = sold.map((l) => l.order.placedAt ?? l.order.createdAt).sort()[0] ?? null

  // Other products in the same orders, by how many orders they shared.
  const together = new Map<string, { id: string; name: string; orders: number; units: number }>()
  for (const l of sold) {
    const seen = new Set<string>()
    for (const i of l.order.items) {
      if (!i.productId || i.productId === product.id) continue
      const t = together.get(i.productId) ?? { id: i.productId, name: i.productName, orders: 0, units: 0 }
      if (!seen.has(i.productId)) t.orders++
      t.units += i.quantity
      seen.add(i.productId)
      together.set(i.productId, t)
    }
  }
  const boughtWith = [...together.values()].sort((a, b) => b.orders - a.orders).slice(0, 5)

  // The Orders card: newest first, filtered by outcome, 20 a page.
  const filteredLines = orderLines
    .filter((l) => orderFilter === "All" || OUTCOMES.find((o) => o.label === orderFilter)!.statuses.includes(l.order.status))
    .sort((a, b) => (b.order.placedAt ?? b.order.createdAt).localeCompare(a.order.placedAt ?? a.order.createdAt))
  const orderPages = Math.max(1, Math.ceil(filteredLines.length / ORDERS_PAGE))
  const shownLines = filteredLines.slice(orderPage * ORDERS_PAGE, (orderPage + 1) * ORDERS_PAGE)

  // Districts it ships to, from each order's shipping address.
  const places = new Map<string, { name: string; orders: number; units: number }>()
  for (const l of sold) {
    const city = addresses[l.order.id]?.city?.trim()
    if (!city) continue
    const p = places.get(city.toLowerCase()) ?? { name: city, orders: 0, units: 0 }
    p.orders++
    p.units += l.quantity
    places.set(city.toLowerCase(), p)
  }
  const topPlaces = [...places.values()].sort((a, b) => b.units - a.units).slice(0, 5)

  // Shoe sizes by number and clothing sizes small to large; anything else keeps the saved order.
  const rank = (v: ProductDetail["variants"][number]) =>
    v.optionValues.map((o) => {
      const value = o.optionValue.value.trim().toUpperCase()
      if (/^\d+(\.\d+)?$/.test(value)) return Number(value)
      if (SIZES.includes(value)) return SIZES.indexOf(value)
      return 0
    })
  const variants = [...product.variants].sort((a, b) => {
    const ra = rank(a)
    const rb = rank(b)
    const i = ra.findIndex((x, k) => x !== rb[k])
    return i === -1 ? 0 : ra[i] - rb[i]
  })
  const maxOnHand = Math.max(1, ...stock.map((v) => v.onHand))

  const unitCostOf = (variantId: string) => Number(stockById.get(variantId)?.levels.find((l) => Number(l.unitCost) > 0)?.unitCost ?? 0)
  const costMissing = stock.some((v) => v.onHand > 0 && !v.levels.some((l) => Number(l.unitCost) > 0))

  // What a complete listing has; each miss is something to fix in Edit product.
  const checks = [
    { text: "At least 3 images", ok: images.length >= 3, detail: `${images.length} added` },
    { text: "Every image has alt text", ok: images.length > 0 && images.every((i) => i.altText?.trim()), detail: "helps search and screen readers" },
    { text: "Short description", ok: Boolean(product.shortDescription?.trim()), detail: "shown in listings" },
    { text: "Full description", ok: (product.description?.trim().length ?? 0) >= 80, detail: "80 characters or more" },
    { text: "Brand and category", ok: Boolean(product.brand) && product.categories.length > 0, detail: "for filters and navigation" },
    { text: "Tags", ok: product.tags.length > 0, detail: "for collections and search" },
    { text: "In stock", ok: totals.available > 0, detail: `${n0(totals.available)} sellable` },
    { text: "Unit cost recorded", ok: !costMissing && totals.onHand > 0, detail: "needed for stock value and margin" },
    { text: "Published and visible", ok: product.status === "ACTIVE" && product.isActive, detail: "shoppers can find it" },
  ]
  const passed = checks.filter((c) => c.ok).length

  const lastMovement = movements[0]?.createdAt ?? null
  const lastSold = sold.map((l) => l.order.placedAt ?? l.order.createdAt).sort().at(-1) ?? null
  const lastReview = reviews.map((r) => r.createdAt).sort().at(-1) ?? null

  const [busy, setBusy] = useState(false)

  async function setStatus(action: "publish" | "archive" | "unarchive") {
    setBusy(true)
    const res = await changeProductStatus(product.id, action)
    setBusy(false)
    if (!res.success) return toast.error(res.error)
    toast.success(`${product.name} is now ${STATUS_LABEL[res.data.status].toLowerCase()}`)
  }

  async function moderate(review: Review, status: "APPROVED" | "REJECTED") {
    setBusy(true)
    const res = await moderateReview(review.id, product.id, status)
    setBusy(false)
    if (!res.success) return toast.error(res.error)
    toast.success(status === "APPROVED" ? "Review approved: it now shows in the store" : "Review rejected")
  }

  // Stock per warehouse, all variants together, with the racks holding it.
  const warehouses = new Map<string, { code: string; name: string; sellable: boolean; onHand: number; reserved: number; available: number; value: number; racks: Map<string, number> }>()
  for (const v of stock) {
    for (const l of v.levels) {
      const w = warehouses.get(l.warehouseId) ?? {
        code: l.warehouse.code,
        name: l.warehouse.name,
        sellable: isSellable(l),
        onHand: 0,
        reserved: 0,
        available: 0,
        value: 0,
        racks: new Map<string, number>(),
      }
      w.onHand += l.onHand
      w.reserved += l.reserved
      w.available += l.available
      w.value += Number(l.unitCost) * l.onHand
      for (const s of l.locationStocks) {
        if (s.quantity > 0) w.racks.set(s.location.code, (w.racks.get(s.location.code) ?? 0) + s.quantity)
      }
      warehouses.set(l.warehouseId, w)
    }
  }

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <header className="flex flex-wrap items-center gap-4 px-4 lg:px-6">
        <Button variant="ghost" size="icon" className="size-8 text-muted-foreground" nativeButton={false} render={<Link href="/products" />}>
          <ArrowLeftIcon />
          <span className="sr-only">All products</span>
        </Button>
        <span className="hidden size-14 shrink-0 place-items-center overflow-hidden rounded-xl border bg-muted/60 text-muted-foreground sm:grid">
          {images[0] ? (
            // eslint-disable-next-line @next/next/no-img-element -- any image host is allowed
            <img src={(images.find((i) => i.isPrimary) ?? images[0]).url} alt="" className="size-full object-cover" />
          ) : (
            <PackageIcon className="size-5" />
          )}
        </span>
        <div className="flex min-w-0 flex-1 basis-64 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{product.name}</h1>
            <StatusBadge status={STATUS_LABEL[product.status]} />
            {!product.isActive && <StatusBadge status="Inactive" />}
          </div>
          <p className="truncate text-sm text-muted-foreground">
            {product.brand?.name ?? "No brand"} · {category?.category.name ?? "Uncategorised"} · {product.variants.length}{" "}
            {product.variants.length === 1 ? "variant" : "variants"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {product.status === "DRAFT" && (
            <Button variant="outline" size="sm" onClick={() => setStatus("publish")} disabled={busy}>
              <SendIcon />
              Publish
            </Button>
          )}
          {product.status === "ACTIVE" && (
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setStatus("archive")} disabled={busy}>
              <ArchiveIcon />
              Archive
            </Button>
          )}
          {product.status === "ARCHIVED" && (
            <Button variant="outline" size="sm" onClick={() => setStatus("unarchive")} disabled={busy}>
              Unarchive
            </Button>
          )}
          <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/inventory/products" />}>
            <BoxesIcon />
            Inventory
          </Button>
          <Button size="sm" nativeButton={false} render={<Link href={`/products/${product.id}/edit`} />}>
            <PencilIcon />
            Edit product
          </Button>
        </div>
      </header>

      <Kpis
        items={[
          {
            label: "Price",
            value: priceText(Math.min(...prices), Math.max(...prices)),
            hint: promotions.length ? `was ${priceText(Math.min(...originals), Math.max(...originals))}` : "no promotion running",
          },
          { label: "Sellable", value: n0(totals.available), hint: `${n0(totals.onHand)} on hand`, warn: totals.out + totals.low > 0 },
          { label: "Held", value: n0(totals.reserved), hint: "reserved by open orders" },
          {
            label: "Stock value",
            value: taka(totals.value),
            hint: totals.value === 0 && totals.onHand > 0 ? "no unit cost recorded" : "at unit cost",
            warn: totals.value === 0 && totals.onHand > 0,
          },
          { label: "Sold", value: n0(unitsSold), hint: `${taka(revenue)} in ${sold.length} ${sold.length === 1 ? "order" : "orders"}` },
          {
            label: "Rating",
            value: approved.length ? `${rating.toFixed(1)} ★` : "—",
            hint: `${approved.length} ${approved.length === 1 ? "review" : "reviews"}${pending ? ` · ${pending} pending` : ""}`,
          },
        ]}
      />

      <div className="grid gap-4 px-4 md:gap-6 lg:px-6 xl:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-4 md:gap-6 xl:col-span-2">
          <Card title="Sales" action={<span className="text-xs text-muted-foreground">Units sold per week · last {WEEKS} weeks</span>}>
            <div className="grid gap-4 px-4 pb-4 sm:grid-cols-[12rem_1fr]">
              <dl className="grid grid-cols-3 gap-3 text-sm sm:grid-cols-1 sm:content-start">
                <div>
                  <dt className="text-xs text-muted-foreground">Last 30 days</dt>
                  <dd className="text-xl font-bold tracking-tight tabular-nums">
                    {n0(units30)} <span className="text-sm font-medium text-muted-foreground">{units30 === 1 ? "unit" : "units"}</span>
                  </dd>
                  <dd className="text-xs text-muted-foreground">
                    {n0(unitsBefore)} in the 30 days before
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Revenue, 30 days</dt>
                  <dd className="text-xl font-bold tracking-tight tabular-nums">{taka(revenue30)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Stock lasts</dt>
                  <dd className={cn("text-xl font-bold tracking-tight tabular-nums", daysOfCover !== null && daysOfCover < 14 && "text-amber-700 dark:text-amber-400")}>
                    {daysOfCover === null && "—"}
                    {daysOfCover !== null && daysOfCover > 365 && "Over a year"}
                    {daysOfCover !== null && daysOfCover <= 365 && `${n0(daysOfCover)} days`}
                  </dd>
                  <dd className="text-xs text-muted-foreground">{daysOfCover === null ? "no sales in 30 days" : "at the last 30 days' pace"}</dd>
                </div>
              </dl>
              <ChartContainer config={chartConfig} className="aspect-auto h-44 w-full">
                <BarChart data={weeks} margin={{ top: 4, left: 0, right: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="week" tickLine={false} axisLine={false} tickMargin={8} interval="preserveStartEnd" minTickGap={16} fontSize={11} />
                  <ChartTooltip
                    cursor={{ fill: "var(--muted)" }}
                    content={
                      <ChartTooltipContent
                        labelFormatter={(week) => `Week of ${week}`}
                        formatter={(value, _name, item) => `${n0(Number(value))} units · ${taka(item.payload.revenue)}`}
                      />
                    }
                  />
                  <Bar dataKey="units" fill="var(--color-units)" radius={4} maxBarSize={24} />
                </BarChart>
              </ChartContainer>
            </div>
          </Card>

          <Card title="Performance" action={<span className="text-xs text-muted-foreground">All time · {n0(orders.length)} orders</span>}>
            <div className="flex flex-col gap-4 px-4 pb-4">
              <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border text-xs sm:grid-cols-4 [&>div]:bg-card [&>div]:px-3 [&>div]:py-2.5">
                <div>
                  <dt className="text-muted-foreground">Average selling price</dt>
                  <dd className="mt-0.5 text-base font-semibold tabular-nums">{unitsSold ? taka(revenue / unitsSold) : "—"}</dd>
                  <dd className="text-muted-foreground">{listValue > 0 ? `${pct(discountGiven, listValue)}% below list` : "no sales yet"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Discounts given</dt>
                  <dd className="mt-0.5 text-base font-semibold tabular-nums">{taka(discountGiven)}</dd>
                  <dd className="text-muted-foreground">on {n0(unitsSold)} {unitsSold === 1 ? "unit" : "units"} sold</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Sell-through</dt>
                  <dd className="mt-0.5 text-base font-semibold tabular-nums">{Math.round(sellThrough * 100)}%</dd>
                  <dd className="text-muted-foreground">sold of sold + on hand</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Return rate</dt>
                  <dd className={cn("mt-0.5 text-base font-semibold tabular-nums", pct(unitsReturned, unitsShipped) >= 10 && "text-amber-700 dark:text-amber-400")}>
                    {pct(unitsReturned, unitsShipped)}%
                  </dd>
                  <dd className="text-muted-foreground">
                    {n0(unitsReturned)} of {n0(unitsShipped)} shipped units
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Cancel rate</dt>
                  <dd className={cn("mt-0.5 text-base font-semibold tabular-nums", pct(cancelled, orders.length) >= 20 && "text-amber-700 dark:text-amber-400")}>
                    {pct(cancelled, orders.length)}%
                  </dd>
                  <dd className="text-muted-foreground">
                    {n0(cancelled)} of {n0(orders.length)} orders
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Cash on delivery</dt>
                  <dd className="mt-0.5 text-base font-semibold tabular-nums">{pct(codOrders, sold.length)}%</dd>
                  <dd className="text-muted-foreground">of orders paid on delivery</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Repeat buyers</dt>
                  <dd className="mt-0.5 text-base font-semibold tabular-nums">{n0(repeatBuyers)}</dd>
                  <dd className="text-muted-foreground">of {n0(buyers.size)} bought it twice or more</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Units per order</dt>
                  <dd className="mt-0.5 text-base font-semibold tabular-nums">{orders.length ? (unitsOrdered / orders.length).toFixed(1) : "—"}</dd>
                  <dd className="text-muted-foreground">{firstSold ? `first sold ${fmtDate(firstSold)}` : "never sold"}</dd>
                </div>
              </dl>
              {orders.length > 0 && (
                <div>
                  <div className="mb-2 text-xs font-medium text-muted-foreground">How its orders ended up</div>
                  <div className="flex h-2.5 overflow-hidden rounded-full bg-muted">
                    {outcomes.map((o) => (
                      <div key={o.label} className={o.color} style={{ width: `${(o.count / orders.length) * 100}%` }} title={`${o.label}: ${o.count}`} />
                    ))}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                    {outcomes.map((o) => (
                      <span key={o.label} className="flex items-center gap-1.5">
                        <span className={cn("size-2 rounded-full", o.color)} />
                        {o.label}
                        <span className="font-medium tabular-nums">{n0(o.count)}</span>
                        <span className="text-muted-foreground tabular-nums">{pct(o.count, orders.length)}%</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>

          <Card title="Variants" action={<span className="text-xs text-muted-foreground">Price after promotion · stock in sellable warehouses</span>}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className={th}>Variant</th>
                    <th className={cn(th, "text-right")}>Price</th>
                    <th className={th}>Stock</th>
                    <th className={cn(th, "hidden sm:table-cell")}>Sold</th>
                    <th className={cn(th, "hidden text-right lg:table-cell")}>Cost · margin</th>
                  </tr>
                </thead>
                <tbody>
                  {variants.map((v) => {
                    const s = stockById.get(v.id)
                    const name = v.optionValues.map((o) => o.optionValue.value).join(" / ") || "Default"
                    const unitCost = unitCostOf(v.id)
                    const price = Number(v.pricing?.effectivePrice ?? v.price)
                    const sellable = s?.stock ?? 0
                    const onHand = s?.onHand ?? 0
                    const units = byVariant.get(v.id)?.units ?? 0
                    const thumb = v.images[0]?.url ?? images[0]?.url
                    let stockTone = "bg-emerald-500"
                    let stockText = ""
                    if (sellable <= 0) {
                      stockTone = "bg-red-500"
                      stockText = "text-destructive"
                    } else if (sellable <= v.lowStockThreshold) {
                      stockTone = "bg-amber-500"
                      stockText = "text-amber-700 dark:text-amber-400"
                    }
                    return (
                      <tr key={v.id} className="border-t border-border/60 hover:bg-muted/30">
                        <td className={td}>
                          <div className="flex items-center gap-3">
                            <span className="relative grid size-11 shrink-0 place-items-center overflow-hidden rounded-lg border bg-muted/60 text-muted-foreground">
                              {thumb ? (
                                // eslint-disable-next-line @next/next/no-img-element -- any image host is allowed
                                <img src={thumb} alt="" className="size-full object-cover" />
                              ) : (
                                <PackageIcon className="size-4" />
                              )}
                            </span>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className={cn("size-2 shrink-0 rounded-full", HEALTH_DOT[s ? variantHealth(s) : "none"])} aria-hidden />
                                <span className="font-semibold">{name}</span>
                                {!v.isActive && <Pill tone="grey">Hidden</Pill>}
                              </div>
                              <div className="flex items-center gap-0.5">
                                <span className="max-w-40 truncate font-mono text-[11px] text-muted-foreground" title={v.sku}>
                                  {v.sku}
                                </span>
                                <CopyButton text={v.sku} what="SKU" />
                              </div>
                              {s && s.levels.length > 0 && (
                                <div className="mt-0.5 flex flex-wrap gap-1">
                                  {s.levels.map((l) => (
                                    <WarehouseTag key={l.warehouseId} code={l.warehouse.code} count={l.available} tone={l.available <= 0 ? "bad" : undefined} />
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className={cn(td, "text-right tabular-nums")}>
                          <div className="font-semibold">{taka(price)}</div>
                          {v.pricing?.hasPromotion && <div className="text-xs text-muted-foreground line-through">{taka(Number(v.price))}</div>}
                        </td>
                        <td className={cn(td, "min-w-40")}>
                          <div className="flex items-baseline justify-between gap-2">
                            <span className={cn("text-base font-semibold tabular-nums", stockText)}>
                              {n0(sellable)} <span className="text-xs font-normal text-muted-foreground">sellable</span>
                            </span>
                            <span className="text-xs whitespace-nowrap text-muted-foreground tabular-nums">of {n0(onHand)}</span>
                          </div>
                          {/* Bars share one scale, so variants compare at a glance; the tick is the low-stock alert. */}
                          <div className="relative mt-1 h-1.5 rounded-full bg-muted">
                            <div className={cn("h-full rounded-full", stockTone)} style={{ width: `${pct(sellable, maxOnHand)}%` }} />
                            <span
                              className="absolute -top-0.5 h-2.5 w-px bg-foreground/40"
                              style={{ left: `${Math.min(100, pct(v.lowStockThreshold, maxOnHand))}%` }}
                              title={`Alert at ${v.lowStockThreshold}`}
                            />
                          </div>
                          <div className="mt-1 text-[11px] whitespace-nowrap text-muted-foreground">
                            {(s?.reserved ?? 0) > 0 && `${n0(s!.reserved)} held · `}alert at {n0(v.lowStockThreshold)}
                          </div>
                        </td>
                        <td className={cn(td, "hidden sm:table-cell")}>
                          {units > 0 ? (
                            <div className="w-24">
                              <div className="flex items-baseline justify-between text-xs">
                                <span className="text-sm font-semibold tabular-nums">{n0(units)}</span>
                                <span className="text-muted-foreground tabular-nums">{pct(units, unitsSold)}%</span>
                              </div>
                              <div className="mt-1 h-1 rounded-full bg-muted">
                                <div className="h-full rounded-full bg-primary" style={{ width: `${pct(units, unitsSold)}%` }} />
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">No sales</span>
                          )}
                        </td>
                        <td className={cn(td, "hidden text-right tabular-nums lg:table-cell")}>
                          {unitCost > 0 ? (
                            <>
                              <div className="text-muted-foreground">{taka(unitCost)}</div>
                              <div className={cn("text-xs font-medium", price - unitCost < 0 ? "text-destructive" : "text-emerald-700 dark:text-emerald-400")}>
                                {pct(price - unitCost, price)}% margin
                              </div>
                            </>
                          ) : (
                            <span className="text-xs text-muted-foreground">No cost yet</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                {variants.length > 1 && (
                  <tfoot className="border-t bg-muted/30 text-xs text-muted-foreground">
                    <tr>
                      <td className={cn(td, "font-medium text-foreground")}>{n0(variants.length)} variants</td>
                      <td className={cn(td, "text-right tabular-nums whitespace-nowrap")}>{priceText(Math.min(...prices), Math.max(...prices))}</td>
                      <td className={cn(td, "tabular-nums")}>
                        <span className="font-semibold text-foreground">{n0(totals.available)}</span> sellable of {n0(totals.onHand)}
                      </td>
                      <td className={cn(td, "hidden tabular-nums sm:table-cell")}>
                        <span className="font-semibold text-foreground">{n0(unitsSold)}</span> sold
                      </td>
                      <td className={cn(td, "hidden lg:table-cell")} />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </Card>

          <Card title="Stock by warehouse">
            {warehouses.size === 0 ? (
              <p className="px-4 pb-4 text-sm text-muted-foreground">No stock recorded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                    <tr>
                      <th className={th}>Warehouse</th>
                      <th className={cn(th, "hidden md:table-cell")}>Racks</th>
                      <th className={cn(th, "text-right")}>On hand</th>
                      <th className={cn(th, "hidden text-right sm:table-cell")}>Held</th>
                      <th className={cn(th, "text-right")}>Available</th>
                      <th className={cn(th, "hidden text-right sm:table-cell")}>Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...warehouses.entries()].map(([id, w]) => (
                      <tr key={id} className="border-t border-border/60">
                        <td className={td}>
                          <div className="font-medium">{w.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {w.code}
                            {!w.sellable && " · not for sale"}
                          </div>
                        </td>
                        <td className={cn(td, "hidden md:table-cell")}>
                          <div className="flex flex-wrap items-center gap-1">
                            {[...w.racks.entries()].map(([code, qty]) =>
                              // UNASSIGNED is the system catch-all for stock whose rack isn't known.
                              code === "UNASSIGNED" ? (
                                <span key={code} className="text-xs text-muted-foreground">
                                  {n0(qty)} not on a rack
                                </span>
                              ) : (
                                <RackTag key={code} code={code} title={`${n0(qty)} units`} />
                              )
                            )}
                          </div>
                        </td>
                        <td className={cn(td, "text-right text-muted-foreground tabular-nums")}>{n0(w.onHand)}</td>
                        <td className={cn(td, "hidden text-right text-muted-foreground tabular-nums sm:table-cell")}>{n0(w.reserved)}</td>
                        <td className={cn(td, "text-right font-semibold tabular-nums")}>{n0(w.available)}</td>
                        <td className={cn(td, "hidden text-right text-muted-foreground tabular-nums sm:table-cell")}>{w.value > 0 ? taka(w.value) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card
            title="Orders"
            action={
              <span className="text-xs text-muted-foreground">
                {n0(orders.length)} {orders.length === 1 ? "order" : "orders"} · {n0(unitsOrdered)} {unitsOrdered === 1 ? "unit" : "units"}
              </span>
            }
          >
            {orders.length === 0 ? (
              <p className="px-4 pb-4 text-sm text-muted-foreground">Nobody has ordered this product yet.</p>
            ) : (
              <>
                <div className="flex flex-wrap gap-1.5 px-4 pb-3">
                  {[{ label: "All", count: orders.length }, ...outcomes].map((f) =>
                    f.label === "All" || f.count > 0 ? (
                      <button
                        key={f.label}
                        type="button"
                        onClick={() => {
                          setOrderFilter(f.label)
                          setOrderPage(0)
                        }}
                        className={cn(
                          "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground",
                          orderFilter === f.label && "border-primary/40 bg-primary/5 text-primary hover:text-primary"
                        )}
                      >
                        {f.label}
                        <span className="tabular-nums opacity-70">{n0(f.count)}</span>
                      </button>
                    ) : null
                  )}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                      <tr>
                        <th className={th}>Order</th>
                        <th className={cn(th, "hidden md:table-cell")}>Customer</th>
                        <th className={cn(th, "hidden sm:table-cell")}>Items</th>
                        <th className={th}>Status</th>
                        <th className={cn(th, "text-right")}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shownLines.map(({ order, items, total }) => {
                        const others = order.items.filter((i) => i.productId !== product.id).length
                        const paid = paidSoFar(order)
                        let payment = { text: "Unpaid", className: "text-amber-700 dark:text-amber-400" }
                        if (paid >= Number(order.totalAmount)) payment = { text: "Paid", className: "text-emerald-700 dark:text-emerald-400" }
                        else if (order.payments.some((p) => p.provider === "COD")) payment = { text: "Cash on delivery", className: "text-muted-foreground" }
                        return (
                          <tr key={order.id} className="border-t border-border/60 hover:bg-muted/30">
                            <td className={td}>
                              <Link href={`/orders/${order.id}`} className="font-medium whitespace-nowrap hover:text-primary hover:underline">
                                {order.orderNumber}
                              </Link>
                              <div className="text-xs whitespace-nowrap text-muted-foreground" title={fmtDateTime(order.placedAt ?? order.createdAt)}>
                                {fmtDate(order.placedAt ?? order.createdAt)}
                              </div>
                            </td>
                            <td className={cn(td, "hidden max-w-52 md:table-cell")}>
                              <div className="flex items-center gap-2.5">
                                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary uppercase">
                                  {(order.customerName ?? order.customerEmail)
                                    .split(/\s+/)
                                    .map((w) => w[0])
                                    .join("")
                                    .slice(0, 2)}
                                </span>
                                <div className="min-w-0">
                                  <div className="truncate font-medium capitalize">{order.customerName ?? order.customerEmail}</div>
                                  <div className="truncate text-xs text-muted-foreground">
                                    {order.customerPhone ? localPhone(order.customerPhone) : order.customerEmail}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className={cn(td, "hidden sm:table-cell")}>
                              <div className="flex flex-wrap gap-1">
                                {items.map((i) => (
                                  <span key={i.id} className="rounded-md bg-muted px-1.5 text-xs leading-5 font-medium whitespace-nowrap">
                                    {i.variantName && i.variantName !== i.sku ? i.variantName : "Default"}
                                    <span className="text-muted-foreground"> × {i.quantity}</span>
                                  </span>
                                ))}
                              </div>
                              <div className="mt-0.5 text-xs whitespace-nowrap text-muted-foreground">
                                {taka(Number(items[0].unitPrice))} each
                              </div>
                            </td>
                            <td className={td}>
                              <StatusBadge status={ORDER_STATUS_LABEL[order.status]} />
                              {!["CANCELLED", "FAILED"].includes(order.status) && (
                                <div className={cn("mt-0.5 text-xs whitespace-nowrap", payment.className)}>{payment.text}</div>
                              )}
                            </td>
                            <td className={cn(td, "text-right tabular-nums")}>
                              <div className="font-semibold">{taka(total)}</div>
                              {others > 0 && (
                                <div className="text-xs whitespace-nowrap text-muted-foreground" title={`+${others} other ${others === 1 ? "item" : "items"} in this order`}>
                                  of {taka(Number(order.totalAmount))} order
                                </div>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                {filteredLines.length > ORDERS_PAGE && (
                  <div className="flex items-center justify-between gap-2 border-t border-border/60 px-4 py-2.5 text-xs text-muted-foreground">
                    <span className="tabular-nums">
                      {n0(orderPage * ORDERS_PAGE + 1)}–{n0(Math.min((orderPage + 1) * ORDERS_PAGE, filteredLines.length))} of {n0(filteredLines.length)}
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="mr-1 tabular-nums">
                        Page {orderPage + 1} of {orderPages}
                      </span>
                      <Button variant="outline" size="icon-sm" onClick={() => setOrderPage(orderPage - 1)} disabled={orderPage === 0} aria-label="Previous page">
                        <ChevronLeftIcon />
                      </Button>
                      <Button variant="outline" size="icon-sm" onClick={() => setOrderPage(orderPage + 1)} disabled={orderPage >= orderPages - 1} aria-label="Next page">
                        <ChevronRightIcon />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </Card>

          <Card
            title="Stock movements"
            action={
              <Link href="/inventory/movements" className="text-xs font-medium text-primary hover:underline">
                All movements
              </Link>
            }
          >
            {movements.length === 0 ? (
              <p className="px-4 pb-4 text-sm text-muted-foreground">No movements yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                    <tr>
                      <th className={th}>When</th>
                      <th className={th}>Type</th>
                      <th className={cn(th, "hidden md:table-cell")}>SKU</th>
                      <th className={cn(th, "hidden sm:table-cell")}>Warehouse</th>
                      <th className={cn(th, "text-right")}>Qty</th>
                      <th className={cn(th, "hidden text-right sm:table-cell")}>After</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements.slice(0, allMovements ? undefined : 8).map((m) => {
                      const change = m.onHandAfter - m.onHandBefore
                      return (
                        <tr key={m.id} className="border-t border-border/60">
                          <td className={cn(td, "whitespace-nowrap text-muted-foreground")} title={fmtDateTime(m.createdAt)}>
                            {rel(m.createdAt)}
                          </td>
                          <td className={td}>
                            <MovementTag movement={m} />
                          </td>
                          <td className={cn(td, "hidden font-mono text-xs text-muted-foreground md:table-cell")}>{m.inventoryLevel.variant.sku}</td>
                          <td className={cn(td, "hidden sm:table-cell")}>
                            <WarehouseTag code={m.inventoryLevel.warehouse.code} />
                          </td>
                          <td
                            className={cn(
                              td,
                              "text-right font-semibold tabular-nums",
                              change > 0 && "text-emerald-700 dark:text-emerald-400",
                              change < 0 && "text-red-700 dark:text-red-400"
                            )}
                          >
                            {change > 0 && "+"}
                            {change < 0 && "−"}
                            {n0(change === 0 ? m.quantity : Math.abs(change))}
                          </td>
                          <td className={cn(td, "hidden text-right text-muted-foreground tabular-nums sm:table-cell")}>{n0(m.onHandAfter)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                <ShowAll open={allMovements} total={movements.length} shown={8} onToggle={() => setAllMovements(!allMovements)} />
              </div>
            )}
          </Card>

          <Card title="Reviews" action={pending > 0 && <Pill tone="amber">{pending} pending</Pill>}>
            {reviews.length === 0 ? (
              <p className="px-4 pb-4 text-sm text-muted-foreground">No reviews yet.</p>
            ) : (
              <div className="flex flex-col gap-4 px-4 pb-4">
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold tracking-tight">{approved.length ? rating.toFixed(1) : "—"}</div>
                    <Stars rating={Math.round(rating)} />
                    <div className="mt-0.5 text-xs text-muted-foreground">{approved.length} live</div>
                  </div>
                  <div className="flex flex-1 flex-col gap-1">
                    {[5, 4, 3, 2, 1].map((star) => {
                      const count = approved.filter((r) => r.rating === star).length
                      return (
                        <div key={star} className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="w-3 text-right tabular-nums">{star}</span>
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                            <div className="h-full rounded-full bg-amber-500" style={{ width: `${approved.length ? (count / approved.length) * 100 : 0}%` }} />
                          </div>
                          <span className="w-4 tabular-nums">{count}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
                <ul className="flex flex-col divide-y">
                  {[...reviews]
                    // Pending ones first: they need a decision.
                    .sort((a, b) => Number(b.status === "PENDING") - Number(a.status === "PENDING") || b.createdAt.localeCompare(a.createdAt))
                    .slice(0, allReviews ? undefined : 4)
                    .map((r) => {
                      const author = [r.user?.firstName, r.user?.lastName].filter(Boolean).join(" ") || "Anonymous"
                      return (
                      <li key={r.id} className={cn("flex gap-3 py-3 first:pt-0 last:pb-0", r.status === "PENDING" && "-mx-2 rounded-lg bg-amber-500/6 px-2 first:pt-3")}>
                        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold text-muted-foreground uppercase">
                          {author.split(" ").map((w) => w[0]).join("").slice(0, 2)}
                        </span>
                        <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="text-sm font-medium">{author}</span>
                          {r.isVerifiedPurchase && (
                            <span className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400">
                              <BadgeCheckIcon className="size-3.5" /> Verified buyer
                            </span>
                          )}
                          {r.status !== "APPROVED" && <Pill tone={REVIEW_TONE[r.status]}>{r.status === "PENDING" ? "Pending" : "Hidden"}</Pill>}
                          <span className="ml-auto text-xs text-muted-foreground">{fmtDate(r.createdAt)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Stars rating={r.rating} />
                          {r.title && <p className="text-sm font-medium">{r.title}</p>}
                        </div>
                        {r.body && <p className="text-sm text-muted-foreground">{r.body}</p>}
                        {r.status === "PENDING" && (
                          <div className="mt-1 flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => moderate(r, "APPROVED")} disabled={busy}>
                              <CheckIcon />
                              Approve
                            </Button>
                            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => moderate(r, "REJECTED")} disabled={busy}>
                              Reject
                            </Button>
                          </div>
                        )}
                        </div>
                      </li>
                      )
                    })}
                </ul>
                <ShowAll open={allReviews} total={reviews.length} shown={4} onToggle={() => setAllReviews(!allReviews)} />
              </div>
            )}
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-4 md:gap-6">
          <Card title="Media" action={<span className="text-xs text-muted-foreground">{imageIndex + 1} of {images.length}{image?.isPrimary && " · main"}</span>}>
            <div className="flex flex-col gap-2 px-4 pb-4">
              <div className="grid aspect-square place-items-center overflow-hidden rounded-xl bg-muted/60 text-muted-foreground">
                {image ? (
                  // eslint-disable-next-line @next/next/no-img-element -- any image host is allowed
                  <img src={image.url} alt={image.altText ?? ""} className="size-full object-contain" />
                ) : (
                  <PackageIcon className="size-8" />
                )}
              </div>
              {images.length > 1 && (
                <div className="grid grid-cols-6 gap-2">
                  {images.map((img, index) => (
                    <button
                      key={img.id}
                      type="button"
                      onClick={() => setImageIndex(index)}
                      className={cn(
                        "aspect-square overflow-hidden rounded-lg border bg-muted/60",
                        index === imageIndex && "ring-2 ring-primary ring-offset-1 ring-offset-card"
                      )}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- any image host is allowed */}
                      <img src={img.url} alt={img.altText ?? ""} className="size-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Card>

          <Card title="Listing health" action={<Pill tone={passed === checks.length ? "green" : "amber"}>{passed} of {checks.length}</Pill>}>
            <div className="px-4 pb-4">
              <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn("h-full rounded-full", passed === checks.length ? "bg-emerald-600" : "bg-amber-500")}
                  style={{ width: `${(passed / checks.length) * 100}%` }}
                />
              </div>
              <ul className="flex flex-col gap-2 text-sm">
                {checks.map((c) => (
                  <li key={c.text} className="flex items-start gap-2">
                    {c.ok ? (
                      <CheckIcon className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                    ) : (
                      <CircleDashedIcon className="mt-0.5 size-4 shrink-0 text-amber-600" />
                    )}
                    <span className="min-w-0">
                      <span className={cn(!c.ok && "font-medium")}>{c.text}</span>
                      <span className="block text-xs text-muted-foreground">{c.detail}</span>
                    </span>
                  </li>
                ))}
              </ul>
              {passed < checks.length && (
                <Button variant="outline" size="sm" className="mt-3 w-full" nativeButton={false} render={<Link href={`/products/${product.id}/edit`} />}>
                  <PencilIcon />
                  Fix in Edit product
                </Button>
              )}
            </div>
          </Card>

          <Card title="Description">
            <div className="flex flex-col gap-2 px-4 pb-4 text-sm">
              {product.shortDescription && <p className="font-medium">{product.shortDescription}</p>}
              {product.description && product.description !== product.shortDescription && (
                <p className="whitespace-pre-line text-muted-foreground">{product.description}</p>
              )}
              {!product.shortDescription && !product.description && <p className="text-muted-foreground">No description.</p>}
            </div>
          </Card>

          <Card title="Organisation">
            <dl className="flex flex-col gap-3 px-4 pb-4 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Brand</dt>
                <dd className="mt-1">{product.brand?.name ?? "No brand"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Categories</dt>
                <dd className="mt-1 flex flex-wrap gap-1">
                  {product.categories.length === 0 && <span className="text-muted-foreground">None</span>}
                  {product.categories.map((c) => (
                    <span key={c.category.id} className="rounded-md bg-muted px-2 py-0.5 text-xs">
                      {c.category.name}
                      {c.isPrimary && <span className="text-muted-foreground"> · primary</span>}
                    </span>
                  ))}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Tags</dt>
                <dd className="mt-1 flex flex-wrap gap-1">
                  {product.tags.length === 0 && <span className="text-muted-foreground">None</span>}
                  {product.tags.map((t) => (
                    <span key={t.tag.id} className="rounded-md border px-2 py-0.5 text-xs text-muted-foreground">
                      #{t.tag.name}
                    </span>
                  ))}
                </dd>
              </div>
              {product.options.map(({ option }) => {
                const used = new Set(product.variants.flatMap((v) => v.optionValues.filter((o) => o.optionValue.optionId === option.id).map((o) => o.optionValue.value)))
                return (
                  <div key={option.id}>
                    <dt className="text-xs text-muted-foreground">{option.displayName ?? option.name}</dt>
                    <dd className="mt-1 flex flex-wrap gap-1">
                      {[...used].map((value) => (
                        <span key={value} className="rounded-md bg-muted px-2 py-0.5 text-xs">
                          {value}
                        </span>
                      ))}
                    </dd>
                  </div>
                )
              })}
            </dl>
          </Card>

          {promotions.length > 0 && (
            <Card
              title="Promotions"
              action={
                <Link href="/marketing/promotions" className="text-xs font-medium text-primary hover:underline">
                  Manage
                </Link>
              }
            >
              <ul className="flex flex-col gap-2 px-4 pb-4 text-sm">
                {promotions.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
                    <span className="truncate font-medium">{p.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{p.description}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card title="Where it sells" action={<span className="text-xs text-muted-foreground">by units</span>}>
            {topPlaces.length === 0 ? (
              <p className="px-4 pb-4 text-sm text-muted-foreground">No delivery addresses yet.</p>
            ) : (
              <ul className="flex flex-col gap-2.5 px-4 pb-4 text-sm">
                {topPlaces.map((p) => (
                  <li key={p.name}>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate capitalize">{p.name}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        <span className="font-medium text-foreground">{n0(p.units)}</span> {p.units === 1 ? "unit" : "units"} · {n0(p.orders)} {p.orders === 1 ? "order" : "orders"}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${pct(p.units, topPlaces[0].units)}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Bought together" action={<span className="text-xs text-muted-foreground">in the same order</span>}>
            {boughtWith.length === 0 ? (
              <p className="px-4 pb-4 text-sm text-muted-foreground">Always bought on its own so far.</p>
            ) : (
              <ul className="flex flex-col px-4 pb-2">
                {boughtWith.map((t) => (
                  <li key={t.id} className="flex items-center gap-3 border-b py-2 text-sm last:border-b-0">
                    <Link href={`/products/${t.id}`} className="min-w-0 flex-1 truncate font-medium hover:text-primary hover:underline">
                      {t.name}
                    </Link>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {n0(t.orders)} of {n0(sold.length)} orders · {pct(t.orders, sold.length)}%
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Top customers" action={<span className="text-xs text-muted-foreground">by spend</span>}>
            {topBuyers.length === 0 ? (
              <p className="px-4 pb-4 text-sm text-muted-foreground">No sales yet.</p>
            ) : (
              <ul className="flex flex-col px-4 pb-2">
                {topBuyers.map((b) => (
                  <li key={b.email} className="flex items-center gap-3 border-b py-2 text-sm last:border-b-0">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary uppercase">{b.name.slice(0, 2)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{b.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {n0(b.units)} {b.units === 1 ? "unit" : "units"} · {n0(b.orders)} {b.orders === 1 ? "order" : "orders"}
                      </span>
                    </span>
                    <span className="font-semibold tabular-nums">{taka(b.spent)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Details">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 px-4 pb-4 text-sm">
              <dt className="text-muted-foreground">Slug</dt>
              <dd className="flex min-w-0 items-center gap-1">
                <span className="truncate font-mono text-xs leading-5">{product.slug}</span>
                <CopyButton text={product.slug} what="Slug" />
              </dd>
              <dt className="text-muted-foreground">Storefront</dt>
              <dd>{product.isActive && product.status === "ACTIVE" ? "Visible" : "Hidden"}</dd>
              <dt className="text-muted-foreground">Created</dt>
              <dd>{fmtDate(product.createdAt)}</dd>
              <dt className="text-muted-foreground">Updated</dt>
              <dd>{fmtDate(product.updatedAt)}</dd>
              <dt className="text-muted-foreground">Last sold</dt>
              <dd>{lastSold ? `${fmtDate(lastSold)} (${rel(lastSold)})` : "Never"}</dd>
              <dt className="text-muted-foreground">Stock moved</dt>
              <dd>{lastMovement ? rel(lastMovement) : "Never"}</dd>
              <dt className="text-muted-foreground">Last review</dt>
              <dd>{lastReview ? fmtDate(lastReview) : "None"}</dd>
              <dt className="text-muted-foreground">ID</dt>
              <dd className="flex min-w-0 items-center gap-1">
                <span className="truncate font-mono text-xs leading-5" title={product.id}>
                  {product.id}
                </span>
                <CopyButton text={product.id} what="Product ID" />
              </dd>
            </dl>
          </Card>
        </div>
      </div>
    </div>
  )
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="flex text-amber-500" aria-label={`${rating} of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <StarIcon key={star} className={cn("size-3.5", star <= rating ? "fill-current" : "text-muted-foreground/40")} />
      ))}
    </span>
  )
}

// The footer of a capped list.
function ShowAll({ open, total, shown, onToggle }: { open: boolean; total: number; shown: number; onToggle: () => void }) {
  if (total <= shown) return null
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center justify-center gap-1 border-t border-border/60 py-2.5 text-xs font-medium text-muted-foreground hover:bg-muted/40 hover:text-foreground"
    >
      {open ? "Show less" : `Show all ${n0(total)}`}
      <ChevronDownIcon className={cn("size-3.5 transition-transform", open && "rotate-180")} />
    </button>
  )
}

function CopyButton({ text, what }: { text: string; what: string }) {
  return (
    <Button
      variant="ghost"
      size="icon-xs"
      className="size-5 shrink-0 text-muted-foreground"
      onClick={() => navigator.clipboard.writeText(text).then(() => toast.success(`${what} copied`))}
      aria-label={`Copy ${what.toLowerCase()}`}
    >
      <CopyIcon className="size-3" />
    </Button>
  )
}
