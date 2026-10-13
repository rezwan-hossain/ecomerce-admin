"use client"

import { useState } from "react"
import { CheckIcon, CircleXIcon, FilePenLineIcon, PlusIcon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"

import {
  createPurchaseOrder,
  deletePurchaseOrder,
  getPurchaseOrder,
  getPurchaseOrders,
  purchaseOrderAction,
  receivePurchaseOrder,
  updatePurchaseOrder,
} from "@/app/actions/purchase-order.actions"
import { ListTable, type ListColumn } from "@/components/list-table"
import { Button } from "@/components/ui/button"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import type { StorageLocation } from "@/types/inventory.type"
import type { PurchaseOrder, PurchaseOrderDto, PurchaseOrderLine, PurchaseOrderListRow, ReceivePurchaseOrderDto } from "@/types/purchase-order.type"
import type { Supplier } from "@/types/supplier.type"
import type { Warehouse } from "@/types/warehouse.type"

import { cellInput, DocSheet, Progress, statusFilters, wholeNumber } from "./doc-bits"
import { Card, fmtDate, Kpis, n0, RackTag, rel, StatusPill, taka, WarehouseTag } from "./inventory-ui"

type VariantOption = { id: string; sku: string; label: string }

const OPEN = ["SUBMITTED", "CONFIRMED", "PARTIAL"]
// The happy path, in order; a cancelled order shows a banner instead.
const PO_STEPS = [
  { key: "DRAFT", text: "Drafted" },
  { key: "SUBMITTED", text: "Sent" },
  { key: "CONFIRMED", text: "Confirmed" },
  { key: "PARTIAL", text: "Receiving" },
  { key: "RECEIVED", text: "Received" },
  { key: "CLOSED", text: "Closed" },
]
const isLate = (po: { status: string; expectedAt: string | null }) =>
  OPEN.includes(po.status) && po.expectedAt !== null && new Date(po.expectedAt).getTime() < Date.now()
const lineName = (l: PurchaseOrderLine) => (l.variant.label ? `${l.variant.productName}, ${l.variant.label}` : l.variant.productName)

// The draft form keeps numbers as typed; `toDto` checks and converts them.
type FormLine = { key: string; variantId: string; warehouseId: string; orderedQty: string; unitCost: string }
type Form = { supplierId: string; expectedAt: string; note: string; taxAmount: string; shippingAmount: string; items: FormLine[] }

const newLine = (warehouseId: string): FormLine => ({ key: crypto.randomUUID(), variantId: "", warehouseId, orderedQty: "10", unitCost: "0" })

function toForm(po: PurchaseOrder | null, defaultWarehouseId: string): Form {
  if (!po) return { supplierId: "", expectedAt: "", note: "", taxAmount: "0", shippingAmount: "0", items: [newLine(defaultWarehouseId)] }
  return {
    supplierId: po.supplierId,
    expectedAt: po.expectedAt ? po.expectedAt.slice(0, 10) : "",
    note: po.note ?? "",
    taxAmount: String(Number(po.taxAmount)),
    shippingAmount: String(Number(po.shippingAmount)),
    items: po.items.map((l) => ({ key: l.id, variantId: l.variantId, warehouseId: l.warehouseId, orderedQty: String(l.orderedQty), unitCost: String(Number(l.unitCost)) })),
  }
}

// Returns the body, or a message for the first problem.
function toDto(form: Form): PurchaseOrderDto | string {
  if (!form.supplierId) return "Choose a supplier."
  const money = (s: string) => s.trim() !== "" && Number(s) >= 0
  if (!money(form.taxAmount) || !money(form.shippingAmount)) return "Tax and shipping must be 0 or more."
  const seen = new Set<string>()
  for (const [index, l] of form.items.entries()) {
    if (!l.variantId) return `Line ${index + 1}: pick an item.`
    if (!wholeNumber(l.orderedQty) || Number(l.orderedQty) < 1) return `Line ${index + 1}: order at least 1 unit.`
    if (!money(l.unitCost)) return `Line ${index + 1}: the unit cost must be 0 or more.`
    const pair = `${l.variantId}|${l.warehouseId}`
    if (seen.has(pair)) return "Each item may appear once per receiving warehouse."
    seen.add(pair)
  }
  return {
    supplierId: form.supplierId,
    expectedAt: form.expectedAt ? new Date(`${form.expectedAt}T12:00:00`).toISOString() : null,
    note: form.note.trim() || null,
    taxAmount: Number(form.taxAmount),
    shippingAmount: Number(form.shippingAmount),
    items: form.items.map((l) => ({ variantId: l.variantId, warehouseId: l.warehouseId || undefined, orderedQty: Number(l.orderedQty), unitCost: Number(l.unitCost) })),
  }
}

// Type part of a name or SKU; picking ties the line to a real variant.
function VariantSelect({ options, value, onChange }: { options: VariantOption[]; value: string; onChange: (id: string) => void }) {
  const selected = options.find((o) => o.id === value) ?? null
  return (
    <Combobox
      items={options}
      autoHighlight
      value={selected}
      onValueChange={(item) => item && onChange((item as VariantOption).id)}
      itemToStringLabel={(item) => (item as VariantOption).label}
      filter={(item: VariantOption, query) => {
        const q = query.trim().toLowerCase()
        // While the box still shows the picked item, list everything.
        if (!q || (selected && q === selected.label.toLowerCase())) return true
        return `${item.label} ${item.sku}`.toLowerCase().includes(q)
      }}
    >
      <ComboboxInput aria-label="Item" placeholder="Search name or SKU..." className="h-8 w-full min-w-56" />
      <ComboboxContent className="min-w-80">
        <ComboboxEmpty>No item matches.</ComboboxEmpty>
        <ComboboxList>
          {(item: VariantOption) => (
            <ComboboxItem key={item.id} value={item}>
              <span className="min-w-0">
                <span className="block truncate">{item.label}</span>
                <span className="block truncate font-mono text-[11px] text-muted-foreground">{item.sku}</span>
              </span>
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}

export function PurchaseOrders({
  initialOrders,
  suppliers,
  warehouses,
  variants,
  locations,
}: {
  initialOrders: PurchaseOrderListRow[]
  suppliers: Supplier[]
  warehouses: Warehouse[]
  variants: VariantOption[]
  locations: StorageLocation[]
}) {
  const [orders, setOrders] = useState(initialOrders)
  // undefined = closed, null = a new order, otherwise the open order (loaded with its lines)
  const [open, setOpen] = useState<PurchaseOrder | null | undefined>(undefined)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [receiving, setReceiving] = useState(false)

  async function refreshList() {
    const res = await getPurchaseOrders()
    if (res.success) setOrders(res.data)
  }

  async function openOrder(id: string) {
    setLoadingId(id)
    const res = await getPurchaseOrder(id)
    setLoadingId(null)
    if (!res.success) return toast.error(res.error)
    setOpen(res.data)
  }

  // Every write answers with the whole order, so the sheet shows what the server saved.
  async function changed(po: PurchaseOrder | null) {
    setOpen(po ?? undefined)
    await refreshList()
  }

  const openOrders = orders.filter((o) => OPEN.includes(o.status))
  const drafts = orders.filter((o) => o.status === "DRAFT").length
  const incoming = openOrders.reduce((s, o) => s + Math.max(0, o.orderedUnits - o.receivedUnits - o.damagedUnits), 0)

  const columns: ListColumn<PurchaseOrderListRow>[] = [
    {
      key: "order",
      header: "Order",
      cell: (po) => (
        <button type="button" className="text-left" onClick={() => openOrder(po.id)} disabled={loadingId !== null}>
          <span className="font-semibold text-primary hover:underline">{po.poNumber}</span>
          <span className="block text-xs text-muted-foreground">
            {loadingId === po.id ? "Opening..." : `${po.lineCount} ${po.lineCount === 1 ? "line" : "lines"}`}
          </span>
        </button>
      ),
    },
    { key: "supplier", header: "Supplier", cell: (po) => po.supplier.name },
    { key: "status", header: "Status", cell: (po) => <StatusPill status={po.status} /> },
    {
      key: "received",
      header: "Received",
      className: "hidden md:table-cell",
      cell: (po) => <Progress done={po.receivedUnits} damaged={po.damagedUnits} total={po.orderedUnits} />,
    },
    { key: "total", header: "Total", className: "text-right tabular-nums", cell: (po) => taka(Number(po.totalAmount)) },
    {
      key: "ordered",
      header: "Ordered",
      className: "hidden whitespace-nowrap xl:table-cell",
      cell: (po) => <span className="text-muted-foreground">{po.orderedAt ? fmtDate(po.orderedAt) : "Not sent"}</span>,
    },
    {
      key: "expected",
      header: "Expected",
      className: "hidden whitespace-nowrap xl:table-cell",
      cell: (po) => (
        <span className={isLate(po) ? "font-semibold text-destructive" : "text-muted-foreground"}>
          {fmtDate(po.expectedAt)}
          {isLate(po) && ", late"}
        </span>
      ),
    },
  ]

  return (
    <>
      <Kpis
        className="mx-4 xl:grid-cols-4 lg:mx-6"
        items={[
          { label: "Open orders", value: n0(openOrders.length), hint: `${n0(drafts)} ${drafts === 1 ? "draft" : "drafts"} not sent` },
          { label: "On order", value: taka(openOrders.reduce((s, o) => s + Number(o.totalAmount), 0)), hint: "value of open orders" },
          { label: "Units incoming", value: n0(incoming), hint: "ordered, not received yet" },
          { label: "Late", value: n0(orders.filter(isLate).length), hint: "past their expected date", warn: orders.some(isLate) },
        ]}
      />
      <ListTable
        rows={orders}
        columns={columns}
        getRowId={(po) => po.id}
        searchText={(po) => `${po.poNumber} ${po.supplier.name} ${po.supplier.code}`}
        searchPlaceholder="Search by number or supplier..."
        filters={statusFilters<PurchaseOrderListRow>([
          ["Open", ["DRAFT", ...OPEN]],
          ["To receive", OPEN],
          ["Drafts", ["DRAFT"]],
          ["Done", ["RECEIVED", "CLOSED", "CANCELLED"]],
          ["All", null],
        ])}
        emptyText="No purchase orders here."
        toolbar={
          <Button size="sm" onClick={() => setOpen(null)}>
            <PlusIcon data-icon="inline-start" />
            New purchase order
          </Button>
        }
      />

      {open !== undefined && (
        <PoSheet
          key={open?.id ?? "new"}
          po={open}
          suppliers={suppliers}
          warehouses={warehouses}
          variants={variants}
          onChanged={changed}
          onReceive={() => setReceiving(true)}
          onClose={() => setOpen(undefined)}
        />
      )}
      {receiving && open && (
        <ReceiveDialog
          po={open}
          locations={locations}
          onReceived={(po) => {
            setReceiving(false)
            changed(po)
          }}
          onClose={() => setReceiving(false)}
        />
      )}
    </>
  )
}

function PoSheet({
  po,
  suppliers,
  warehouses,
  variants,
  onChanged,
  onReceive,
  onClose,
}: {
  po: PurchaseOrder | null
  suppliers: Supplier[]
  warehouses: Warehouse[]
  variants: VariantOption[]
  onChanged: (po: PurchaseOrder | null) => Promise<void>
  onReceive: () => void
  onClose: () => void
}) {
  const defaultWarehouseId = warehouses.find((w) => w.isDefault)?.id ?? warehouses[0]?.id ?? ""
  const [form, setForm] = useState(() => toForm(po, defaultWarehouseId))
  const [busy, setBusy] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const editing = !po || po.status === "DRAFT"
  const supplier = suppliers.find((s) => s.id === (editing ? form.supplierId : po?.supplierId))
  // Only active suppliers can be picked, but keep the one a draft already uses.
  const supplierItems = suppliers.filter((s) => s.isActive || s.id === po?.supplierId).map((s) => ({ value: s.id, label: s.name }))
  const warehouseItems = warehouses.map((w) => ({ value: w.id, label: w.code }))
  const set = (patch: Partial<Form>) => setForm({ ...form, ...patch })
  const updateLine = (key: string, patch: Partial<FormLine>) => set({ items: form.items.map((l) => (l.key === key ? { ...l, ...patch } : l)) })

  // A preview while editing; the server computes the saved totals.
  const subtotal = form.items.reduce((s, l) => s + (Number(l.orderedQty) || 0) * (Number(l.unitCost) || 0), 0)
  const previewTotal = subtotal + (Number(form.taxAmount) || 0) + (Number(form.shippingAmount) || 0)

  async function run<T>(work: () => Promise<{ success: true; data: T } | { success: false; error: string }>, message: string) {
    setBusy(true)
    const res = await work()
    setBusy(false)
    if (!res.success) {
      toast.error(res.error)
      // Someone else moved the order on; show what's saved now.
      if (po && res.error.includes("can't be")) {
        const fresh = await getPurchaseOrder(po.id)
        if (fresh.success) await onChanged(fresh.data)
      }
      return null
    }
    toast.success(message)
    return res.data
  }

  // Creates the draft or replaces its fields and lines.
  async function saveDraft() {
    const dto = toDto(form)
    if (typeof dto === "string") {
      toast.error(dto)
      return null
    }
    if (po) return run(() => updatePurchaseOrder(po.id, dto), "Draft saved")
    return run(() => createPurchaseOrder(dto), "Draft created")
  }

  async function save() {
    const saved = await saveDraft()
    if (saved) await onChanged(saved)
  }

  async function submit() {
    if (form.items.length === 0) return toast.error("Add at least one line before submitting.")
    const saved = await saveDraft()
    if (!saved) return
    const sent = await run(() => purchaseOrderAction(saved.id, "submit"), `${saved.poNumber} submitted. Its units now count as incoming.`)
    await onChanged(sent ?? saved)
  }

  async function act(action: "confirm" | "cancel" | "close", message: string) {
    const res = await run(() => purchaseOrderAction(po!.id, action), message)
    if (res) await onChanged(res)
  }

  async function remove() {
    setDeleting(false)
    const res = await run(() => deletePurchaseOrder(po!.id), `${po!.poNumber} deleted`)
    if (res) await onChanged(null)
  }

  const ordered = po?.items.reduce((s, l) => s + l.orderedQty, 0) ?? 0
  const received = po?.items.reduce((s, l) => s + l.receivedQty, 0) ?? 0
  const damaged = po?.items.reduce((s, l) => s + l.damagedQty, 0) ?? 0

  let footer: React.ReactNode
  if (editing) {
    footer = (
      <>
        {po && (
          <Button variant="ghost" className="text-destructive" onClick={() => setDeleting(true)} disabled={busy}>
            Delete draft
          </Button>
        )}
        {po && (
          <Button variant="ghost" onClick={() => act("cancel", `${po.poNumber} cancelled`)} disabled={busy}>
            Cancel order
          </Button>
        )}
        <span className="flex-1" />
        <Button variant="outline" onClick={save} disabled={busy}>
          {po ? "Save draft" : "Create draft"}
        </Button>
        <Button onClick={submit} disabled={busy}>Submit to supplier</Button>
      </>
    )
  } else if (po!.status === "SUBMITTED" || po!.status === "CONFIRMED") {
    footer = (
      <>
        <Button variant="ghost" className="text-destructive" onClick={() => act("cancel", `${po!.poNumber} cancelled. Its units no longer count as incoming.`)} disabled={busy}>
          Cancel order
        </Button>
        <span className="flex-1" />
        {po!.status === "SUBMITTED" && (
          <Button variant="outline" onClick={() => act("confirm", "Marked as confirmed by the supplier")} disabled={busy}>
            Mark confirmed
          </Button>
        )}
        <Button onClick={onReceive} disabled={busy}>Receive items</Button>
      </>
    )
  } else if (po!.status === "PARTIAL") {
    footer = (
      <>
        <Button variant="ghost" className="text-destructive" onClick={() => act("close", `${po!.poNumber} closed short. The rest no longer counts as incoming.`)} disabled={busy}>
          Close short
        </Button>
        <span className="flex-1" />
        <Button onClick={onReceive} disabled={busy}>Receive items</Button>
      </>
    )
  } else if (po!.status === "RECEIVED") {
    footer = (
      <>
        <span className="flex-1" />
        <Button onClick={() => act("close", `${po!.poNumber} closed`)} disabled={busy}>Close order</Button>
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

  let total = previewTotal
  if (!editing) total = Number(po!.totalAmount)

  const due = po?.items.reduce((s, l) => s + l.outstandingQty, 0) ?? 0
  const receivedValue = po?.items.reduce((s, l) => s + l.receivedQty * Number(l.unitCost), 0) ?? 0
  const stepIndex = po ? PO_STEPS.findIndex((step) => step.key === po.status) : 0
  const expectedAt = editing ? (form.expectedAt ? new Date(`${form.expectedAt}T12:00:00`).toISOString() : null) : po!.expectedAt
  const contact = [supplier?.contactName, supplier?.contactPhone, supplier?.contactEmail].filter(Boolean).join(" · ")

  return (
    <DocSheet kind="Purchase order" title={po?.poNumber ?? "New purchase order"} status={po?.status ?? "DRAFT"} footer={footer} onClose={onClose}>
      {editing && (
        <p className="flex items-start gap-2.5 rounded-xl border border-dashed bg-card px-4 py-3 text-[13px] text-muted-foreground">
          <FilePenLineIcon className="mt-0.5 size-4 shrink-0" />
          <span>
            {po ? "This draft hasn’t been sent." : "New orders start as a draft."} Pick the supplier and lines, then <strong className="font-semibold text-foreground">Submit to supplier</strong>:
            its units then count as incoming until they’re received.
          </span>
        </p>
      )}
      {po?.status === "CANCELLED" && (
        <p className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          <CircleXIcon className="mt-0.5 size-4 shrink-0" />
          <span>Cancelled {fmtDate(po.cancelledAt)}. Nothing was received, and its units no longer count as incoming.</span>
        </p>
      )}
      {po && !editing && po.status !== "CANCELLED" && (
        <section className="overflow-x-auto rounded-2xl border bg-card px-4 py-3.5">
          <ol className="flex min-w-[560px] items-start">
            {PO_STEPS.map((step, index) => {
              const done = index <= stepIndex
              let at: string | null = null
              if (step.key === "DRAFT") at = fmtDate(po.createdAt)
              if (step.key === "SUBMITTED" && po.orderedAt) at = fmtDate(po.orderedAt)
              if (step.key === "CONFIRMED" && po.approvedBy) at = po.approvedBy.name
              if (step.key === "PARTIAL" && done) at = `${n0(received)} of ${n0(ordered)}`
              if (step.key === "RECEIVED" && po.receivedAt) at = fmtDate(po.receivedAt)
              if (step.key === "CLOSED" && po.status === "CLOSED") at = fmtDate(po.updatedAt)
              return (
                <li key={step.key} className="relative flex flex-1 flex-col items-center gap-1 text-center">
                  {index > 0 && <span className={cn("absolute top-2.5 right-1/2 h-0.5 w-full -translate-y-1/2", done ? "bg-primary" : "bg-border")} aria-hidden />}
                  <span
                    className={cn(
                      "relative z-10 grid size-5 place-items-center rounded-full border-2 bg-card",
                      done && "border-primary bg-primary text-primary-foreground",
                      index === stepIndex && "ring-4 ring-primary/20",
                      !done && "border-border"
                    )}
                  >
                    {done && <CheckIcon className="size-3" strokeWidth={3} />}
                  </span>
                  <span className={cn("text-xs font-medium", !done && "text-muted-foreground")}>{step.text}</span>
                  <span className="text-[11px] text-muted-foreground">{at ?? "—"}</span>
                </li>
              )
            })}
          </ol>
        </section>
      )}

      <section className="overflow-hidden rounded-2xl border bg-card">
        <div className="grid gap-x-6 gap-y-4 px-4 py-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
          <div className="min-w-0">
            <span className="mb-1 block text-xs text-muted-foreground">Supplier</span>
            {editing ? (
              <Select value={form.supplierId || null} items={supplierItems} onValueChange={(v) => set({ supplierId: v as string })}>
                <SelectTrigger aria-label="Supplier" className="w-full">
                  <SelectValue placeholder="Choose a supplier" />
                </SelectTrigger>
                <SelectContent>
                  {supplierItems.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="flex items-center gap-2.5">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-xs font-bold text-primary uppercase">
                  {po!.supplier.name.slice(0, 2)}
                </span>
                <div className="min-w-0">
                  <div className="truncate font-semibold">{po!.supplier.name}</div>
                  <div className="font-mono text-xs text-muted-foreground">{po!.supplier.code}</div>
                </div>
              </div>
            )}
            {contact && <div className="mt-1.5 truncate text-xs text-muted-foreground" title={contact}>{contact}</div>}
          </div>
          <div>
            <span className="mb-1 block text-xs text-muted-foreground">Expected</span>
            {editing ? (
              <Input type="date" aria-label="Expected delivery" value={form.expectedAt} onChange={(e) => set({ expectedAt: e.target.value })} />
            ) : (
              <div className={cn("font-semibold", isLate(po!) && "text-destructive")}>{fmtDate(po!.expectedAt)}</div>
            )}
            {expectedAt && OPEN.includes(po?.status ?? "") && (
              <div className={cn("text-xs", isLate(po!) ? "font-medium text-destructive" : "text-muted-foreground")}>
                {isLate(po!) ? `${rel(expectedAt).replace(" ago", "")} late` : `Due ${rel(expectedAt)}`}
              </div>
            )}
          </div>
          <div>
            <span className="mb-1 block text-xs text-muted-foreground">Terms</span>
            <div className="font-semibold">{supplier?.paymentTerms ?? "—"}</div>
            {supplier?.leadTimeDays != null && <div className="text-xs text-muted-foreground">{supplier.leadTimeDays} day lead time</div>}
          </div>
          <div className="lg:text-right">
            <span className="mb-1 block text-xs text-muted-foreground">{editing ? "Total (estimate)" : "Total"}</span>
            <div className="text-2xl leading-tight font-bold tracking-tight tabular-nums">{taka(total)}</div>
            <div className="text-xs text-muted-foreground">{po?.currency ?? "BDT"}</div>
          </div>
        </div>
        {po && !editing && (
          <div className="border-t bg-muted/30 px-4 py-3">
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-5">
              {[
                { text: "Ordered", value: n0(ordered) },
                { text: "Received", value: n0(received), tone: received > 0 ? "text-emerald-700 dark:text-emerald-400" : undefined },
                { text: "Damaged", value: n0(damaged), tone: damaged > 0 ? "text-destructive" : undefined },
                { text: "Still due", value: n0(due) },
                { text: "Value received", value: taka(receivedValue) },
              ].map((stat) => (
                <div key={stat.text}>
                  <span className="block text-xs text-muted-foreground">{stat.text}</span>
                  <span className={cn("text-base font-bold tabular-nums", stat.tone)}>{stat.value}</span>
                </div>
              ))}
            </div>
            <div className="mt-2.5">
              <Progress done={received} damaged={damaged} total={ordered} />
            </div>
          </div>
        )}
        {po && (
          <p className="border-t px-4 py-2 text-xs text-muted-foreground">
            Created {fmtDate(po.createdAt)}
            {po.createdBy && ` by ${po.createdBy.name}`} · updated {fmtDate(po.updatedAt)}
          </p>
        )}
      </section>

      <Card title="Lines" action={<span className="text-muted-foreground">{n0(editing ? form.items.length : po!.items.length)} {(editing ? form.items.length : po!.items.length) === 1 ? "line" : "lines"}</span>}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr className="border-y [&>th]:px-3 [&>th]:py-2.5 [&>th]:font-medium [&>th]:whitespace-nowrap [&>th:first-child]:pl-4 [&>th:last-child]:pr-4">
                <th>Item</th>
                <th>Deliver to</th>
                <th className="text-right">Ordered</th>
                {!editing && <th className="text-right">Received</th>}
                {!editing && <th className="text-right">Damaged</th>}
                {!editing && <th className="text-right">Still due</th>}
                <th className="text-right">Unit cost</th>
                <th className="text-right">Line total</th>
                {editing ? <th className="w-10"><span className="sr-only">Remove</span></th> : <th>Status</th>}
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {editing &&
                form.items.map((l) => {
                  const sku = variants.find((v) => v.id === l.variantId)?.sku
                  return (
                    <tr key={l.key} className="border-b border-border/60 last:border-b-0 [&>td]:px-3 [&>td]:py-2.5 [&>td:first-child]:pl-4 [&>td:last-child]:pr-4">
                      <td className="min-w-64">
                        <VariantSelect options={variants} value={l.variantId} onChange={(variantId) => updateLine(l.key, { variantId })} />
                        <div className="mt-1 pl-0.5 font-mono text-[11.5px] text-muted-foreground">{sku ?? "Pick an item"}</div>
                      </td>
                      <td>
                        <Select value={l.warehouseId || null} items={warehouseItems} onValueChange={(v) => updateLine(l.key, { warehouseId: v as string })}>
                          <SelectTrigger aria-label="Deliver to" size="sm" className="w-full min-w-28"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {warehouseItems.map((w) => <SelectItem key={w.value} value={w.value}>{w.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="text-right">
                        <Input aria-label="Quantity" inputMode="numeric" className={cn(cellInput, "ml-auto w-20")} value={l.orderedQty} onChange={(e) => updateLine(l.key, { orderedQty: e.target.value })} />
                      </td>
                      <td className="text-right">
                        <Input aria-label="Unit cost" inputMode="decimal" className={cn(cellInput, "ml-auto w-28")} value={l.unitCost} onChange={(e) => updateLine(l.key, { unitCost: e.target.value })} />
                      </td>
                      <td className="text-right font-medium whitespace-nowrap">{taka((Number(l.orderedQty) || 0) * (Number(l.unitCost) || 0), 2)}</td>
                      <td>
                        <Button size="icon-sm" variant="ghost" className="text-muted-foreground hover:text-destructive" aria-label="Remove line" onClick={() => set({ items: form.items.filter((x) => x.key !== l.key) })}>
                          <Trash2Icon />
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              {!editing &&
                po!.items.map((l) => (
                  <tr key={l.id} className="border-b border-border/60 last:border-b-0 [&>td]:px-3 [&>td]:py-2.5 [&>td:first-child]:pl-4 [&>td:last-child]:pr-4">
                    <td className="min-w-56">
                      <div className="font-medium">{lineName(l)}</div>
                      <div className="font-mono text-[11.5px] text-muted-foreground">{l.variant.sku}</div>
                      <div className="mt-1.5 flex h-1 w-40 overflow-hidden rounded-full bg-muted" aria-hidden>
                        <i className="block h-full bg-emerald-600" style={{ width: `${(l.receivedQty / l.orderedQty) * 100}%` }} />
                        <i className="block h-full bg-red-600" style={{ width: `${(l.damagedQty / l.orderedQty) * 100}%` }} />
                      </div>
                    </td>
                    <td><WarehouseTag code={l.warehouse.code} /></td>
                    <td className="text-right">{n0(l.orderedQty)}</td>
                    <td className="text-right">{n0(l.receivedQty)}</td>
                    <td className="text-right">{l.damagedQty ? <span className="font-semibold text-destructive">{n0(l.damagedQty)}</span> : <span className="text-muted-foreground/60">0</span>}</td>
                    <td className="text-right font-semibold">{n0(l.outstandingQty)}</td>
                    <td className="text-right text-muted-foreground">{taka(Number(l.unitCost), 2)}</td>
                    <td className="text-right font-medium whitespace-nowrap">{taka(Number(l.totalCost), 2)}</td>
                    <td><StatusPill status={l.status} /></td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        {editing && (
          <div className="border-t px-4 py-2.5">
            <Button size="sm" variant="outline" onClick={() => set({ items: [...form.items, newLine(defaultWarehouseId)] })}>
              <PlusIcon data-icon="inline-start" />
              Add line
            </Button>
          </div>
        )}
        <div className="border-t">
          <dl className="ml-auto grid w-full max-w-xs grid-cols-[1fr_auto] items-center gap-x-6 gap-y-2 px-4 py-3.5 text-right tabular-nums">
            <dt className="text-muted-foreground">Subtotal</dt>
            <dd>{taka(editing ? subtotal : Number(po!.subtotalAmount), 2)}</dd>
            <dt className="text-muted-foreground">Tax</dt>
            <dd>
              {editing ? (
                <Input aria-label="Tax" inputMode="decimal" className="ml-auto h-8 w-32 text-right" value={form.taxAmount} onChange={(e) => set({ taxAmount: e.target.value })} />
              ) : (
                taka(Number(po!.taxAmount), 2)
              )}
            </dd>
            <dt className="text-muted-foreground">Shipping</dt>
            <dd>
              {editing ? (
                <Input aria-label="Shipping" inputMode="decimal" className="ml-auto h-8 w-32 text-right" value={form.shippingAmount} onChange={(e) => set({ shippingAmount: e.target.value })} />
              ) : (
                taka(Number(po!.shippingAmount), 2)
              )}
            </dd>
            <div className="col-span-2 my-0.5 border-t" />
            <dt className="text-base font-semibold">{editing ? "Total (estimate)" : "Total"}</dt>
            <dd className="text-base font-bold">{taka(total, 2)}</dd>
          </dl>
        </div>
      </Card>

      <Card title="Note">
        <div className="px-4 pb-4">
          {editing ? (
            <Textarea rows={2} maxLength={1000} placeholder="Anything the receiving team should know" value={form.note} onChange={(e) => set({ note: e.target.value })} />
          ) : (
            <p className="text-muted-foreground">{po!.note || "No note."}</p>
          )}
        </div>
      </Card>

      {deleting && po && (
        <Dialog open onOpenChange={(o) => !o && setDeleting(false)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Delete {po.poNumber}?</DialogTitle>
              <DialogDescription>The draft and its lines are removed. It was never sent, so no stock changes.</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleting(false)}>Keep it</Button>
              <Button variant="destructive" onClick={remove}>Delete draft</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </DocSheet>
  )
}

const DEFAULT_RACK = "default"

type ReceiveRow = { good: string; damaged: string; rack: string; batch: string; expires: string }

// Good units go into stock at the line's cost; damaged ones are refused and recorded.
function ReceiveDialog({
  po,
  locations,
  onReceived,
  onClose,
}: {
  po: PurchaseOrder
  locations: StorageLocation[]
  onReceived: (po: PurchaseOrder) => void
  onClose: () => void
}) {
  const lines = po.items.filter((l) => l.outstandingQty > 0)
  const [rows, setRows] = useState<Record<string, ReceiveRow>>(() =>
    Object.fromEntries(lines.map((l) => [l.id, { good: String(l.outstandingQty), damaged: "0", rack: DEFAULT_RACK, batch: "", expires: "" }]))
  )
  const [reference, setReference] = useState("")
  const [note, setNote] = useState("")
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const update = (id: string, patch: Partial<ReceiveRow>) => {
    setRows({ ...rows, [id]: { ...rows[id], ...patch } })
    setError("")
  }

  // Racks and bins in the line's warehouse; UNASSIGNED is what "Default rack" falls back to.
  const racksOf = (warehouseId: string) => [
    { value: DEFAULT_RACK, label: "Default rack" },
    ...locations
      .filter((l) => l.warehouse.id === warehouseId && l.isActive && l.code !== "UNASSIGNED")
      .sort((a, b) => a.code.localeCompare(b.code))
      .map((l) => ({ value: l.id, label: l.code })),
  ]

  async function submit() {
    const body: ReceivePurchaseOrderDto["lines"] = []
    for (const l of lines) {
      const r = rows[l.id]
      if (!wholeNumber(r.good) || !wholeNumber(r.damaged)) return setError("Enter whole numbers.")
      const good = Number(r.good)
      const damaged = Number(r.damaged)
      if (good + damaged === 0) continue
      if (good + damaged > l.outstandingQty) return setError(`${l.variant.sku}: only ${l.outstandingQty} still due.`)
      body.push({
        itemId: l.id,
        quantity: good,
        damagedQty: damaged || undefined,
        batchNumber: r.batch.trim() || undefined,
        expiresAt: r.expires ? new Date(`${r.expires}T12:00:00`).toISOString() : undefined,
        locationId: r.rack !== DEFAULT_RACK ? r.rack : undefined,
      })
    }
    if (body.length === 0) return setError("Enter a quantity for at least one line.")
    setSaving(true)
    const res = await receivePurchaseOrder(po.id, { reference: reference.trim() || undefined, note: note.trim() || undefined, lines: body })
    setSaving(false)
    if (!res.success) return setError(res.error)
    const units = body.reduce((s, b) => s + b.quantity, 0)
    toast.success(res.data.status === "RECEIVED" ? "Everything received and put away" : `${n0(units)} units received`, {
      description: res.data.status === "RECEIVED" ? undefined : "Some units are still to come.",
    })
    onReceived(res.data)
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Receive {po.poNumber}</DialogTitle>
          <DialogDescription>
            From {po.supplier.name}. Good units go into stock at the order’s unit cost, each line gets a batch, and the movements are tagged with
            {" "}{po.poNumber}. Damaged units are refused and recorded but not added. Incoming drops by everything that arrived.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="po-reference">Invoice or delivery note</FieldLabel>
            <Input id="po-reference" maxLength={100} value={reference} onChange={(e) => setReference(e.target.value)} placeholder="INV-20931" />
          </Field>
          <Field>
            <FieldLabel htmlFor="po-receive-note">Note</FieldLabel>
            <Input id="po-receive-note" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Two cartons arrived wet" />
          </Field>
        </div>
        <div className="max-h-[50vh] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-background text-left text-xs text-muted-foreground">
              <tr className="border-b [&>th]:py-2 [&>th]:pr-2 [&>th]:font-medium">
                <th>Item</th>
                <th className="text-right">Due</th>
                <th className="text-right">Good</th>
                <th className="text-right">Damaged</th>
                <th>Put on rack</th>
                <th>Batch</th>
                <th>Expires</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => {
                const r = rows[l.id]
                const racks = racksOf(l.warehouseId)
                return (
                  <tr key={l.id} className="border-b last:border-b-0 [&>td]:py-2 [&>td]:pr-2">
                    <td className="min-w-48">
                      <div className="font-medium">{lineName(l)}</div>
                      <div className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
                        {l.variant.sku} <WarehouseTag code={l.warehouse.code} />
                      </div>
                    </td>
                    <td className="text-right tabular-nums">{n0(l.outstandingQty)}</td>
                    <td className="text-right">
                      <Input aria-label={`Good units of ${l.variant.sku}`} inputMode="numeric" className={cn(cellInput, "ml-auto w-16")} value={r.good} onChange={(e) => update(l.id, { good: e.target.value })} />
                    </td>
                    <td className="text-right">
                      <Input aria-label={`Damaged units of ${l.variant.sku}`} inputMode="numeric" className={cn(cellInput, "ml-auto w-16")} value={r.damaged} onChange={(e) => update(l.id, { damaged: e.target.value })} />
                    </td>
                    <td>
                      <Select value={r.rack} items={racks} onValueChange={(v) => update(l.id, { rack: v as string })}>
                        <SelectTrigger aria-label={`Rack for ${l.variant.sku}`} size="sm" className="w-32"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {racks.map((x) => <SelectItem key={x.value} value={x.value}>{x.value === DEFAULT_RACK ? x.label : <RackTag code={x.label} />}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </td>
                    <td>
                      <Input aria-label={`Batch for ${l.variant.sku}`} maxLength={100} placeholder="Auto" className="h-8 w-28 font-mono" value={r.batch} onChange={(e) => update(l.id, { batch: e.target.value })} />
                    </td>
                    <td>
                      <Input aria-label={`Expiry for ${l.variant.sku}`} type="date" className="h-8 w-36" value={r.expires} onChange={(e) => update(l.id, { expires: e.target.value })} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <DialogFooter className="items-center">
          {error && <p className="mr-auto text-[13px] font-medium text-destructive">{error}</p>}
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Receiving..." : "Receive"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
