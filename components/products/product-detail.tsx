"use client"

import Link from "next/link"
import { useState } from "react"
import { toast } from "sonner"
import { ArchiveIcon, ArrowLeftIcon, BadgeCheckIcon, BoxesIcon, CheckIcon, CircleDashedIcon, PackageIcon, PencilIcon, SendIcon, StarIcon } from "lucide-react"

import { changeProductStatus } from "@/app/actions/product.actions"
import { moderateReview } from "@/app/actions/review.actions"
import { Card, fmtDate, fmtDateTime, Kpis, n0, Pill, RackTag, rel, taka, type Tone, WarehouseTag } from "@/components/inventory/inventory-ui"
import { MovementTag } from "@/components/inventory/movements-table"
import { HEALTH_DOT, isSellable, shelfTotals, variantHealth } from "@/components/inventory/product-shelf"
import { ORDER_STATUS_LABEL } from "@/components/orders/orders-table"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { LedgerMovement, VariantStock } from "@/types/inventory.type"
import type { Order } from "@/types/order.type"
import type { ProductDetail } from "@/types/product.type"
import type { Review } from "@/types/review.type"

const STATUS_LABEL = { ACTIVE: "Active", DRAFT: "Draft", ARCHIVED: "Archived" } as const
const REVIEW_TONE: Record<Review["status"], Tone> = { APPROVED: "green", PENDING: "amber", REJECTED: "red" }
// These orders never took the stock, so they don't count as sold.
const NOT_SOLD = ["CANCELLED", "FAILED", "REFUNDED"]

