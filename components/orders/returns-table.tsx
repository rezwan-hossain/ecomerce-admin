"use client"

import * as React from "react"
import Link from "next/link"
import { toast } from "sonner"

import { ListTable, type ListColumn } from "@/components/list-table"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { currency, formatDate, type ReturnRequest } from "@/lib/demo-data"

export function ReturnsTable({ returns: initial }: { returns: ReturnRequest[] }) {
  const [returns, setReturns] = React.useState(initial)

  function setStatus(id: string, status: ReturnRequest["status"]) {
    setReturns((current) =>
      current.map((r) => (r.id === id ? { ...r, status } : r))
    )
    toast.success(`${id} ${status.toLowerCase()}`)
  }

  const columns: ListColumn<ReturnRequest>[] = [
    { key: "id", header: "Return", cell: (r) => <span className="font-medium">{r.id}</span> },
    {
      key: "order",
      header: "Order",
      cell: (r) => (
        <Link href={`/orders/${r.order.slice(1)}`} className="hover:underline">
          {r.order}
        </Link>
      ),
    },
    { key: "customer", header: "Customer", cell: (r) => r.customer },
    { key: "product", header: "Product", cell: (r) => r.product },
    { key: "reason", header: "Reason", cell: (r) => <span className="text-muted-foreground">{r.reason}</span> },
    { key: "date", header: "Requested", cell: (r) => formatDate(r.date) },
    { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
    {
      key: "amount",
      header: "Amount",
      className: "text-right tabular-nums",
      cell: (r) => currency.format(r.amount),
    },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      className: "text-right",
      cell: (r) => {
        if (r.status === "Requested") {
          return (
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setStatus(r.id, "Rejected")}>
                Reject
              </Button>
              <Button size="sm" onClick={() => setStatus(r.id, "Approved")}>
                Approve
              </Button>
            </div>
          )
        }
        if (r.status === "Approved") {
          return (
            <Button size="sm" onClick={() => setStatus(r.id, "Refunded")}>
              Issue refund
            </Button>
          )
        }
        return null
      },
    },
  ]

  return (
    <ListTable
      rows={returns}
      columns={columns}
      getRowId={(r) => r.id}
      searchText={(r) => `${r.id} ${r.order} ${r.customer} ${r.product}`}
      searchPlaceholder="Search returns..."
      filters={[
        { label: "All", value: "all", match: () => true },
        { label: "Needs Review", value: "requested", match: (r) => r.status === "Requested" },
        { label: "Approved", value: "approved", match: (r) => r.status === "Approved" },
        { label: "Refunded", value: "refunded", match: (r) => r.status === "Refunded" },
      ]}
    />
  )
}
