"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { ArrowRightIcon, MapPinIcon, MessageCircleIcon, PackageIcon, PhoneIcon } from "lucide-react"

import { Kpis, label, n0, Pill, rel, taka, type Tone } from "@/components/inventory/inventory-ui"
import { ListTable, type ListColumn, type ListFilter } from "@/components/list-table"
import { getProduct } from "@/app/actions/product.actions"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import type { CourierCarrier, Order, OrderAddress, OrderStatus, PaymentStatus } from "@/types/order.type"
import type { ProductDetail } from "@/types/product.type"

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  PROCESSING: "Processing",
  READY_TO_SHIP: "Ready to ship",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  FAILED: "Failed",
  REFUNDED: "Refunded",
}

export const PAYMENT_LABEL: Record<PaymentStatus, string> = {
  PENDING: "Pending",
  PROCESSING: "Processing",
  PAID: "Paid",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
  PARTIALLY_REFUNDED: "Partly refunded",
}

export const CARRIER_LABEL: Record<CourierCarrier, string> = { PATHAO: "Pathao", REDX: "RedX", STEADFAST: "Steadfast", CARRYBEE: "CarryBee" }
export const PROVIDER_LABEL: Record<Order["payments"][number]["provider"], string> = {
  COD: "Cash on delivery",
  BKASH: "bKash",
  NAGAD: "Nagad",
  SSLCOMMERZ: "SSLCommerz",
  STRIPE: "Stripe",
  OTHER: "Other",
}

const PAYMENT_TONE: Partial<Record<PaymentStatus, Tone>> = { PAID: "green", FAILED: "red", CANCELLED: "grey", REFUNDED: "grey", PARTIALLY_REFUNDED: "amber" }

const DAY = 86_400_000
// Placed but not shipped yet.
const UNFULFILLED: OrderStatus[] = ["PENDING", "CONFIRMED", "PROCESSING", "READY_TO_SHIP"]
const STOPPED: OrderStatus[] = ["CANCELLED", "FAILED", "REFUNDED"]

const isPaid = (o: Order) => o.payments.some((p) => p.status === "PAID")
const placed = (o: Order) => o.placedAt ?? o.createdAt
const age = (o: Order) => (Date.now() - new Date(placed(o)).getTime()) / DAY
const itemCount = (o: Order) => o.items.reduce((sum, item) => sum + item.quantity, 0)
// Unpaid and still going: money the store is waiting for (cash on delivery mostly).
const awaitingPayment = (o: Order) => !isPaid(o) && !STOPPED.includes(o.status)

const allFilters: ListFilter<Order>[] = [
  { label: "All", value: "all", match: () => true },
  { label: "Unpaid", value: "unpaid", match: awaitingPayment },
  { label: "Unfulfilled", value: "unfulfilled", match: (o) => UNFULFILLED.includes(o.status) },
  { label: "Shipped", value: "shipped", match: (o) => o.status === "SHIPPED" },
  { label: "Delivered", value: "delivered", match: (o) => o.status === "DELIVERED" || o.status === "COMPLETED" },
  { label: "Cancelled", value: "cancelled", match: (o) => STOPPED.includes(o.status) },
]

const pendingFilters: ListFilter<Order>[] = [
  { label: "All pending", value: "all", match: () => true },
  { label: "To confirm", value: "confirm", match: (o) => o.status === "PENDING" },
  { label: "Packing", value: "packing", match: (o) => o.status === "CONFIRMED" || o.status === "PROCESSING" },
  { label: "Ready to ship", value: "ready", match: (o) => o.status === "READY_TO_SHIP" },
  { label: "Unpaid", value: "unpaid", match: (o) => !isPaid(o) },
]

const SORTS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "total", label: "Highest total" },
]

