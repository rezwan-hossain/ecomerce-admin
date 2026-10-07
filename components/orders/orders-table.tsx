"use client"

import { ListTable, type ListColumn, type ListFilter } from "@/components/list-table"
import { StatCards } from "@/components/stat-cards"
import { StatusBadge } from "@/components/status-badge"
import { Badge } from "@/components/ui/badge"
import type { Order, OrderStatus, PaymentStatus } from "@/types/order.type"

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

const PAYMENT_LABEL: Record<PaymentStatus, string> = {
  PENDING: "Pending",
  PROCESSING: "Processing",
  PAID: "Paid",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
  PARTIALLY_REFUNDED: "Partly refunded",
}

// Placed but not shipped yet.
const UNFULFILLED: OrderStatus[] = ["PENDING", "CONFIRMED", "PROCESSING", "READY_TO_SHIP"]

const isPaid = (o: Order) => o.payments.some((p) => p.status === "PAID")

const taka = (n: number) => `৳${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })

const itemCount = (o: Order) => o.items.reduce((sum, item) => sum + item.quantity, 0)

const allFilters: ListFilter<Order>[] = [
  { label: "All", value: "all", match: () => true },
  { label: "Unfulfilled", value: "unfulfilled", match: (o) => UNFULFILLED.includes(o.status) },
  { label: "Shipped", value: "shipped", match: (o) => o.status === "SHIPPED" },
  {
    label: "Delivered",
    value: "delivered",
    match: (o) => o.status === "DELIVERED" || o.status === "COMPLETED",
  },
  {
    label: "Cancelled",
    value: "cancelled",
    match: (o) => o.status === "CANCELLED" || o.status === "FAILED" || o.status === "REFUNDED",
  },
]

const pendingFilters: ListFilter<Order>[] = [
  { label: "All Pending", value: "all", match: () => true },
  { label: "Awaiting Payment", value: "unpaid", match: (o) => !isPaid(o) },
  { label: "Ready to Ship", value: "ready", match: isPaid },
]

function Payment({ order }: { order: Order }) {
  // The newest payment attempt says where the order stands; a paid one wins.
  const payment = order.payments.find((p) => p.status === "PAID") ?? order.payments.at(-1)
  if (!payment) return <Badge variant="outline">Unpaid</Badge>

  return (
    <div className="flex items-center gap-1.5">
      <Badge variant={payment.status === "PAID" ? "secondary" : "outline"}>{PAYMENT_LABEL[payment.status]}</Badge>
      <span className="text-xs text-muted-foreground">{payment.provider}</span>
    </div>
  )
}

export function OrdersTable({ orders, mode = "all" }: { orders: Order[]; mode?: "all" | "pending" }) {
  const columns: ListColumn<Order>[] = [
    { key: "order", header: "Order", cell: (o) => <span className="font-medium">{o.orderNumber}</span> },
    { key: "date", header: "Date", cell: (o) => formatDate(o.placedAt ?? o.createdAt) },
    {
      key: "customer",
      header: "Customer",
      cell: (o) => (
        <div className="flex min-w-0 flex-col">
          <span className="truncate">{o.customerName ?? o.customerEmail}</span>
          {o.customerName && <span className="truncate text-xs text-muted-foreground">{o.customerEmail}</span>}
        </div>
      ),
    },
    {
      key: "items",
      header: "Items",
      className: "hidden md:table-cell",
      cell: (o) => {
        const first = o.items[0]
        if (!first) return <span className="text-muted-foreground">No items</span>
        return (
          <span className="text-muted-foreground">
            {first.productName}
            {o.items.length > 1 && ` +${o.items.length - 1} more`} · {itemCount(o)} {itemCount(o) === 1 ? "item" : "items"}
          </span>
        )
      },
    },
    { key: "payment", header: "Payment", cell: (o) => <Payment order={o} /> },
    { key: "status", header: "Status", cell: (o) => <StatusBadge status={ORDER_STATUS_LABEL[o.status]} /> },
    {
      key: "total",
      header: "Total",
      className: "text-right tabular-nums",
      cell: (o) => taka(Number(o.totalAmount)),
    },
  ]

  const revenue = orders.filter(isPaid).reduce((sum, o) => sum + Number(o.totalAmount), 0)

  return (
    <>
      {mode === "all" && (
        <StatCards
          stats={[
            { label: "Total orders", value: String(orders.length), hint: "All time" },
            { label: "Revenue", value: taka(revenue), hint: "From paid orders" },
            {
              label: "Unfulfilled",
              value: String(orders.filter((o) => UNFULFILLED.includes(o.status)).length),
              hint: "Placed, not shipped yet",
            },
            {
              label: "Delivered",
              value: String(orders.filter((o) => o.status === "DELIVERED" || o.status === "COMPLETED").length),
              hint: "Delivered or completed",
            },
          ]}
        />
      )}
      <ListTable
        rows={orders}
        columns={columns}
        getRowId={(o) => o.id}
        searchText={(o) =>
          `${o.orderNumber} ${o.customerName ?? ""} ${o.customerEmail} ${o.customerPhone ?? ""} ${o.items.map((i) => `${i.productName} ${i.sku}`).join(" ")}`
        }
        searchPlaceholder="Search orders..."
        filters={mode === "pending" ? pendingFilters : allFilters}
        emptyText={mode === "pending" ? "All caught up — no pending orders." : "No orders yet."}
      />
    </>
  )
}
