"use client"

import * as React from "react"
import Link from "next/link"
import { DownloadIcon, EllipsisVerticalIcon, TruckIcon } from "lucide-react"
import { toast } from "sonner"

import { ListTable, type ListColumn, type ListFilter } from "@/components/list-table"
import { StatusBadge } from "@/components/status-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { currency, formatDate, type Order } from "@/lib/demo-data"

const allFilters: ListFilter<Order>[] = [
  { label: "All", value: "all", match: () => true },
  {
    label: "Unfulfilled",
    value: "unfulfilled",
    match: (o) => o.status === "Pending" || o.status === "Processing",
  },
  { label: "Shipped", value: "shipped", match: (o) => o.status === "Shipped" },
  {
    label: "Delivered",
    value: "delivered",
    match: (o) => o.status === "Delivered",
  },
  {
    label: "Cancelled",
    value: "cancelled",
    match: (o) => o.status === "Cancelled" || o.status === "Refunded",
  },
]

const pendingFilters: ListFilter<Order>[] = [
  { label: "All Pending", value: "all", match: () => true },
  { label: "Awaiting Payment", value: "unpaid", match: (o) => o.payment === "Unpaid" },
  { label: "Ready to Ship", value: "ready", match: (o) => o.payment === "Paid" },
]

export function OrdersTable({
  orders: initialOrders,
  mode = "all",
}: {
  orders: Order[]
  mode?: "all" | "pending"
}) {
  const [orders, setOrders] = React.useState(initialOrders)

  function markShipped(order: Order) {
    setOrders((current) => current.filter((o) => o.id !== order.id))
    toast.success(`Order ${order.order} marked as shipped`)
  }

  const columns: ListColumn<Order>[] = [
    {
      key: "order",
      header: "Order",
      cell: (o) => (
        <Link
          href={`/dashboard/orders/${o.order.slice(1)}`}
          className="font-medium hover:underline"
        >
          {o.order}
        </Link>
      ),
    },
    { key: "date", header: "Date", cell: (o) => formatDate(o.date) },
    { key: "customer", header: "Customer", cell: (o) => o.customer },
    {
      key: "product",
      header: "Items",
      cell: (o) => (
        <span className="text-muted-foreground">
          {o.product} × {o.quantity}
        </span>
      ),
    },
    {
      key: "payment",
      header: "Payment",
      cell: (o) => (
        <Badge variant={o.payment === "Paid" ? "secondary" : "outline"}>
          {o.payment}
        </Badge>
      ),
    },
    { key: "status", header: "Status", cell: (o) => <StatusBadge status={o.status} /> },
    {
      key: "total",
      header: "Total",
      className: "text-right tabular-nums",
      cell: (o) => currency.format(Number(o.total)),
    },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      className: "w-12 text-right",
      cell: (o) =>
        mode === "pending" && o.payment === "Paid" ? (
          <Button size="sm" variant="outline" onClick={() => markShipped(o)}>
            <TruckIcon data-icon="inline-start" />
            Ship
          </Button>
        ) : (
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
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem
                render={<Link href={`/dashboard/orders/${o.order.slice(1)}`} />}
              >
                View order
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => toast.success(`Invoice for ${o.order} sent to printer`)}
              >
                Print invoice
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => toast.success(`Refund issued for ${o.order}`)}
              >
                Refund
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
    },
  ]

  return (
    <ListTable
      rows={orders}
      columns={columns}
      getRowId={(o) => String(o.id)}
      searchText={(o) => `${o.order} ${o.customer} ${o.product}`}
      searchPlaceholder="Search orders..."
      filters={mode === "pending" ? pendingFilters : allFilters}
      emptyText={mode === "pending" ? "All caught up — no pending orders." : undefined}
      toolbar={
        <Button
          variant="outline"
          size="sm"
          onClick={() => toast.success("Orders exported to CSV")}
        >
          <DownloadIcon data-icon="inline-start" />
          Export
        </Button>
      }
    />
  )
}
