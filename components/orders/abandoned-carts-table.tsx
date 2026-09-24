"use client"

import * as React from "react"
import { MailIcon } from "lucide-react"
import { toast } from "sonner"

import { ListTable, type ListColumn } from "@/components/list-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { currency, type AbandonedCart } from "@/lib/demo-data"

export function AbandonedCartsTable({ carts: initial }: { carts: AbandonedCart[] }) {
  const [carts, setCarts] = React.useState(initial)

  function sendReminder(cart: AbandonedCart) {
    setCarts((current) =>
      current.map((c) => (c.id === cart.id ? { ...c, reminderSent: true } : c))
    )
    toast.success(`Recovery email sent to ${cart.email}`)
  }

  const columns: ListColumn<AbandonedCart>[] = [
    {
      key: "customer",
      header: "Customer",
      cell: (c) => (
        <div className="flex flex-col">
          <span className="font-medium">{c.customer}</span>
          <span className="text-xs text-muted-foreground">{c.email}</span>
        </div>
      ),
    },
    {
      key: "items",
      header: "Items",
      cell: (c) => (
        <div className="flex flex-wrap gap-1">
          {c.items.map((item) => (
            <Badge key={item} variant="outline">
              {item}
            </Badge>
          ))}
        </div>
      ),
    },
    { key: "lastActive", header: "Last Active", cell: (c) => c.lastActive },
    {
      key: "reminder",
      header: "Reminder",
      cell: (c) =>
        c.reminderSent ? (
          <Badge variant="secondary">Sent</Badge>
        ) : (
          <Badge variant="outline">Not sent</Badge>
        ),
    },
    {
      key: "value",
      header: "Cart Value",
      className: "text-right tabular-nums",
      cell: (c) => currency.format(c.value),
    },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      className: "text-right",
      cell: (c) => (
        <Button
          size="sm"
          variant="outline"
          disabled={c.reminderSent}
          onClick={() => sendReminder(c)}
        >
          <MailIcon data-icon="inline-start" />
          Send reminder
        </Button>
      ),
    },
  ]

  return (
    <ListTable
      rows={carts}
      columns={columns}
      getRowId={(c) => c.id}
      searchText={(c) => `${c.customer} ${c.email} ${c.items.join(" ")}`}
      searchPlaceholder="Search carts..."
    />
  )
}
