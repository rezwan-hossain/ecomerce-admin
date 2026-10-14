"use client"

import { useState } from "react"
import { ArrowRightIcon, PlusIcon, Trash2Icon, TriangleAlertIcon } from "lucide-react"
import { toast } from "sonner"

import {
  createTransfer,
  deleteTransfer,
  getTransfer,
  getTransfers,
  receiveTransfer,
  shipTransfer,
  transferAction,
  updateTransfer,
} from "@/app/actions/transfer.actions"
import { ListTable, type ListColumn } from "@/components/list-table"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import type { StorageLocation, VariantStock } from "@/types/inventory.type"
import type { ShortLine, Transfer, TransferDto, TransferLine, TransferListRow } from "@/types/transfer.type"
import type { Warehouse } from "@/types/warehouse.type"

import { cellInput, DocSheet, Progress, statusFilters, VariantSelect, wholeNumber } from "./doc-bits"
import { Card, fmtDate, fmtDateTime, Kpis, n0, RackTag, StatusPill, taka, WarehouseTag } from "./inventory-ui"

const OPEN = ["DRAFT", "PENDING", "IN_TRANSIT", "PARTIAL"]
const ON_THE_WAY = ["IN_TRANSIT", "PARTIAL"]
const DEFAULT_RACK = "default"
const ALL = "all"
const DAY = 86_400_000

const lineName = (l: TransferLine) => (l.variant.label ? `${l.variant.productName}, ${l.variant.label}` : l.variant.productName)

function Route({ from, to }: { from: string; to: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <WarehouseTag code={from} />
      <ArrowRightIcon className="size-3 text-muted-foreground" />
      <WarehouseTag code={to} />
    </span>
  )
}

// The draft form keeps quantities as typed; `toDto` checks and converts them.
type FormLine = { key: string; variantId: string; quantity: string }
type Form = { fromWarehouseId: string; toWarehouseId: string; note: string; items: FormLine[] }

const newLine = (): FormLine => ({ key: crypto.randomUUID(), variantId: "", quantity: "1" })

function toForm(t: Transfer | null, warehouses: Warehouse[]): Form {
  if (t) {
    return {
      fromWarehouseId: t.fromWarehouseId,
      toWarehouseId: t.toWarehouseId,
      note: t.note ?? "",
      items: t.items.map((l) => ({ key: l.id, variantId: l.variantId, quantity: String(l.requestedQty) })),
    }
  }
  // Default: from the default warehouse to the first other one.
  const from = warehouses.find((w) => w.isDefault) ?? warehouses[0]
  const to = warehouses.find((w) => w.id !== from?.id)
  return { fromWarehouseId: from?.id ?? "", toWarehouseId: to?.id ?? "", note: "", items: [newLine()] }
}

// Returns the body, or a message for the first problem.
function toDto(form: Form): TransferDto | string {
  if (!form.fromWarehouseId || !form.toWarehouseId) return "Pick both warehouses."
  if (form.fromWarehouseId === form.toWarehouseId) return "Source and destination must differ."
  const seen = new Set<string>()
  for (const [index, l] of form.items.entries()) {
    if (!l.variantId) return `Line ${index + 1}: pick an item.`
    if (!wholeNumber(l.quantity) || Number(l.quantity) < 1) return `Line ${index + 1}: send at least 1 unit.`
    if (seen.has(l.variantId)) return "Each item may appear only once."
    seen.add(l.variantId)
  }
  return {
    fromWarehouseId: form.fromWarehouseId,
    toWarehouseId: form.toWarehouseId,
    note: form.note.trim() || null,
    items: form.items.map((l) => ({ variantId: l.variantId, quantity: Number(l.quantity) })),
  }
}

