"use client"

// The Reservations page (demo data; batches are live in batches.tsx).

import { useState } from "react"
import { LockIcon } from "lucide-react"
import { toast } from "sonner"

import { ListTable, type ListColumn } from "@/components/list-table"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DEMO_ITEMS, type DemoReservation } from "@/lib/inventory-demo"

import { ItemSelect, statusFilters, WarehouseSelect, wholeNumber } from "./doc-bits"
import { fmtDateTime, rel, StatusPill, WarehouseTag } from "./inventory-ui"

const HOLD_OPTIONS = [
  { value: "15", label: "15 minutes" },
  { value: "60", label: "1 hour" },
  { value: "1440", label: "1 day" },
  { value: "4320", label: "3 days" },
]

export function Reservations({ initialReservations }: { initialReservations: DemoReservation[] }) {
  const [reservations, setReservations] = useState(initialReservations)
  const [reserving, setReserving] = useState(false)

  const overdue = reservations.filter((r) => r.status === "ACTIVE" && new Date(r.expiresAt).getTime() <= Date.now())

  function setStatus(ids: string[], status: DemoReservation["status"], message: string) {
    setReservations((current) => current.map((r) => (ids.includes(r.id) ? { ...r, status } : r)))
    toast.success(message)
  }

  const columns: ListColumn<DemoReservation>[] = [
    { key: "order", header: "Order", cell: (r) => <span className="font-mono text-xs font-semibold">{r.orderNumber}</span> },
    {
      key: "item",
      header: "Item",
      cell: (r) => (
        <div>
          <div className="font-semibold">{r.name}, {r.variant}</div>
          <div className="font-mono text-xs text-muted-foreground">{r.sku}</div>
        </div>
      ),
    },
    { key: "warehouse", header: "Warehouse", className: "hidden md:table-cell", cell: (r) => <WarehouseTag code={r.warehouse} /> },
    { key: "qty", header: "Qty", className: "text-right tabular-nums", cell: (r) => <span className="text-[15px] font-bold">{r.quantity}</span> },
    { key: "status", header: "Status", cell: (r) => <StatusPill status={r.status} text={r.status === "COMMITTED" ? "Shipped" : undefined} /> },
    { key: "reserved", header: "Reserved", className: "hidden whitespace-nowrap lg:table-cell", cell: (r) => <span className="text-muted-foreground">{fmtDateTime(r.reservedAt)}</span> },
    {
      key: "expires",
      header: "Expires",
      className: "whitespace-nowrap",
      cell: (r) => {
        if (r.status !== "ACTIVE") return <span className="text-muted-foreground">—</span>
        const late = new Date(r.expiresAt).getTime() <= Date.now()
        return <span className={late ? "font-semibold text-destructive" : "text-muted-foreground"}>{late && "Overdue, "}{rel(r.expiresAt)}</span>
      },
    },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      className: "text-right whitespace-nowrap",
      cell: (r) =>
        r.status === "ACTIVE" && (
          <div className="flex justify-end gap-1">
            <Button size="xs" variant="outline" onClick={() => setStatus([r.id], "COMMITTED", "Shipped. The sale is in the ledger.")}>
              Ship
            </Button>
            <Button size="xs" variant="ghost" onClick={() => setStatus([r.id], "RELEASED", "Reservation released")}>
              Release
            </Button>
          </div>
        ),
    },
  ]

  return (
    <>
      {overdue.length > 0 && (
        <div className="mx-4 flex flex-wrap items-center gap-3 rounded-lg bg-amber-50 px-3.5 py-2.5 text-[13px] text-amber-900 lg:mx-6 dark:bg-amber-950 dark:text-amber-200">
          <span>
            {overdue.length} {overdue.length === 1 ? "reservation passed its" : "reservations passed their"} expiry time and still hold stock.
          </span>
          <Button size="sm" variant="outline" onClick={() => setStatus(overdue.map((r) => r.id), "EXPIRED", `Released ${overdue.length} expired holds`)}>
            Release expired holds
          </Button>
        </div>
      )}
      <ListTable
        rows={[...reservations].sort((a, b) => b.reservedAt.localeCompare(a.reservedAt))}
        columns={columns}
        getRowId={(r) => r.id}
        searchText={(r) => `${r.orderNumber} ${r.sku} ${r.name}`}
        searchPlaceholder="Search by order or SKU..."
        filters={statusFilters<DemoReservation>([
          ["Active", ["ACTIVE"]],
          ["Shipped", ["COMMITTED"]],
          ["Released", ["RELEASED"]],
          ["Expired", ["EXPIRED"]],
          ["All", null],
        ])}
        emptyText="No reservations here."
        toolbar={
          <Button size="sm" onClick={() => setReserving(true)}>
            <LockIcon data-icon="inline-start" />
            Reserve stock
          </Button>
        }
      />
      {reserving && (
        <ReserveDialog
          nextOrder={`ORD-${Math.max(0, ...reservations.map((r) => Number(r.orderNumber.split("-")[1]))) + 1}`}
          onReserve={(r) => {
            setReservations((current) => [r, ...current])
            setReserving(false)
            toast.success(`Reserved ${r.quantity} for ${r.orderNumber} at ${r.warehouse}`)
          }}
          onClose={() => setReserving(false)}
        />
      )}
    </>
  )
}

// Simulates a checkout: holds stock for an order until it ships or the hold expires.
function ReserveDialog({ nextOrder, onReserve, onClose }: { nextOrder: string; onReserve: (r: DemoReservation) => void; onClose: () => void }) {
  const [sku, setSku] = useState(DEMO_ITEMS[0].sku)
  const [quantity, setQuantity] = useState("1")
  const [hold, setHold] = useState("60")
  const [warehouse, setWarehouse] = useState("MAIN")

  function submit() {
    if (!wholeNumber(quantity) || Number(quantity) < 1) return toast.error("Reserve at least 1 unit.")
    const now = Date.now()
    onReserve({
      ...DEMO_ITEMS.find((i) => i.sku === sku)!,
      id: crypto.randomUUID(),
      orderNumber: nextOrder,
      warehouse,
      quantity: Number(quantity),
      status: "ACTIVE",
      reservedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + Number(hold) * 60_000).toISOString(),
    })
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reserve stock</DialogTitle>
          <DialogDescription>Simulates a checkout. Stock is held for the order until it ships or the hold expires.</DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel>Item</FieldLabel>
            <ItemSelect value={sku} onChange={setSku} />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field>
              <FieldLabel htmlFor="reserve-qty">Quantity</FieldLabel>
              <Input id="reserve-qty" inputMode="numeric" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </Field>
            <Field>
              <FieldLabel>Hold for</FieldLabel>
              <Select value={hold} items={HOLD_OPTIONS} onValueChange={(v) => setHold(v as string)}>
                <SelectTrigger aria-label="Hold for" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {HOLD_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>From</FieldLabel>
              <WarehouseSelect sellableOnly value={warehouse} onChange={setWarehouse} />
            </Field>
          </div>
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit}>Reserve</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
