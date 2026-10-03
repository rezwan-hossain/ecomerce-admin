"use client"

import { useState } from "react"
import { PlusIcon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"

import { ListTable, type ListColumn } from "@/components/list-table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { DEMO_ITEMS, type DemoPoItem, type DemoPurchaseOrder, type DemoSupplier } from "@/lib/inventory-demo"
import { cn } from "@/lib/utils"

import { cellInput, DocSheet, ItemSelect, Progress, ReceiveDialog, statusFilters, WarehouseSelect, wholeNumber } from "./doc-bits"
import { Card, fmtDate, StatusPill, taka, WarehouseTag } from "./inventory-ui"

const OPEN = ["SUBMITTED", "CONFIRMED", "PARTIAL"]

const remaining = (i: DemoPoItem) => i.orderedQty - i.receivedQty - i.damagedQty
const subtotal = (po: DemoPurchaseOrder) => po.items.reduce((sum, i) => sum + i.orderedQty * i.unitCost, 0)
const total = (po: DemoPurchaseOrder) => subtotal(po) + po.taxAmount + po.shippingAmount
const isLate = (po: DemoPurchaseOrder) => OPEN.includes(po.status) && po.expectedAt !== null && new Date(po.expectedAt).getTime() < Date.now()
const now = () => new Date().toISOString()

function nextNumber(pos: DemoPurchaseOrder[]) {
  const last = Math.max(0, ...pos.map((p) => Number(p.poNumber.split("-").at(-1))))
  return `PO-${new Date().getFullYear()}-${String(last + 1).padStart(5, "0")}`
}

const newLine = (): DemoPoItem => ({ ...DEMO_ITEMS[0], id: crypto.randomUUID(), warehouse: "MAIN", orderedQty: 10, receivedQty: 0, damagedQty: 0, unitCost: 0 })

export function PurchaseOrders({ initialOrders, suppliers }: { initialOrders: DemoPurchaseOrder[]; suppliers: DemoSupplier[] }) {
  const [orders, setOrders] = useState(initialOrders)
  const [openId, setOpenId] = useState<string | null>(null)
  const [draft, setDraft] = useState<DemoPurchaseOrder | null>(null) // a new, unsaved order
  const [receiving, setReceiving] = useState(false)

  const supplierName = (id: string) => suppliers.find((s) => s.id === id)?.name ?? "No supplier"
  const open = draft ?? orders.find((o) => o.id === openId) ?? null

  function save(po: DemoPurchaseOrder, message: string) {
    setOrders((current) => (current.some((o) => o.id === po.id) ? current.map((o) => (o.id === po.id ? po : o)) : [po, ...current]))
    setDraft(null)
    setOpenId(po.id)
    toast.success(message)
  }

  function validate(po: DemoPurchaseOrder) {
    if (!po.supplierId) return "Choose a supplier."
    if (po.items.length === 0) return "Add at least one line."
    if (po.items.some((i) => i.orderedQty < 1)) return "Order at least 1 unit on every line."
    return ""
  }

  function submit(po: DemoPurchaseOrder) {
    const error = validate(po)
    if (error) return toast.error(error)
    save({ ...po, status: "SUBMITTED", orderedAt: now() }, "Order submitted. Its units now count as incoming.")
  }

  function receive(po: DemoPurchaseOrder, counts: Record<string, { good: number; damaged: number }>) {
    const items = po.items.map((i) => ({
      ...i,
      receivedQty: i.receivedQty + (counts[i.id]?.good ?? 0),
      damagedQty: i.damagedQty + (counts[i.id]?.damaged ?? 0),
    }))
    const done = items.every((i) => remaining(i) <= 0)
    save({ ...po, items, status: done ? "RECEIVED" : "PARTIAL" }, done ? "Everything received and put away." : "Received. Some units are still to come.")
    setReceiving(false)
  }

  function remove(po: DemoPurchaseOrder) {
    setOrders((current) => current.filter((o) => o.id !== po.id))
    setOpenId(null)
    toast.success(`${po.poNumber} deleted`)
  }

  const columns: ListColumn<DemoPurchaseOrder>[] = [
    {
      key: "order",
      header: "Order",
      cell: (po) => (
        <button type="button" className="text-left" onClick={() => setOpenId(po.id)}>
          <span className="font-semibold text-primary hover:underline">{po.poNumber}</span>
          {po.fromRule && <span className="block text-xs text-muted-foreground">From a reorder rule</span>}
        </button>
      ),
    },
    { key: "supplier", header: "Supplier", cell: (po) => supplierName(po.supplierId) },
    { key: "status", header: "Status", cell: (po) => <StatusPill status={po.status} /> },
    {
      key: "to",
      header: "Deliver to",
      className: "hidden lg:table-cell",
      cell: (po) => (
        <div className="flex gap-1">
          {[...new Set(po.items.map((i) => i.warehouse))].map((code) => (
            <WarehouseTag key={code} code={code} />
          ))}
        </div>
      ),
    },
    {
      key: "received",
      header: "Received",
      className: "hidden md:table-cell",
      cell: (po) => (
        <Progress
          done={po.items.reduce((s, i) => s + i.receivedQty, 0)}
          damaged={po.items.reduce((s, i) => s + i.damagedQty, 0)}
          total={po.items.reduce((s, i) => s + i.orderedQty, 0)}
        />
      ),
    },
    { key: "total", header: "Total", className: "text-right tabular-nums", cell: (po) => taka(total(po)) },
    { key: "ordered", header: "Ordered", className: "hidden whitespace-nowrap xl:table-cell", cell: (po) => <span className="text-muted-foreground">{(po.orderedAt ? fmtDate(po.orderedAt) : "Not sent")}</span> },
    {
      key: "expected",
      header: "Expected",
      className: "hidden whitespace-nowrap xl:table-cell",
      cell: (po) => <span className={isLate(po) ? "font-semibold text-destructive" : "text-muted-foreground"}>{fmtDate(po.expectedAt)}{isLate(po) && ", late"}</span>,
    },
  ]

  return (
    <>
      <ListTable
        rows={orders}
        columns={columns}
        getRowId={(po) => po.id}
        searchText={(po) => `${po.poNumber} ${supplierName(po.supplierId)} ${po.items.map((i) => i.sku).join(" ")}`}
        searchPlaceholder="Search by number, supplier or SKU..."
        filters={statusFilters<DemoPurchaseOrder>([
          ["Open", ["DRAFT", ...OPEN]],
          ["To receive", OPEN],
          ["Drafts", ["DRAFT"]],
          ["Done", ["RECEIVED", "CLOSED", "CANCELLED"]],
          ["All", null],
        ])}
        emptyText="No purchase orders here."
        toolbar={
          <Button
            size="sm"
            onClick={() =>
              setDraft({
                id: crypto.randomUUID(), poNumber: "", supplierId: "", status: "DRAFT", items: [newLine()], taxAmount: 0, shippingAmount: 0,
                orderedAt: null, expectedAt: null, note: "", fromRule: false, createdBy: "You", createdAt: now(),
              })
            }
          >
            <PlusIcon data-icon="inline-start" />
            New purchase order
          </Button>
        }
      />

      {open && (
        <PoSheet
          key={open.id}
          po={open}
          suppliers={suppliers}
          isNew={draft !== null}
          onClose={() => {
            setDraft(null)
            setOpenId(null)
          }}
          onSave={(po) => save({ ...po, poNumber: open.poNumber || nextNumber(orders) }, "Draft saved")}
          onSubmit={(po) => submit({ ...po, poNumber: open.poNumber || nextNumber(orders) })}
          onStatus={(status, message) => save({ ...open, status }, message)}
          onReceive={() => setReceiving(true)}
          onDelete={() => remove(open)}
        />
      )}
      {receiving && open && (
        <ReceiveDialog
          title={`Receive ${open.poNumber}`}
          description={`From ${supplierName(open.supplierId)}. Good units go into stock; damaged units are recorded but not added.`}
          lines={open.items.filter((i) => remaining(i) > 0).map((i) => ({ id: i.id, label: `${i.name}, ${i.variant} → ${i.warehouse}`, remaining: remaining(i) }))}
          onReceive={(counts) => receive(open, counts)}
          onClose={() => setReceiving(false)}
        />
      )}
    </>
  )
}

function PoSheet({
  po: saved,
  suppliers,
  isNew,
  onClose,
  onSave,
  onSubmit,
  onStatus,
  onReceive,
  onDelete,
}: {
  po: DemoPurchaseOrder
  suppliers: DemoSupplier[]
  isNew: boolean
  onClose: () => void
  onSave: (po: DemoPurchaseOrder) => void
  onSubmit: (po: DemoPurchaseOrder) => void
  onStatus: (status: DemoPurchaseOrder["status"], message: string) => void
  onReceive: () => void
  onDelete: () => void
}) {
  // Local edits only matter while it's a draft; after that the sheet shows the saved order.
  const [edited, setPo] = useState(saved)
  const editing = saved.status === "DRAFT"
  const po = editing ? { ...edited, poNumber: saved.poNumber } : saved
  const supplier = suppliers.find((s) => s.id === po.supplierId)
  const supplierItems = suppliers.filter((s) => s.isActive).map((s) => ({ value: s.id, label: s.name }))

  function updateLine(id: string, patch: Partial<DemoPoItem>) {
    setPo({ ...po, items: po.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) })
  }

  let footer: React.ReactNode
  if (po.status === "DRAFT") {
    footer = (
      <>
        {!isNew && <Button variant="ghost" className="text-destructive" onClick={onDelete}>Delete draft</Button>}
        <span className="flex-1" />
        <Button variant="outline" onClick={() => onSave(po)}>Save draft</Button>
        <Button onClick={() => onSubmit(po)}>Submit to supplier</Button>
      </>
    )
  } else if (OPEN.includes(po.status)) {
    footer = (
      <>
        <Button variant="ghost" className="text-destructive" onClick={() => onStatus(po.status === "PARTIAL" ? "CLOSED" : "CANCELLED", "Order cancelled")}>
          {po.status === "PARTIAL" ? "Cancel the rest" : "Cancel order"}
        </Button>
        <span className="flex-1" />
        {po.status === "SUBMITTED" && <Button variant="outline" onClick={() => onStatus("CONFIRMED", "Marked as confirmed by the supplier")}>Mark confirmed</Button>}
        {po.status === "PARTIAL" && <Button variant="outline" onClick={() => onStatus("CLOSED", "Order closed short")}>Close short</Button>}
        <Button onClick={onReceive}>Receive items</Button>
      </>
    )
  } else if (po.status === "RECEIVED") {
    footer = (
      <>
        <span className="flex-1" />
        <Button onClick={() => onStatus("CLOSED", "Order closed")}>Close order</Button>
      </>
    )
  } else {
    footer = (
      <>
        <span className="flex-1" />
        <Button variant="outline" onClick={onClose}>Done</Button>
      </>
    )
  }

  return (
    <DocSheet kind="Purchase order" title={po.poNumber || "New purchase order"} status={po.status} footer={footer} onClose={onClose}>
      <section className="flex flex-wrap gap-x-7 gap-y-3 rounded-xl border bg-card px-4 py-3.5">
        <div className="min-w-60">
          <span className="block text-xs text-muted-foreground">Supplier</span>
          {editing ? (
            <Select value={po.supplierId || null} items={supplierItems} onValueChange={(v) => setPo({ ...po, supplierId: v as string })}>
              <SelectTrigger aria-label="Supplier" size="sm" className="mt-1 w-full">
                <SelectValue placeholder="Choose a supplier" />
              </SelectTrigger>
              <SelectContent>
                {supplierItems.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="font-semibold">{supplier?.name}</div>
          )}
        </div>
        <div>
          <span className="block text-xs text-muted-foreground">Expected</span>
          {editing ? (
            <Input
              type="date"
              aria-label="Expected delivery"
              className="mt-1 h-8"
              value={po.expectedAt ? po.expectedAt.slice(0, 10) : ""}
              onChange={(e) => setPo({ ...po, expectedAt: e.target.value ? new Date(`${e.target.value}T12:00:00`).toISOString() : null })}
            />
          ) : (
            <div className="font-semibold">{fmtDate(po.expectedAt)}</div>
          )}
        </div>
        <div>
          <span className="block text-xs text-muted-foreground">Terms</span>
          <div className="font-semibold">
            {supplier ? `${supplier.paymentTerms}${supplier.leadTimeDays !== null ? `, ${supplier.leadTimeDays} day lead time` : ""}` : "—"}
          </div>
        </div>
        <p className="basis-full text-[12.5px] text-muted-foreground">
          Created {fmtDate(po.createdAt)} by {po.createdBy}
          {po.orderedAt && ` · sent to supplier ${fmtDate(po.orderedAt)}`}
        </p>
      </section>

      {po.fromRule && editing && (
        <p className="rounded-md bg-primary/10 px-3 py-2.5 text-[13px] text-primary">A reorder rule drafted this order. Check quantities and costs, then submit it.</p>
      )}

      <Card title="Lines" action={<span className="text-muted-foreground">{po.items.length} lines</span>}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="text-left text-xs text-muted-foreground">
              <tr className="border-y [&>th]:px-3 [&>th]:py-2 [&>th]:font-medium">
                <th>Item</th>
                <th>Deliver to</th>
                <th className="text-right">Ordered</th>
                {!editing && <th className="text-right">Received</th>}
                {!editing && <th className="text-right">Damaged</th>}
                <th className="text-right">Unit cost</th>
                <th className="text-right">Line total</th>
                {editing && <th />}
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {po.items.map((i) => (
                <tr key={i.id} className="border-b last:border-b-0 [&>td]:px-3 [&>td]:py-2">
                  <td>
                    {editing ? (
                      <ItemSelect value={i.sku} onChange={(sku) => updateLine(i.id, DEMO_ITEMS.find((d) => d.sku === sku)!)} />
                    ) : (
                      <div>
                        <div className="font-semibold">{i.name}</div>
                        <div className="font-mono text-xs text-muted-foreground">{i.sku}</div>
                      </div>
                    )}
                  </td>
                  <td>{editing ? <WarehouseSelect sellableOnly value={i.warehouse} label="Deliver to" onChange={(code) => updateLine(i.id, { warehouse: code })} /> : <WarehouseTag code={i.warehouse} />}</td>
                  <td className="text-right">
                    {editing ? (
                      <Input aria-label="Quantity" inputMode="numeric" className={cn(cellInput, "ml-auto")} value={i.orderedQty} onChange={(e) => wholeNumber(e.target.value || "0") && updateLine(i.id, { orderedQty: Number(e.target.value) })} />
                    ) : (
                      i.orderedQty
                    )}
                  </td>
                  {!editing && <td className="text-right">{i.receivedQty}</td>}
                  {!editing && <td className="text-right">{i.damagedQty ? <span className="font-semibold text-destructive">{i.damagedQty}</span> : <span className="text-muted-foreground">0</span>}</td>}
                  <td className="text-right">
                    {editing ? (
                      <Input aria-label="Unit cost" inputMode="decimal" className={cn(cellInput, "ml-auto w-24")} value={i.unitCost} onChange={(e) => !Number.isNaN(Number(e.target.value)) && updateLine(i.id, { unitCost: Number(e.target.value) })} />
                    ) : (
                      taka(i.unitCost, 2)
                    )}
                  </td>
                  <td className="text-right">{taka(i.orderedQty * i.unitCost, 2)}</td>
                  {editing && (
                    <td>
                      <Button size="icon-sm" variant="ghost" aria-label="Remove line" onClick={() => setPo({ ...po, items: po.items.filter((x) => x.id !== i.id) })}>
                        <Trash2Icon />
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {editing && (
          <div className="border-t px-4 py-2.5">
            <Button size="sm" variant="outline" onClick={() => setPo({ ...po, items: [...po.items, newLine()] })}>
              <PlusIcon data-icon="inline-start" />
              Add line
            </Button>
          </div>
        )}
        <dl className="grid grid-cols-[auto_140px] justify-end gap-x-4 gap-y-1.5 border-t px-4 py-3 text-right tabular-nums">
          <dt className="text-muted-foreground">Subtotal</dt>
          <dd>{taka(subtotal(po), 2)}</dd>
          <dt className="text-muted-foreground">Shipping</dt>
          <dd>
            {editing ? (
              <Input aria-label="Shipping" inputMode="decimal" className="h-8 text-right" value={po.shippingAmount} onChange={(e) => !Number.isNaN(Number(e.target.value)) && setPo({ ...po, shippingAmount: Number(e.target.value) })} />
            ) : (
              taka(po.shippingAmount, 2)
            )}
          </dd>
          <dt className="text-base font-bold">Total</dt>
          <dd className="text-base font-bold">{taka(total(po), 2)}</dd>
        </dl>
      </Card>

      <Card title="Note">
        <div className="px-4 pb-4">
          {editing ? (
            <Textarea rows={2} placeholder="Anything the receiving team should know" value={po.note} onChange={(e) => setPo({ ...po, note: e.target.value })} />
          ) : (
            <p className="text-muted-foreground">{po.note || "No note."}</p>
          )}
        </div>
      </Card>
    </DocSheet>
  )
}