export function Transfers({
  initialTransfers,
  warehouses,
  stock,
  locations,
}: {
  initialTransfers: TransferListRow[]
  warehouses: Warehouse[]
  stock: VariantStock[]
  locations: StorageLocation[]
}) {
  const [rows, setRows] = useState(initialTransfers)
  // undefined = closed, null = a new transfer, otherwise the open one (loaded with its lines)
  const [open, setOpen] = useState<Transfer | null | undefined>(undefined)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [warehouse, setWarehouse] = useState(ALL)
  const [receiving, setReceiving] = useState(false)

  async function refreshList() {
    const res = await getTransfers()
    if (res.success) setRows(res.data)
  }

  async function openTransfer(id: string) {
    setLoadingId(id)
    const res = await getTransfer(id)
    setLoadingId(null)
    if (!res.success) return toast.error(res.error)
    setOpen(res.data)
  }

  // Every write answers with the whole transfer, so the sheet shows what the server saved.
  async function changed(t: Transfer | null) {
    setOpen(t ?? undefined)
    await refreshList()
  }

  const since = Date.now() - 30 * DAY
  const onTheWay = rows.filter((t) => ON_THE_WAY.includes(t.status))
  const drafts = rows.filter((t) => t.status === "DRAFT").length
  const visible = rows.filter((t) => warehouse === ALL || t.fromWarehouseId === warehouse || t.toWarehouseId === warehouse)
  const warehouseItems = [{ value: ALL, label: "Any warehouse" }, ...warehouses.map((w) => ({ value: w.id, label: w.code }))]

  const columns: ListColumn<TransferListRow>[] = [
    {
      key: "number",
      header: "Transfer",
      cell: (t) => (
        <button type="button" className="text-left" onClick={() => openTransfer(t.id)} disabled={loadingId !== null}>
          <span className="font-semibold text-primary hover:underline">{t.transferNumber}</span>
          <span className="block max-w-64 truncate text-xs text-muted-foreground">
            {loadingId === t.id ? "Opening..." : (t.note ?? `${t.lineCount} ${t.lineCount === 1 ? "line" : "lines"}`)}
          </span>
        </button>
      ),
    },
    { key: "route", header: "Route", cell: (t) => <Route from={t.fromWarehouse.code} to={t.toWarehouse.code} /> },
    { key: "status", header: "Status", cell: (t) => <StatusPill status={t.status} /> },
    {
      key: "received",
      header: "Received",
      className: "hidden md:table-cell",
      cell: (t) => <Progress done={t.receivedUnits} damaged={t.damagedUnits} total={t.requestedUnits} />,
    },
    {
      key: "shipped",
      header: "Shipped",
      className: "hidden whitespace-nowrap lg:table-cell",
      cell: (t) => <span className="text-muted-foreground">{t.shippedAt ? fmtDate(t.shippedAt) : "Not yet"}</span>,
    },
    { key: "by", header: "Started", className: "hidden whitespace-nowrap xl:table-cell", cell: (t) => <span className="text-muted-foreground">{fmtDate(t.createdAt)}{t.initiatedBy && ` by ${t.initiatedBy.name}`}</span> },
  ]

  return (
    <>
      <Kpis
        className="mx-4 xl:grid-cols-4 lg:mx-6"
        items={[
          { label: "To ship", value: n0(rows.filter((t) => t.status === "PENDING").length), hint: `${n0(drafts)} ${drafts === 1 ? "draft" : "drafts"} not approved` },
          { label: "On the way", value: n0(onTheWay.length), hint: `${n0(onTheWay.reduce((s, t) => s + t.requestedUnits - t.receivedUnits - t.damagedUnits, 0))} units still to arrive` },
          { label: "Completed", value: n0(rows.filter((t) => t.receivedAt && new Date(t.receivedAt).getTime() >= since).length), hint: "last 30 days" },
          { label: "Damaged on arrival", value: n0(rows.reduce((s, t) => s + t.damagedUnits, 0)), hint: "units, all transfers", warn: rows.some((t) => t.damagedUnits > 0) },
        ]}
      />
      <ListTable
        rows={visible}
        columns={columns}
        getRowId={(t) => t.id}
        searchText={(t) => `${t.transferNumber} ${t.fromWarehouse.code} ${t.toWarehouse.code} ${t.note ?? ""}`}
        searchPlaceholder="Search transfers..."
        filters={statusFilters<TransferListRow>([
          ["Open", OPEN],
          ["To ship", ["PENDING"]],
          ["On the way", ON_THE_WAY],
          ["Drafts", ["DRAFT"]],
          ["Done", ["COMPLETED", "CANCELLED"]],
          ["All", null],
        ])}
        emptyText="No transfers here."
        toolbar={
          <>
            <Select value={warehouse} items={warehouseItems} onValueChange={(v) => setWarehouse(v as string)}>
              <SelectTrigger size="sm" aria-label="Warehouse" className="hidden w-36 sm:flex"><SelectValue /></SelectTrigger>
              <SelectContent>
                {warehouseItems.map((w) => <SelectItem key={w.value} value={w.value}>{w.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={() => setOpen(null)}>
              <PlusIcon data-icon="inline-start" />
              New transfer
            </Button>
          </>
        }
      />

      {open !== undefined && (
        <TransferSheet
          key={open?.id ?? "new"}
          transfer={open}
          warehouses={warehouses}
          stock={stock}
          onChanged={changed}
          onReceive={() => setReceiving(true)}
          onClose={() => setOpen(undefined)}
        />
      )}
      {receiving && open && (
        <ReceiveDialog
          transfer={open}
          locations={locations}
          onReceived={(t) => {
            setReceiving(false)
            changed(t)
          }}
          onClose={() => setReceiving(false)}
        />
      )}
    </>
  )
}

function TransferSheet({
  transfer: t,
  warehouses,
  stock,
  onChanged,
  onReceive,
  onClose,
}: {
  transfer: Transfer | null
  warehouses: Warehouse[]
  stock: VariantStock[]
  onChanged: (t: Transfer | null) => Promise<void>
  onReceive: () => void
  onClose: () => void
}) {
  const [form, setForm] = useState(() => toForm(t, warehouses))
  const [busy, setBusy] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [shipping, setShipping] = useState<{ error: string; shortLines: ShortLine[] } | null | undefined>(undefined)

  const editing = !t || t.status === "DRAFT"
  const set = (patch: Partial<Form>) => setForm({ ...form, ...patch })
  const updateLine = (key: string, patch: Partial<FormLine>) => set({ items: form.items.map((l) => (l.key === key ? { ...l, ...patch } : l)) })

  const variants = stock.map((v) => ({ id: v.variantId, sku: v.sku, label: v.name !== v.sku ? `${v.product.name}, ${v.name}` : v.product.name }))
  const warehouseItems = warehouses.map((w) => ({ value: w.id, label: `${w.code} · ${w.name}` }))
  // What the source can send right now, to catch shortfalls before Ship.
  const availableAt = (variantId: string, warehouseId: string) =>
    stock.find((v) => v.variantId === variantId)?.levels.find((l) => l.warehouseId === warehouseId)?.available ?? 0
  const short = editing ? form.items.filter((l) => l.variantId && Number(l.quantity) > availableAt(l.variantId, form.fromWarehouseId)).length : 0

  async function run(work: () => Promise<{ success: true; data: Transfer } | { success: false; error: string }>, message: string) {
    setBusy(true)
    const res = await work()
    setBusy(false)
    if (!res.success) {
      toast.error(res.error)
      // Someone else moved it on; show what's saved now.
      if (t && res.error.includes("can't be")) {
        const fresh = await getTransfer(t.id)
        if (fresh.success) await onChanged(fresh.data)
      }
      return null
    }
    toast.success(message)
    await onChanged(res.data)
    return res.data
  }

  async function save() {
    const dto = toDto(form)
    if (typeof dto === "string") {
      toast.error(dto)
      return null
    }
    if (t) return run(() => updateTransfer(t.id, dto), "Draft saved")
    return run(() => createTransfer(dto), "Draft created")
  }

  async function approve() {
    if (form.items.length === 0) return toast.error("Add at least one line before approving.")
    const saved = await save()
    if (saved) await run(() => transferAction(saved.id, "approve"), `${saved.transferNumber} approved. Ship it when the parcel leaves.`)
  }

  async function ship() {
    setBusy(true)
    const res = await shipTransfer(t!.id)
    setBusy(false)
    // A shortfall keeps the dialog open with the short lines.
    if (!res.success) return setShipping({ error: res.error, shortLines: res.shortLines })
    setShipping(undefined)
    toast.success(`${t!.transferNumber} shipped`, { description: `Stock left ${t!.fromWarehouse.code} and counts as incoming at ${t!.toWarehouse.code}.` })
    await onChanged(res.data)
  }

  async function remove() {
    setDeleting(false)
    setBusy(true)
    const res = await deleteTransfer(t!.id)
    setBusy(false)
    if (!res.success) return toast.error(res.error)
    toast.success(`${t!.transferNumber} deleted`)
    await onChanged(null)
  }

  const lines = t?.items ?? []
  const requested = lines.reduce((s, l) => s + l.requestedQty, 0)
  const received = lines.reduce((s, l) => s + l.receivedQty, 0)
  const damaged = lines.reduce((s, l) => s + l.damagedQty, 0)
  const value = lines.reduce((s, l) => s + l.shippedQty * Number(l.unitCost ?? 0), 0)
  const from = warehouses.find((w) => w.id === form.fromWarehouseId)
  const to = warehouses.find((w) => w.id === form.toWarehouseId)

  let footer: React.ReactNode
  if (editing) {
    footer = (
      <>
        {t && (
          <Button variant="ghost" className="text-destructive" onClick={() => setDeleting(true)} disabled={busy}>
            Delete draft
          </Button>
        )}
        {t && (
          <Button variant="ghost" onClick={() => run(() => transferAction(t.id, "cancel"), `${t.transferNumber} cancelled`)} disabled={busy}>
            Cancel transfer
          </Button>
        )}
        <span className="flex-1" />
        <Button variant="outline" onClick={save} disabled={busy}>{t ? "Save draft" : "Create draft"}</Button>
        <Button onClick={approve} disabled={busy}>{t ? "Save and approve" : "Create and approve"}</Button>
      </>
    )
  } else if (t!.status === "PENDING") {
    footer = (
      <>
        <Button variant="ghost" className="text-destructive" onClick={() => run(() => transferAction(t!.id, "cancel"), `${t!.transferNumber} cancelled`)} disabled={busy}>
          Cancel transfer
        </Button>
        <span className="flex-1" />
        <Button onClick={() => setShipping(null)} disabled={busy}>Ship now</Button>
      </>
    )
  } else if (ON_THE_WAY.includes(t!.status)) {
    footer = (
      <>
        <span className="text-[13px] text-muted-foreground">Shipped transfers can’t be cancelled; receive what arrives, good or damaged.</span>
        <span className="flex-1" />
        <Button onClick={onReceive}>Receive at destination</Button>
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
    <DocSheet kind="Transfer" title={t?.transferNumber ?? "New transfer"} status={t?.status ?? "DRAFT"} footer={footer} onClose={onClose}>
      <section className="overflow-hidden rounded-2xl border bg-card">
        <div className="grid items-end gap-x-4 gap-y-3 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto]">
          <div className="min-w-0">
            <span className="mb-1 block text-xs text-muted-foreground">From</span>
            {editing ? (
              <Select value={form.fromWarehouseId || null} items={warehouseItems} onValueChange={(v) => set({ fromWarehouseId: v as string })}>
                <SelectTrigger aria-label="From warehouse" className="w-full"><SelectValue placeholder="Source" /></SelectTrigger>
                <SelectContent>
                  {warehouseItems.map((w) => <SelectItem key={w.value} value={w.value}>{w.label}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : (
              <div className="truncate font-semibold">{t!.fromWarehouse.name} <span className="font-mono text-xs text-muted-foreground">{t!.fromWarehouse.code}</span></div>
            )}
          </div>
          <ArrowRightIcon className="mb-2.5 hidden size-4 text-muted-foreground sm:block" />
          <div className="min-w-0">
            <span className="mb-1 block text-xs text-muted-foreground">To</span>
            {editing ? (
              <Select value={form.toWarehouseId || null} items={warehouseItems} onValueChange={(v) => set({ toWarehouseId: v as string })}>
                <SelectTrigger aria-label="To warehouse" className="w-full"><SelectValue placeholder="Destination" /></SelectTrigger>
                <SelectContent>
                  {warehouseItems.map((w) => <SelectItem key={w.value} value={w.value}>{w.label}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : (
              <div className="truncate font-semibold">{t!.toWarehouse.name} <span className="font-mono text-xs text-muted-foreground">{t!.toWarehouse.code}</span></div>
            )}
          </div>
          <div className="sm:text-right">
            <span className="mb-1 block text-xs text-muted-foreground">{editing ? "Units" : "Value shipped"}</span>
            <div className="text-xl font-bold tabular-nums">
              {editing ? n0(form.items.reduce((s, l) => s + (Number(l.quantity) || 0), 0)) : taka(value)}
            </div>
          </div>
        </div>
        {t && (
          <ul className="flex flex-wrap gap-x-8 gap-y-2 border-t bg-muted/30 px-4 py-2.5 text-[13px]">
            <li>
              <span className="block text-xs text-muted-foreground">Started</span>
              {fmtDateTime(t.createdAt)}
              {t.initiatedBy && ` by ${t.initiatedBy.name}`}
            </li>
            {t.shippedAt && (
              <li>
                <span className="block text-xs text-muted-foreground">Shipped</span>
                {fmtDateTime(t.shippedAt)}
              </li>
            )}
            {!editing && t.shippedAt && (
              <li>
                <span className="block text-xs text-muted-foreground">Received</span>
                {n0(received)} of {n0(requested)} units{damaged > 0 && `, ${n0(damaged)} damaged`}
              </li>
            )}
            {t.receivedAt && (
              <li>
                <span className="block text-xs text-muted-foreground">Completed</span>
                {fmtDateTime(t.receivedAt)}
                {t.receivedBy && ` by ${t.receivedBy.name}`}
              </li>
            )}
            {t.cancelledAt && (
              <li>
                <span className="block text-xs text-muted-foreground">Cancelled</span>
                {fmtDateTime(t.cancelledAt)}
              </li>
            )}
          </ul>
        )}
      </section>

      {editing && short > 0 && (
        <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[13px] text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
          {short} {short === 1 ? "line asks" : "lines ask"} for more than {from?.code ?? "the source"} has available. It can still be approved, but it won’t ship until the stock is there.
        </p>
      )}

      <Card title="Lines" action={<span className="text-muted-foreground">{n0(editing ? form.items.length : lines.length)} {(editing ? form.items.length : lines.length) === 1 ? "line" : "lines"}</span>}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr className="border-y [&>th]:px-3 [&>th]:py-2.5 [&>th]:font-medium [&>th]:whitespace-nowrap [&>th:first-child]:pl-4 [&>th:last-child]:pr-4">
                <th>Item</th>
                {editing && <th className="text-right">Available at {from?.code ?? "source"}</th>}
                <th className="text-right">{editing ? "Send" : "Requested"}</th>
                {!editing && <th className="text-right">Shipped</th>}
                {!editing && <th className="text-right">Received</th>}
                {!editing && <th className="text-right">Damaged</th>}
                {!editing && <th className="text-right">On the road</th>}
                {!editing && <th className="text-right">Unit cost</th>}
                {editing && <th className="w-10"><span className="sr-only">Remove</span></th>}
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {editing &&
                form.items.map((l) => {
                  const available = availableAt(l.variantId, form.fromWarehouseId)
                  const tooMany = Boolean(l.variantId) && Number(l.quantity) > available
                  return (
                    <tr key={l.key} className="border-b border-border/60 last:border-b-0 [&>td]:px-3 [&>td]:py-2.5 [&>td:first-child]:pl-4 [&>td:last-child]:pr-4">
                      <td className="min-w-64">
                        <VariantSelect options={variants} value={l.variantId} onChange={(variantId) => updateLine(l.key, { variantId })} />
                        <div className="mt-1 pl-0.5 font-mono text-[11.5px] text-muted-foreground">{variants.find((v) => v.id === l.variantId)?.sku ?? "Pick an item"}</div>
                      </td>
                      <td className={cn("text-right", tooMany ? "font-semibold text-amber-700 dark:text-amber-400" : "text-muted-foreground")}>{l.variantId ? n0(available) : "—"}</td>
                      <td className="text-right">
                        <Input aria-label="Quantity" inputMode="numeric" className={cn(cellInput, "ml-auto", tooMany && "border-amber-500")} value={l.quantity} onChange={(e) => updateLine(l.key, { quantity: e.target.value })} />
                      </td>
                      <td>
                        <Button size="icon-sm" variant="ghost" className="text-muted-foreground hover:text-destructive" aria-label="Remove line" onClick={() => set({ items: form.items.filter((x) => x.key !== l.key) })}>
                          <Trash2Icon />
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              {!editing &&
                lines.map((l) => (
                  <tr key={l.id} className="border-b border-border/60 last:border-b-0 [&>td]:px-3 [&>td]:py-2.5 [&>td:first-child]:pl-4 [&>td:last-child]:pr-4">
                    <td className="min-w-56">
                      <div className="font-medium">{lineName(l)}</div>
                      <div className="font-mono text-[11.5px] text-muted-foreground">{l.variant.sku}</div>
                      {l.batches && l.batches.length > 0 && (
                        <div className="mt-0.5 text-[11.5px] text-muted-foreground">
                          Batches:{" "}
                          {l.batches.map((b, i) => (
                            <span key={b.batchId}>
                              {i > 0 && ", "}
                              <span className="font-mono text-foreground">{b.batchNumber}</span>
                              {b.expiresAt && ` (exp ${fmtDate(b.expiresAt)})`} × {n0(b.quantity)}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="text-right">{n0(l.requestedQty)}</td>
                    <td className="text-right text-muted-foreground">{n0(l.shippedQty)}</td>
                    <td className="text-right">{n0(l.receivedQty)}</td>
                    <td className="text-right">{l.damagedQty ? <span className="font-semibold text-destructive">{n0(l.damagedQty)}</span> : <span className="text-muted-foreground/60">0</span>}</td>
                    <td className="text-right font-semibold">{n0(l.outstandingQty)}</td>
                    <td className="text-right text-muted-foreground">{l.unitCost ? taka(Number(l.unitCost), 2) : "—"}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        {editing && (
          <div className="border-t px-4 py-2.5">
            <Button size="sm" variant="outline" onClick={() => set({ items: [...form.items, newLine()] })}>
              <PlusIcon data-icon="inline-start" />
              Add line
            </Button>
          </div>
        )}
      </Card>

      <Card title="Note">
        <div className="px-4 pb-4">
          {editing ? (
            <Textarea rows={2} maxLength={1000} placeholder="Why it's moving, how it's sent" value={form.note} onChange={(e) => set({ note: e.target.value })} />
          ) : (
            <p className="text-muted-foreground">{t!.note || "No note."}</p>
          )}
        </div>
      </Card>

      {deleting && t && (
        <Dialog open onOpenChange={(o) => !o && setDeleting(false)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Delete {t.transferNumber}?</DialogTitle>
              <DialogDescription>The draft and its lines are removed. It was never shipped, so no stock changes.</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleting(false)}>Keep it</Button>
              <Button variant="destructive" onClick={remove}>Delete draft</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {shipping !== undefined && t && (
        <Dialog open onOpenChange={(o) => !o && setShipping(undefined)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{shipping ? `Not enough stock at ${t.fromWarehouse.code}` : `Ship ${t.transferNumber}?`}</DialogTitle>
              <DialogDescription>
                {shipping
                  ? "Every line ships in full or nothing does, so nothing was shipped."
                  : `Takes the units out of ${t.fromWarehouse.code} now (and off the storefront if it sells), keeps each line's current average cost, and adds them to ${t.toWarehouse.code}'s incoming until they're received. Once shipped it can't be cancelled.`}
              </DialogDescription>
            </DialogHeader>
            {shipping && (
              <div className="flex flex-col gap-2 text-sm">
                <ul className="rounded-lg border bg-muted/40 px-3 py-2">
                  {shipping.shortLines.map((s) => (
                    <li key={s.variantId} className="font-mono text-[13px]">
                      {s.sku}: wanted {n0(s.wanted)}, available {n0(s.available)}
                    </li>
                  ))}
                  {shipping.shortLines.length === 0 && <li>{shipping.error}</li>}
                </ul>
                <p className="text-[13px] text-muted-foreground">
                  Restock {t.fromWarehouse.code} and ship again, or cancel this transfer and create a new one with smaller quantities.
                </p>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShipping(undefined)}>{shipping ? "Close" : "Not yet"}</Button>
              <Button onClick={ship} disabled={busy}>{shipping ? "Try again" : "Ship now"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </DocSheet>
  )
}

type ReceiveRow = { good: string; damaged: string; rack: string }

// Good units go into the destination at the cost they shipped with; damaged ones go to its damage section.
function ReceiveDialog({
  transfer: t,
  locations,
  onReceived,
  onClose,
}: {
  transfer: Transfer
  locations: StorageLocation[]
  onReceived: (t: Transfer) => void
  onClose: () => void
}) {
  const lines = t.items.filter((l) => l.outstandingQty > 0)
  const [rows, setRows] = useState<Record<string, ReceiveRow>>(() =>
    Object.fromEntries(lines.map((l) => [l.id, { good: String(l.outstandingQty), damaged: "0", rack: DEFAULT_RACK }]))
  )
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const update = (id: string, patch: Partial<ReceiveRow>) => {
    setRows({ ...rows, [id]: { ...rows[id], ...patch } })
    setError("")
  }

  // Bins at the destination that hold stock directly; "Default rack" falls back to the item's default.
  const racks = [
    { value: DEFAULT_RACK, label: "Default rack" },
    ...locations
      .filter((l) => l.warehouse.id === t.toWarehouseId && l.isActive && l.type !== "ZONE" && l.type !== "AISLE" && l.code !== "UNASSIGNED" && l.type !== "DAMAGE" && !locations.some((c) => c.parentId === l.id))
      .sort((a, b) => a.code.localeCompare(b.code))
      .map((l) => ({ value: l.id, label: l.code })),
  ]

  async function submit() {
    const body: { itemId: string; receivedQty: number; damagedQty?: number; locationId?: string }[] = []
    for (const l of lines) {
      const r = rows[l.id]
      if (!wholeNumber(r.good) || !wholeNumber(r.damaged)) return setError("Enter whole numbers.")
      const good = Number(r.good)
      const damaged = Number(r.damaged)
      if (good + damaged === 0) continue
      if (good + damaged > l.outstandingQty) return setError(`${l.variant.sku}: only ${l.outstandingQty} on the road.`)
      body.push({ itemId: l.id, receivedQty: good, damagedQty: damaged || undefined, locationId: r.rack !== DEFAULT_RACK ? r.rack : undefined })
    }
    if (body.length === 0) return setError("Enter a quantity for at least one line.")
    setSaving(true)
    const res = await receiveTransfer(t.id, { lines: body })
    setSaving(false)
    if (!res.success) return setError(res.error)
    toast.success(res.data.status === "COMPLETED" ? "Everything received" : "Received. Some units are still on the road.")
    onReceived(res.data)
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Receive {t.transferNumber} at {t.toWarehouse.code}</DialogTitle>
          <DialogDescription>
            Good units go into {t.toWarehouse.code} at the cost they shipped with. Damaged units are booked in, then moved to its damage section (not for sale).
            Incoming drops by both. You can receive in several steps.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[50vh] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-background text-left text-xs text-muted-foreground">
              <tr className="border-b [&>th]:py-2 [&>th]:pr-2 [&>th]:font-medium">
                <th>Item</th>
                <th className="text-right">On the road</th>
                <th className="text-right">Good</th>
                <th className="text-right">Damaged</th>
                <th>Put on rack</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => {
                const r = rows[l.id]
                return (
                  <tr key={l.id} className="border-b last:border-b-0 [&>td]:py-2 [&>td]:pr-2">
                    <td className="min-w-48">
                      <div className="font-medium">{lineName(l)}</div>
                      <div className="font-mono text-[11px] text-muted-foreground">{l.variant.sku}</div>
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