// Total, then where the money stands: the latest payment attempt (a paid one wins) and what's still owed.
function Amount({ order }: { order: Order }) {
  const payment = order.payments.find((p) => p.status === "PAID") ?? order.payments.at(-1)
  const paid = order.payments.filter((p) => p.status === "PAID").reduce((s, p) => s + Number(p.amount), 0)
  const due = Number(order.totalAmount) - paid
  return (
    <span className="flex flex-col items-end gap-1">
      <span className="text-[17px] font-bold tracking-tight">{taka(Number(order.totalAmount))}</span>
      {payment ? <Pill tone={PAYMENT_TONE[payment.status] ?? "amber"}>{PAYMENT_LABEL[payment.status]}</Pill> : <Pill tone="amber">Unpaid</Pill>}
      {payment && <span className="text-[11px] whitespace-nowrap text-muted-foreground">{PROVIDER_LABEL[payment.provider]}</span>}
      {due > 0 && !STOPPED.includes(order.status) && (
        <span className="text-[11px] font-medium whitespace-nowrap text-amber-700 dark:text-amber-400">{taka(due)} due</span>
      )}
      {Number(order.discountAmount) > 0 && <span className="text-[11px] whitespace-nowrap text-emerald-700 dark:text-emerald-400">−{taka(Number(order.discountAmount))} off</span>}
    </span>
  )
}

function Fulfilment({ order }: { order: Order }) {
  const shipment = order.shipments.at(-1)
  if (shipment) {
    return (
      <span className="flex flex-col">
        <span className="font-medium">{CARRIER_LABEL[shipment.carrier] ?? shipment.carrier}</span>
        <span className="text-[11px] text-muted-foreground">{label(shipment.status)}</span>
      </span>
    )
  }
  if (STOPPED.includes(order.status)) return <span className="text-muted-foreground">—</span>
  if (UNFULFILLED.includes(order.status)) {
    // Over two days without a parcel is worth a look.
    return <span className={cn("text-xs", age(order) > 2 ? "font-medium text-amber-700 dark:text-amber-400" : "text-muted-foreground")}>Not shipped</span>
  }
  return <span className="text-xs text-muted-foreground">No parcel recorded</span>
}

// One customer across orders: the phone's last 10 digits, else the email (guests have no account id).
const customerKey = (o: Order) => o.customerPhone?.replace(/\D/g, "").slice(-10) || o.customerEmail.toLowerCase()

// "01911087109" style for display, and the international number WhatsApp links need.
const localPhone = (phone: string) => `0${phone.replace(/\D/g, "").slice(-10)}`
const whatsApp = (phone: string) => `https://wa.me/880${phone.replace(/\D/g, "").slice(-10)}`

// "11 Oct 2026 · 7:16 PM"
const placedAt = (iso: string) => {
  const d = new Date(iso)
  return `${d.getDate()} ${d.toLocaleString("en-US", { month: "short" })} ${d.getFullYear()} · ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`
}

const FINISHED: OrderStatus[] = ["DELIVERED", "COMPLETED", "CANCELLED", "FAILED", "REFUNDED"]