const th = "px-3 py-2 font-medium first:pl-4 last:pr-4"
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
}: {
  product: ProductDetail
  stock: VariantStock[]
  movements: LedgerMovement[]
  orders: Order[]
  reviews: Review[]
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
      quantity: items.reduce((s, i) => s + i.quantity, 0),
      total: items.reduce((s, i) => s + Number(i.totalAmount), 0),
    }
  })
  const sold = orderLines.filter((l) => !NOT_SOLD.includes(l.order.status))
  const unitsSold = sold.reduce((s, l) => s + l.quantity, 0)
  const revenue = sold.reduce((s, l) => s + l.total, 0)

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
          <Card title="Variants" action={<span className="text-xs text-muted-foreground">Price after promotion · stock in sellable warehouses</span>}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className={th}>Variant</th>
                    <th className={cn(th, "text-right")}>Price</th>
                    <th className={cn(th, "text-right")}>On hand</th>
                    <th className={cn(th, "hidden text-right sm:table-cell")}>Held</th>
                    <th className={cn(th, "text-right")}>Sellable</th>
                    <th className={cn(th, "hidden text-right md:table-cell")}>Alert at</th>
                    <th className={cn(th, "hidden text-right lg:table-cell")}>Unit cost</th>
                    <th className={cn(th, "hidden text-right lg:table-cell")}>Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {product.variants.map((v) => {
                    const s = stockById.get(v.id)
                    const name = v.optionValues.map((o) => o.optionValue.value).join(" / ") || "Default"
                    const unitCost = unitCostOf(v.id)
                    const price = Number(v.pricing?.effectivePrice ?? v.price)
                    return (
                      <tr key={v.id} className="border-t border-border/60">
                        <td className={td}>
                          <div className="flex items-center gap-2">
                            <span className={cn("size-2 shrink-0 rounded-full", HEALTH_DOT[s ? variantHealth(s) : "none"])} aria-hidden />
                            <span className="font-medium">{name}</span>
                            {!v.isActive && <Pill tone="grey">Hidden</Pill>}
                          </div>
                          <div className="pl-4 font-mono text-[11.5px] text-muted-foreground">{v.sku}</div>
                          {s && s.levels.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1 pl-4">
                              {s.levels.map((l) => (
                                <WarehouseTag key={l.warehouseId} code={l.warehouse.code} count={l.available} tone={l.available <= 0 ? "bad" : undefined} />
                              ))}
                            </div>
                          )}
                        </td>
                        <td className={cn(td, "text-right tabular-nums")}>
                          <div className="font-medium">{taka(Number(v.pricing?.effectivePrice ?? v.price))}</div>
                          {v.pricing?.hasPromotion && <div className="text-xs text-muted-foreground line-through">{taka(Number(v.price))}</div>}
                        </td>
                        <td className={cn(td, "text-right text-muted-foreground tabular-nums")}>{n0(s?.onHand ?? 0)}</td>
                        <td className={cn(td, "hidden text-right text-muted-foreground tabular-nums sm:table-cell")}>{n0(s?.reserved ?? 0)}</td>
                        <td className={cn(td, "text-right font-semibold tabular-nums")}>{n0(s?.stock ?? 0)}</td>
                        <td className={cn(td, "hidden text-right text-muted-foreground tabular-nums md:table-cell")}>{n0(v.lowStockThreshold)}</td>
                        <td className={cn(td, "hidden text-right text-muted-foreground tabular-nums lg:table-cell")}>
                          {unitCost > 0 ? taka(unitCost, 2) : "—"}
                        </td>
                        <td className={cn(td, "hidden text-right tabular-nums lg:table-cell")}>
                          {unitCost > 0 && price > 0 ? (
                            <span className={cn("font-medium", price - unitCost < 0 && "text-destructive")}>{Math.round(((price - unitCost) / price) * 100)}%</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
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
                          <div className="flex flex-wrap gap-1">
                            {[...w.racks.entries()].map(([code, qty]) => (
                              <RackTag key={code} code={code} title={`${n0(qty)} units`} />
                            ))}
                          </div>
                        </td>
                        <td className={cn(td, "text-right text-muted-foreground tabular-nums")}>{n0(w.onHand)}</td>
                        <td className={cn(td, "hidden text-right text-muted-foreground tabular-nums sm:table-cell")}>{n0(w.reserved)}</td>
                        <td className={cn(td, "text-right font-semibold tabular-nums")}>{n0(w.available)}</td>
                        <td className={cn(td, "hidden text-right text-muted-foreground tabular-nums sm:table-cell")}>{taka(w.value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card title="Orders" action={<span className="text-xs text-muted-foreground">{orders.length} with this product</span>}>
            {orders.length === 0 ? (
              <p className="px-4 pb-4 text-sm text-muted-foreground">Nobody has ordered this product yet.</p>
            ) : (
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
                    {orderLines.slice(0, 10).map(({ order, items, total }) => (
                      <tr key={order.id} className="border-t border-border/60">
                        <td className={td}>
                          <div className="font-medium whitespace-nowrap">{order.orderNumber}</div>
                          <div className="text-xs text-muted-foreground">{fmtDate(order.placedAt ?? order.createdAt)}</div>
                        </td>
                        <td className={cn(td, "hidden max-w-56 md:table-cell")}>
                          <div className="truncate">{order.customerName ?? order.customerEmail}</div>
                          {order.customerName && <div className="truncate text-xs text-muted-foreground">{order.customerEmail}</div>}
                        </td>
                        <td className={cn(td, "hidden text-muted-foreground sm:table-cell")}>
                          {items.map((i) => (
                            <div key={i.id} className="text-xs whitespace-nowrap">
                              {i.quantity} × {i.variantName && i.variantName !== i.sku ? i.variantName : "Default"}
                            </div>
                          ))}
                        </td>
                        <td className={td}>
                          <StatusBadge status={ORDER_STATUS_LABEL[order.status]} />
                        </td>
                        <td className={cn(td, "text-right tabular-nums")}>{taka(total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
                    {movements.map((m) => {
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
                          <td className={cn(td, "hidden text-muted-foreground sm:table-cell")}>{m.inventoryLevel.warehouse.code}</td>
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
                    <div className="text-xs text-muted-foreground">{approved.length} approved</div>
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
                    .slice(0, 6)
                    .map((r) => (
                      <li key={r.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
                        <div className="flex items-center gap-2">
                          <span className="flex text-amber-500" aria-label={`${r.rating} of 5 stars`}>
                            {[1, 2, 3, 4, 5].map((star) => (
                              <StarIcon key={star} className={cn("size-3.5", star <= r.rating ? "fill-current" : "text-muted-foreground/40")} />
                            ))}
                          </span>
                          {r.status !== "APPROVED" && <Pill tone={REVIEW_TONE[r.status]}>{r.status === "PENDING" ? "Pending" : "Rejected"}</Pill>}
                          <span className="ml-auto text-xs text-muted-foreground">{fmtDate(r.createdAt)}</span>
                        </div>
                        {r.title && <p className="text-sm font-medium">{r.title}</p>}
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
                        <p className="flex items-center gap-1 text-xs text-muted-foreground">
                          {[r.user?.firstName, r.user?.lastName].filter(Boolean).join(" ") || "Anonymous"}
                          {r.isVerifiedPurchase && (
                            <>
                              <BadgeCheckIcon className="size-3.5 text-emerald-600" /> Verified purchase
                            </>
                          )}
                        </p>
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-4 md:gap-6">
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

          <Card title="Media" action={<span className="text-xs text-muted-foreground">{images.length} images</span>}>
            <div className="flex flex-col gap-2 px-4 pb-4">
              <div className="grid aspect-square place-items-center overflow-hidden rounded-xl border bg-muted/60 text-muted-foreground">
                {image ? (
                  // eslint-disable-next-line @next/next/no-img-element -- any image host is allowed
                  <img src={image.url} alt={image.altText ?? ""} className="size-full object-contain" />
                ) : (
                  <PackageIcon className="size-8" />
                )}
              </div>
              {images.length > 1 && (
                <div className="grid grid-cols-5 gap-2">
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
              <dd className="truncate font-mono text-xs leading-5">{product.slug}</dd>
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
              <dd className="truncate font-mono text-xs leading-5" title={product.id}>
                {product.id}
              </dd>
            </dl>
          </Card>
        </div>
      </div>
    </div>
  )
}
