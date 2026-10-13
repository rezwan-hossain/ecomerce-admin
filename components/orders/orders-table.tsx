"use client"

import Link from "next/link"
import { useState } from "react"

import { Kpis, label, n0, Pill, rel, taka, type Tone } from "@/components/inventory/inventory-ui"
import { ListTable, type ListColumn, type ListFilter } from "@/components/list-table"
import { StatusBadge } from "@/components/status-badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import type { CourierCarrier, Order, OrderStatus, PaymentStatus } from "@/types/order.type"

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

function Payment({ order }: { order: Order }) {
  // The newest payment attempt says where the order stands; a paid one wins.
  const payment = order.payments.find((p) => p.status === "PAID") ?? order.payments.at(-1)
  if (!payment) return <Pill tone="amber">Unpaid</Pill>
  return (
    <span className="flex flex-col items-start gap-0.5">
      <Pill tone={PAYMENT_TONE[payment.status] ?? "amber"}>{PAYMENT_LABEL[payment.status]}</Pill>
      <span className="text-[11px] text-muted-foreground">{PROVIDER_LABEL[payment.provider]}</span>
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

export function OrdersTable({ orders, mode = "all" }: { orders: Order[]; mode?: "all" | "pending" }) {
  const [sort, setSort] = useState("newest")

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
          <span className="text-[11px] text-muted-foreground" title={new Date(placed(o)).toLocaleString()}>
            {rel(placed(o))}
          </span>
        </Link>
      ),
    },
    {
      key: "customer",
      header: "Customer",
      cell: (o) => (
        <div className="flex min-w-0 flex-col">
          <span className="truncate">{o.customerName ?? o.customerEmail}</span>
          <span className="truncate text-[11px] text-muted-foreground">
            {[o.customerName ? o.customerEmail : o.customerPhone, !o.userId && "Guest"].filter(Boolean).join(" · ")}
          </span>
        </div>
      ),
    },
    {
      key: "items",
      header: "Items",
      className: "hidden lg:table-cell",
      cell: (o) => {
        const first = o.items[0]
        if (!first) return <span className="text-muted-foreground">No items</span>
        return (
          <span className="flex max-w-64 flex-col">
            <span className="truncate">
              {first.productName}
              {o.items.length > 1 && <span className="text-muted-foreground"> +{o.items.length - 1} more</span>}
            </span>
            <span className="text-[11px] text-muted-foreground">
              {n0(itemCount(o))} {itemCount(o) === 1 ? "unit" : "units"}
            </span>
          </span>
        )
      },
    },
    { key: "payment", header: "Payment", cell: (o) => <Payment order={o} /> },
    { key: "fulfilment", header: "Fulfilment", className: "hidden md:table-cell", cell: (o) => <Fulfilment order={o} /> },
    { key: "status", header: "Status", cell: (o) => <StatusBadge status={ORDER_STATUS_LABEL[o.status]} /> },
    {
      key: "total",
      header: "Total",
      className: "text-right tabular-nums",
      cell: (o) => (
        <span className="flex flex-col items-end">
          <span className="font-semibold">{taka(Number(o.totalAmount))}</span>
          {Number(o.discountAmount) > 0 && <span className="text-[11px] text-emerald-700 dark:text-emerald-400">−{taka(Number(o.discountAmount))} off</span>}
        </span>
      ),
    },
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
          `${o.orderNumber} ${o.customerName ?? ""} ${o.customerEmail} ${o.customerPhone ?? ""} ${o.items.map((i) => `${i.productName} ${i.sku}`).join(" ")}`
        }
        searchPlaceholder="Search orders..."
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
    </>
  )
}