export function OrdersTable({
  orders,
  history = orders,
  addresses,
  images,
  mode = "all",
}: {
  orders: Order[]
  history?: Order[] // every order, for each customer's track record
  addresses: Record<string, OrderAddress>
  images: Record<string, string> // product id → primary image
  mode?: "all" | "pending"
}) {
  const [sort, setSort] = useState("newest")
  const [viewing, setViewing] = useState<Order | null>(null)

  // Order count and delivery success per customer: delivered out of the orders that finished.
  const customers = new Map<string, { orders: number; finished: number; delivered: number }>()
  for (const o of history) {
    const c = customers.get(customerKey(o)) ?? { orders: 0, finished: 0, delivered: 0 }
    c.orders += 1
    if (FINISHED.includes(o.status)) c.finished += 1
    if (o.status === "DELIVERED" || o.status === "COMPLETED") c.delivered += 1
    customers.set(customerKey(o), c)
  }

  const sorted = [...orders].sort((a, b) => {
    if (sort === "oldest") return placed(a).localeCompare(placed(b))
    if (sort === "total") return Number(b.totalAmount) - Number(a.totalAmount)
    return placed(b).localeCompare(placed(a))
  })

  const columns: ListColumn<Order>[] = [
    {
      key: "order",
      header: "Order",
      cell: (o) => (
        <Link href={`/orders/${o.id}`} className="group flex flex-col">
          <span className="font-medium whitespace-nowrap group-hover:text-primary group-hover:underline">{o.orderNumber}</span>
          <span className="text-[11px] whitespace-nowrap text-muted-foreground tabular-nums">{placedAt(placed(o))}</span>
          <span className="text-[11px] text-muted-foreground">{rel(placed(o))}</span>
        </Link>
      ),
    },
    {
      key: "customer",
      header: "Customer",
      cell: (o) => {
        const c = customers.get(customerKey(o))!
        const address = addresses[o.id]
        const rate = c.finished ? Math.round((c.delivered / c.finished) * 100) : null
        let rateTone = "text-emerald-700 dark:text-emerald-400"
        if (rate !== null && rate < 80) rateTone = "text-amber-700 dark:text-amber-400"
        if (rate !== null && rate < 50) rateTone = "text-destructive"
        return (
          <div className="flex w-56 flex-col gap-0.5 whitespace-normal">
            <span className="flex items-center gap-1.5">
              <span className="truncate font-medium">{o.customerName ?? o.customerEmail}</span>
              <span className="shrink-0 rounded bg-muted px-1 text-[10px] font-semibold text-muted-foreground uppercase">{o.userId ? "Account" : "Guest"}</span>
            </span>
            {o.customerPhone && (
              <span className="flex items-center gap-1.5 text-xs">
                <span className="font-mono tabular-nums">{localPhone(o.customerPhone)}</span>
                <a href={`tel:${o.customerPhone}`} aria-label={`Call ${o.customerPhone}`} className="grid size-5 place-items-center rounded-full bg-muted text-muted-foreground hover:text-foreground">
                  <PhoneIcon className="size-3" />
                </a>
                <a href={whatsApp(o.customerPhone)} target="_blank" rel="noreferrer" aria-label={`WhatsApp ${o.customerPhone}`} className="grid size-5 place-items-center rounded-full bg-emerald-600 text-white hover:bg-emerald-700">
                  <MessageCircleIcon className="size-3" />
                </a>
              </span>
            )}
            <span className="text-[11px] text-muted-foreground">
              {c.orders} {c.orders === 1 ? "order" : "orders"}
              {rate !== null && (
                <>
                  {" · "}
                  <span className={cn("font-semibold", rateTone)} title={`${c.delivered} of ${c.finished} finished orders delivered`}>
                    {rate}% delivered
                  </span>
                </>
              )}
            </span>
            {address && (
              <span className="flex items-start gap-1 text-[11px] text-muted-foreground" title={o.customerEmail}>
                <MapPinIcon className="mt-px size-3 shrink-0" />
                <span className="line-clamp-2">
                  {[address.addressLine1, address.addressLine2, address.city, address.state, address.postalCode].filter(Boolean).join(", ")}
                </span>
              </span>
            )}
          </div>
        )
      },
    },
    {
      key: "items",
      header: "Items",
      className: "hidden lg:table-cell",
      cell: (o) => {
        const first = o.items[0]
        if (!first) return <span className="text-muted-foreground">No items</span>
        return (
          <span className="flex max-w-48 items-center gap-3 xl:max-w-56">
            <button
              type="button"
              onClick={() => setViewing(o)}
              aria-label={`See the ${o.items.length === 1 ? "item" : `${o.items.length} items`} in ${o.orderNumber}`}
              className="relative shrink-0 cursor-zoom-in rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <span className="grid size-11 place-items-center overflow-hidden rounded-lg border bg-muted transition-shadow hover:ring-2 hover:ring-primary/40">
                {first.productId && images[first.productId] ? (
                  // eslint-disable-next-line @next/next/no-img-element -- any image host is allowed
                  <img src={images[first.productId]} alt={first.productName} className="size-full object-cover" />
                ) : (
                  <PackageIcon className="size-4 text-muted-foreground" />
                )}
              </span>
              {o.items.length > 1 && (
                <span className="absolute -right-1.5 -bottom-1.5 rounded-full border-2 border-card bg-foreground px-1.5 text-[10px] leading-4 font-semibold text-background">
                  +{o.items.length - 1}
                </span>
              )}
            </button>
            <span className="flex min-w-0 flex-col">
              <span className="truncate">
                {first.productName}
                {o.items.length > 1 && <span className="text-muted-foreground"> +{o.items.length - 1} more</span>}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {n0(itemCount(o))} {itemCount(o) === 1 ? "unit" : "units"}
              </span>
            </span>
          </span>
        )
      },
    },
    { key: "fulfilment", header: "Fulfilment", className: "hidden md:table-cell", cell: (o) => <Fulfilment order={o} /> },
    { key: "status", header: "Status", cell: (o) => <StatusBadge status={ORDER_STATUS_LABEL[o.status]} /> },
    { key: "amount", header: "Amount", className: "text-right tabular-nums", cell: (o) => <Amount order={o} /> },
  ]

  const kept = orders.filter((o) => !STOPPED.includes(o.status))
  const revenue = orders.filter(isPaid).reduce((sum, o) => sum + Number(o.totalAmount), 0)
  const unpaid = orders.filter(awaitingPayment)
  const unfulfilled = orders.filter((o) => UNFULFILLED.includes(o.status))
  const late = unfulfilled.filter((o) => age(o) > 2)
  const oldest = [...unfulfilled].sort((a, b) => placed(a).localeCompare(placed(b)))[0]

  return (
    <>
      {mode === "all" ? (
        <Kpis
          items={[
            {
              label: "Orders",
              value: n0(orders.length),
              hint: `${n0(orders.filter((o) => age(o) < 1).length)} today · ${n0(orders.filter((o) => age(o) < 7).length)} this week`,
            },
            { label: "Revenue", value: taka(revenue), hint: `paid · avg ${taka(kept.length ? kept.reduce((s, o) => s + Number(o.totalAmount), 0) / kept.length : 0)} an order` },
            {
              label: "Awaiting payment",
              value: taka(unpaid.reduce((s, o) => s + Number(o.totalAmount), 0)),
              hint: unpaid.length ? `${n0(unpaid.length)} ${unpaid.length === 1 ? "order" : "orders"}, mostly cash on delivery` : "nothing outstanding",
            },
            { label: "To fulfil", value: n0(unfulfilled.length), hint: late.length ? `${n0(late.length)} waiting over 2 days` : "nothing late", warn: late.length > 0 },
            { label: "Shipped", value: n0(orders.filter((o) => o.status === "SHIPPED").length), hint: "on the way to customers" },
            {
              label: "Cancelled",
              value: n0(orders.length - kept.length),
              hint: orders.length ? `${Math.round(((orders.length - kept.length) / orders.length) * 100)}% of orders` : "none yet",
            },
          ]}
        />
      ) : (
        <Kpis
          items={[
            { label: "Pending", value: n0(orders.length), hint: `${taka(orders.reduce((s, o) => s + Number(o.totalAmount), 0))} in value` },
            { label: "To confirm", value: n0(orders.filter((o) => o.status === "PENDING").length), hint: "new, not confirmed yet" },
            { label: "Packing", value: n0(orders.filter((o) => o.status === "CONFIRMED" || o.status === "PROCESSING").length), hint: "confirmed or processing" },
            { label: "Ready to ship", value: n0(orders.filter((o) => o.status === "READY_TO_SHIP").length), hint: "waiting for the courier" },
            { label: "Unpaid", value: n0(orders.filter((o) => !isPaid(o)).length), hint: "pay on delivery or not paid yet" },
            { label: "Oldest waiting", value: oldest ? rel(placed(oldest)).replace(" ago", "") : "—", hint: oldest?.orderNumber ?? "nothing waiting", warn: late.length > 0 },
          ]}
        />
      )}
      <ListTable
        rows={sorted}
        columns={columns}
        getRowId={(o) => o.id}
        searchText={(o) =>
          `${o.orderNumber} ${o.customerName ?? ""} ${o.customerEmail} ${o.customerPhone ?? ""} ${o.customerPhone ? localPhone(o.customerPhone) : ""} ${Object.values(addresses[o.id] ?? {}).join(" ")} ${o.items.map((i) => `${i.productName} ${i.sku}`).join(" ")}`
        }
        searchPlaceholder="Order, customer, phone, address..."
        filters={mode === "pending" ? pendingFilters : allFilters}
        emptyText={mode === "pending" ? "All caught up — no pending orders." : "No orders yet."}
        toolbar={
          <Select value={sort} items={SORTS} onValueChange={(v) => setSort(v as string)}>
            <SelectTrigger size="sm" aria-label="Sort orders" className="hidden w-36 sm:flex"><SelectValue /></SelectTrigger>
            <SelectContent>
              {SORTS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        }
      />
      {viewing && <ItemsDialog key={viewing.id} order={viewing} images={images} onClose={() => setViewing(null)} />}
    </>
  )
}

// Order items only keep the variant's text ("M", "Red / 42"), so the products are fetched to name each option.
function ItemsDialog({ order, images, onClose }: { order: Order; images: Record<string, string>; onClose: () => void }) {
  const [products, setProducts] = useState<Record<string, ProductDetail>>({})
  const units = itemCount(order)

  useEffect(() => {
    let stale = false
    const ids = [...new Set(order.items.map((i) => i.productId).filter((id): id is string => !!id))]
    Promise.all(ids.map((id) => getProduct(id))).then((results) => {
      if (stale) return
      const found: Record<string, ProductDetail> = {}
      for (const r of results) if (r.success) found[r.data.id] = r.data
      setProducts(found)
    })
    return () => {
      stale = true
    }
  }, [order])

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="gap-0 p-0 sm:max-w-xl">
        <DialogHeader className="border-b px-5 pt-5 pb-4">
          <DialogTitle className="text-base">
            {order.items.length} {order.items.length === 1 ? "item" : "items"} · {n0(units)} {units === 1 ? "unit" : "units"}
          </DialogTitle>
          <DialogDescription>
            {order.orderNumber} · {order.customerName ?? order.customerEmail} · {placedAt(placed(order))}
          </DialogDescription>
        </DialogHeader>

        <ul className="max-h-[60vh] divide-y overflow-y-auto">
          {order.items.map((item) => {
            const product = item.productId ? products[item.productId] : undefined
            const variant = product?.variants.find((v) => v.id === item.variantId)
            const optionName = (optionId: string) => {
              const option = product?.options.find((o) => o.option.id === optionId)?.option
              return option?.displayName ?? option?.name ?? "Option"
            }
            let options = (variant?.optionValues ?? []).map((ov) => ({ name: optionName(ov.optionValue.optionId), value: ov.optionValue.value }))
            // Until the product loads (or if it's gone), fall back to the snapshot's text.
            if (options.length === 0 && item.variantName && item.variantName !== "None" && item.variantName !== item.sku) {
              options = [{ name: "Variant", value: item.variantName }]
            }
            const src = variant?.images[0]?.url ?? (item.productId ? images[item.productId] : undefined)
            return (
              <li key={item.id} className="flex gap-4 px-5 py-4">
                <span className="grid size-24 shrink-0 place-items-center overflow-hidden rounded-xl border bg-muted">
                  {src ? (
                    // eslint-disable-next-line @next/next/no-img-element -- any image host is allowed
                    <img src={src} alt={item.productName} className="size-full object-cover" />
                  ) : (
                    <PackageIcon className="size-6 text-muted-foreground" />
                  )}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  {item.productId ? (
                    <Link href={`/products/${item.productId}`} className="font-medium hover:text-primary hover:underline">
                      {item.productName}
                    </Link>
                  ) : (
                    <span className="font-medium">{item.productName}</span>
                  )}
                  {options.length > 0 && (
                    <span className="flex flex-wrap gap-1.5">
                      {options.map((opt) => (
                        <span key={opt.name} className="inline-flex items-center gap-1 rounded-md border bg-muted/50 px-2 py-0.5 text-xs">
                          <span className="text-muted-foreground">{opt.name}</span>
                          <b className="font-semibold">{opt.value}</b>
                        </span>
                      ))}
                    </span>
                  )}
                  <span className="font-mono text-[11px] text-muted-foreground">{item.sku}</span>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1 text-right tabular-nums">
                  <span className="font-semibold">{taka(Number(item.totalAmount))}</span>
                  <span className="text-xs text-muted-foreground">
                    {n0(item.quantity)} × {taka(Number(item.unitPrice))}
                  </span>
                  {item.quantity > 1 && <span className="rounded-full bg-primary/10 px-2 text-[11px] font-semibold text-primary">Qty {item.quantity}</span>}
                </div>
              </li>
            )
          })}
        </ul>

        <dl className="grid gap-1 border-t bg-muted/30 px-5 py-3 text-sm tabular-nums">
          <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd>{taka(Number(order.subtotalAmount))}</dd></div>
          {Number(order.discountAmount) > 0 && (
            <div className="flex justify-between"><dt className="text-muted-foreground">Discount</dt><dd className="text-emerald-700 dark:text-emerald-400">−{taka(Number(order.discountAmount))}</dd></div>
          )}
          <div className="flex justify-between"><dt className="text-muted-foreground">Shipping</dt><dd>{Number(order.shippingAmount) ? taka(Number(order.shippingAmount)) : "Free"}</dd></div>
          <div className="flex justify-between font-semibold"><dt>Total</dt><dd>{taka(Number(order.totalAmount))}</dd></div>
        </dl>

        <DialogFooter className="m-0 rounded-b-xl border-t px-5 py-3">
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button nativeButton={false} render={<Link href={`/orders/${order.id}`} />}>
            Open order
            <ArrowRightIcon data-icon="inline-end" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
