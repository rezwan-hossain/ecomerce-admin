"use client"

import { useState } from "react"
import { PlusIcon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"

import { adjustmentAction, createAdjustment, getAdjustment, getAdjustments, updateAdjustment } from "@/app/actions/adjustment.actions"
import { ListTable, type ListColumn } from "@/components/list-table"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
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
import type { Adjustment, AdjustmentDto, AdjustmentListRow, AdjustmentReason, AdjustmentType } from "@/types/adjustment.type"
import type { StorageLocation, VariantStock } from "@/types/inventory.type"
import type { Warehouse } from "@/types/warehouse.type"

import { cellInput, DocSheet, statusFilters, VariantSelect, wholeNumber } from "./doc-bits"
import { Card, fmtDate, fmtDateTime, Kpis, label, n0, RackTag, signed, StatusPill, taka, WarehouseTag } from "./inventory-ui"

const TYPES: AdjustmentType[] = ["CYCLE_COUNT", "INCREASE", "DECREASE"]
const TYPE_LABEL: Record<AdjustmentType, string> = { CYCLE_COUNT: "Stock count", INCREASE: "Add stock", DECREASE: "Remove stock" }
const REASONS: AdjustmentReason[] = ["CYCLE_COUNT", "DAMAGE", "THEFT", "LOSS", "EXPIRY", "CORRECTION", "OPENING_STOCK", "PROMOTIONAL", "OTHER"]
// A sensible starting reason for each type.
const DEFAULT_REASON: Record<AdjustmentType, AdjustmentReason> = { CYCLE_COUNT: "CYCLE_COUNT", INCREASE: "CORRECTION", DECREASE: "DAMAGE" }
const WHOLE = "whole"
const ALL = "all"
const DAY = 86_400_000

function Change({ n }: { n: number }) {
  if (n > 0) return <span className="font-bold text-emerald-700 dark:text-emerald-400">{signed(n)}</span>
  if (n < 0) return <span className="font-bold text-destructive">{signed(n)}</span>
  return <span className="text-muted-foreground">0</span>
}

// The form keeps quantities as typed; `toDto` checks and converts them.
type FormLine = { key: string; variantId: string; warehouseId: string; locationId: string; qty: string }
type Form = { type: AdjustmentType; reason: AdjustmentReason; note: string; items: FormLine[] }

const newLine = (warehouseId: string): FormLine => ({ key: crypto.randomUUID(), variantId: "", warehouseId, locationId: WHOLE, qty: "" })

function toForm(a: Adjustment | null, defaultWarehouseId: string): Form {
  if (!a) return { type: "CYCLE_COUNT", reason: "CYCLE_COUNT", note: "", items: [newLine(defaultWarehouseId)] }
  return {
    type: a.type,
    reason: a.reason,
    note: a.note ?? "",
    items: a.items.map((l) => ({
      key: l.id,
      variantId: l.variantId,
      warehouseId: l.warehouseId,
      locationId: l.locationId ?? WHOLE,
      qty: String(a.type === "CYCLE_COUNT" ? (l.actualQty ?? 0) : Math.abs(l.adjustmentQty)),
    })),
  }
}

// Returns the body, or a message for the first problem.
function toDto(form: Form): AdjustmentDto | string {
  if (form.items.length === 0) return "Add at least one line."
  const seen = new Set<string>()
  const items: AdjustmentDto["items"] = []
  for (const [index, l] of form.items.entries()) {
    const line = `Line ${index + 1}`
    if (!l.variantId) return `${line}: pick an item.`
    if (!l.warehouseId) return `${line}: pick a warehouse.`
    if (!wholeNumber(l.qty)) return `${line}: enter a whole number.`
    const qty = Number(l.qty)
    if (form.type !== "CYCLE_COUNT" && qty < 1) return `${line}: enter at least 1.`
    const place = `${l.variantId}|${l.warehouseId}|${l.locationId}`
    if (seen.has(place)) return `${line}: the same item and place appear twice.`
    seen.add(place)
    const locationId = l.locationId === WHOLE ? null : l.locationId
    if (form.type === "CYCLE_COUNT") items.push({ variantId: l.variantId, warehouseId: l.warehouseId, locationId, actualQty: qty })
    // People type what to remove; the API wants a negative change.
    if (form.type === "INCREASE") items.push({ variantId: l.variantId, warehouseId: l.warehouseId, locationId, adjustmentQty: qty })
    if (form.type === "DECREASE") items.push({ variantId: l.variantId, warehouseId: l.warehouseId, locationId, adjustmentQty: -qty })
  }
  return { type: form.type, reason: form.reason, note: form.note.trim() || null, items }
}

export function Adjustments({
  initialAdjustments,
  warehouses,
  stock,
  locations,
}: {
  initialAdjustments: AdjustmentListRow[]
  warehouses: Warehouse[]
  stock: VariantStock[]
  locations: StorageLocation[]
}) {
  const [rows, setRows] = useState(initialAdjustments)
  // undefined = closed, null = a new adjustment, otherwise the open one (loaded with its lines)
  const [open, setOpen] = useState<Adjustment | null | undefined>(undefined)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [warehouseId, setWarehouseId] = useState(ALL)
  const [type, setType] = useState(ALL)

  async function refreshList(filter = warehouseId) {
    const res = await getAdjustments(filter === ALL ? undefined : filter)
    if (res.success) setRows(res.data)
  }

  async function openAdjustment(id: string) {
    setLoadingId(id)
    const res = await getAdjustment(id)
    setLoadingId(null)
    if (!res.success) return toast.error(res.error)
    setOpen(res.data)
  }

  async function changed(a: Adjustment) {
    setOpen(a)
    await refreshList()
  }

  async function filterWarehouse(id: string) {
    setWarehouseId(id)
    await refreshList(id)
  }

  const since = Date.now() - 30 * DAY
  const visible = rows.filter((a) => type === ALL || a.type === type)
  const warehouseItems = [{ value: ALL, label: "All warehouses" }, ...warehouses.map((w) => ({ value: w.id, label: w.code }))]
  const typeItems = [{ value: ALL, label: "All types" }, ...TYPES.map((t) => ({ value: t, label: TYPE_LABEL[t] }))]

  const columns: ListColumn<AdjustmentListRow>[] = [
    {
      key: "number",
      header: "Adjustment",
      cell: (a) => (
        <button type="button" className="text-left" onClick={() => openAdjustment(a.id)} disabled={loadingId !== null}>
          <span className="font-semibold text-primary hover:underline">{a.adjustmentNumber}</span>
          <span className="block max-w-64 truncate text-xs text-muted-foreground">{loadingId === a.id ? "Opening..." : (a.note ?? `${a.lineCount} ${a.lineCount === 1 ? "line" : "lines"}`)}</span>
        </button>
      ),
    },
    { key: "type", header: "Type", className: "hidden md:table-cell", cell: (a) => TYPE_LABEL[a.type] },
    { key: "reason", header: "Reason", cell: (a) => label(a.reason) },
    { key: "status", header: "Status", cell: (a) => <StatusPill status={a.status} /> },
    { key: "lines", header: "Lines", className: "hidden text-right tabular-nums sm:table-cell", cell: (a) => n0(a.lineCount) },
    {
      key: "created",
      header: "Created",
      className: "hidden whitespace-nowrap lg:table-cell",
      cell: (a) => (
        <span className="flex flex-col text-muted-foreground">
          {fmtDate(a.createdAt)}
          {a.createdBy && <span className="text-xs">by {a.createdBy.name}</span>}
        </span>
      ),
    },
    {
      key: "done",
      header: "Approved / applied",
      className: "hidden whitespace-nowrap xl:table-cell",
      cell: (a) => (
        <span className="flex flex-col text-xs text-muted-foreground">
          {a.approvedAt ? <span>Approved {fmtDate(a.approvedAt)}{a.approvedBy && ` by ${a.approvedBy.name}`}</span> : <span>—</span>}
          {a.appliedAt && <span className="text-emerald-700 dark:text-emerald-400">Applied {fmtDate(a.appliedAt)}</span>}
        </span>
      ),
    },
  ]

  return (
    <>
      <Kpis
        className="mx-4 xl:grid-cols-4 lg:mx-6"
        items={[
          { label: "Waiting approval", value: n0(rows.filter((a) => a.status === "PENDING").length), hint: "check, then approve", warn: rows.some((a) => a.status === "PENDING") },
          { label: "Ready to apply", value: n0(rows.filter((a) => a.status === "APPROVED").length), hint: "approved, stock not changed yet" },
          { label: "Applied", value: n0(rows.filter((a) => a.appliedAt && new Date(a.appliedAt).getTime() >= since).length), hint: "last 30 days" },
          { label: "Rejected or cancelled", value: n0(rows.filter((a) => a.status === "REJECTED" || a.status === "CANCELLED").length), hint: "never changed stock" },
        ]}
      />
      <ListTable
        rows={visible}
        columns={columns}
        getRowId={(a) => a.id}
        searchText={(a) => `${a.adjustmentNumber} ${a.note ?? ""} ${label(a.reason)} ${TYPE_LABEL[a.type]}`}
        searchPlaceholder="Search adjustments..."
        filters={statusFilters<AdjustmentListRow>([
          ["Open", ["PENDING", "APPROVED"]],
          ["Waiting approval", ["PENDING"]],
          ["Ready to apply", ["APPROVED"]],
          ["Done", ["APPLIED", "REJECTED", "CANCELLED"]],
          ["All", null],
        ])}
        emptyText="No adjustments here."
        toolbar={
          <>
            <Select value={warehouseId} items={warehouseItems} onValueChange={(v) => filterWarehouse(v as string)}>
              <SelectTrigger size="sm" aria-label="Warehouse" className="hidden w-32 sm:flex"><SelectValue /></SelectTrigger>
              <SelectContent>
                {warehouseItems.map((w) => <SelectItem key={w.value} value={w.value}>{w.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={type} items={typeItems} onValueChange={(v) => setType(v as string)}>
              <SelectTrigger size="sm" aria-label="Type" className="hidden w-36 2xl:flex"><SelectValue /></SelectTrigger>
              <SelectContent>
                {typeItems.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={() => setOpen(null)}>
              <PlusIcon data-icon="inline-start" />
              New adjustment
            </Button>
          </>
        }
      />

      {open !== undefined && (
        <AdjustmentSheet
          key={open?.id ?? "new"}
          adjustment={open}
          warehouses={warehouses}
          stock={stock}
          locations={locations}
          onChanged={changed}
          onClose={() => setOpen(undefined)}
        />
      )}
    </>
  )
}

function AdjustmentSheet({
  adjustment: a,
  warehouses,
  stock,
  locations,
  onChanged,
  onClose,
}: {
  adjustment: Adjustment | null
  warehouses: Warehouse[]
  stock: VariantStock[]
  locations: StorageLocation[]
  onChanged: (a: Adjustment) => Promise<void>
  onClose: () => void
}) {
  const defaultWarehouseId = warehouses.find((w) => w.isDefault)?.id ?? warehouses[0]?.id ?? ""
  const [form, setForm] = useState(() => toForm(a, defaultWarehouseId))
  const [busy, setBusy] = useState(false)
  const [applying, setApplying] = useState(false)

  const editing = !a || a.status === "PENDING"
  const count = form.type === "CYCLE_COUNT"
  const set = (patch: Partial<Form>) => setForm({ ...form, ...patch })
  const updateLine = (key: string, patch: Partial<FormLine>) => set({ items: form.items.map((l) => (l.key === key ? { ...l, ...patch } : l)) })

  const variants = stock.map((v) => ({ id: v.variantId, sku: v.sku, label: v.name !== v.sku ? `${v.product.name}, ${v.name}` : v.product.name }))
  const warehouseItems = warehouses.map((w) => ({ value: w.id, label: w.code }))
  const typeItems = TYPES.map((t) => ({ value: t, label: TYPE_LABEL[t] }))
  const reasonItems = REASONS.map((r) => ({ value: r, label: label(r) }))

  // Bins that hold stock directly: no zones or aisles, nothing with children.
  const binsOf = (warehouseId: string) => [
    { value: WHOLE, label: "Whole warehouse" },
    ...locations
      .filter((l) => l.warehouse.id === warehouseId && l.isActive && l.type !== "ZONE" && l.type !== "AISLE" && l.type !== "DAMAGE" && !locations.some((c) => c.parentId === l.id))
      .sort((x, y) => x.code.localeCompare(y.code))
      .map((l) => ({ value: l.id, label: l.code })),
  ]

  // What the system holds now, as a preview; the server snapshots its own number on save.
  function systemQty(l: FormLine) {
    const level = stock.find((v) => v.variantId === l.variantId)?.levels.find((x) => x.warehouseId === l.warehouseId)
    if (!level) return 0
    if (l.locationId === WHOLE) return level.onHand
    return level.locationStocks.find((s) => s.location.id === l.locationId)?.quantity ?? 0
  }
  function previewChange(l: FormLine) {
    const qty = Number(l.qty) || 0
    if (count) return l.qty === "" ? 0 : qty - systemQty(l)
    if (form.type === "DECREASE") return -qty
    return qty
  }

  async function run(work: () => Promise<{ success: true; data: Adjustment } | { success: false; error: string }>, message: string) {
    setBusy(true)
    const res = await work()
    setBusy(false)
    if (!res.success) {
      toast.error(res.error)
      // Someone else moved it on; show what's saved now.
      if (a && res.error.includes("can't be")) {
        const fresh = await getAdjustment(a.id)
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
    if (a) return run(() => updateAdjustment(a.id, { reason: dto.reason, note: dto.note, items: dto.items }), "Saved")
    return run(() => createAdjustment(dto), "Adjustment created. Approve it, then apply it to change stock.")
  }

  async function approve() {
    const saved = await save()
    if (saved) await run(() => adjustmentAction(saved.id, "approve"), `${saved.adjustmentNumber} approved. Apply it to change stock.`)
  }

  async function apply() {
    setApplying(false)
    await run(() => adjustmentAction(a!.id, "apply"), `${a!.adjustmentNumber} applied. Stock and the movements ledger are updated.`)
  }

  const lines = a?.items ?? []
  const net = editing ? form.items.reduce((s, l) => s + previewChange(l), 0) : lines.reduce((s, l) => s + l.adjustmentQty, 0)
  const value = lines.reduce((s, l) => s + l.adjustmentQty * Number(l.unitCost ?? 0), 0)

  let qtyHeader = "Qty to add"
  if (form.type === "DECREASE") qtyHeader = "Qty to remove"
  if (count) qtyHeader = "Counted"

  let footer: React.ReactNode
  if (editing) {
    footer = (
      <>
        {a && (
          <Button variant="ghost" className="text-destructive" onClick={() => run(() => adjustmentAction(a.id, "cancel"), `${a.adjustmentNumber} cancelled`)} disabled={busy}>
            Cancel
          </Button>
        )}
        {a && (
          <Button variant="ghost" onClick={() => run(() => adjustmentAction(a.id, "reject"), `${a.adjustmentNumber} rejected`)} disabled={busy}>
            Reject
          </Button>
        )}
        <span className="flex-1" />
        <Button variant="outline" onClick={save} disabled={busy}>{a ? "Save" : "Create"}</Button>
        <Button onClick={approve} disabled={busy}>{a ? "Save and approve" : "Create and approve"}</Button>
      </>
    )
  } else if (a!.status === "APPROVED") {
    footer = (
      <>
        <Button variant="ghost" className="text-destructive" onClick={() => run(() => adjustmentAction(a!.id, "cancel"), `${a!.adjustmentNumber} cancelled`)} disabled={busy}>
          Cancel
        </Button>
        <span className="flex-1" />
        <Button onClick={() => setApplying(true)} disabled={busy}>Apply to stock</Button>
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
    <DocSheet kind="Stock adjustment" title={a?.adjustmentNumber ?? "New adjustment"} status={a?.status ?? "PENDING"} footer={footer} onClose={onClose}>
      <section className="overflow-hidden rounded-2xl border bg-card">
        <div className="grid gap-x-6 gap-y-4 px-4 py-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
          <div>
            <span className="mb-1 block text-xs text-muted-foreground">Type</span>
            {a ? (
              <div className="font-semibold">{TYPE_LABEL[a.type]}</div>
            ) : (
              // Fixed after create, so only a new adjustment can pick it.
              <Select value={form.type} items={typeItems} onValueChange={(v) => set({ type: v as AdjustmentType, reason: DEFAULT_REASON[v as AdjustmentType] })}>
                <SelectTrigger aria-label="Type" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {typeItems.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>
          <div>
            <span className="mb-1 block text-xs text-muted-foreground">Reason</span>
            {editing ? (
              <Select value={form.reason} items={reasonItems} onValueChange={(v) => set({ reason: v as AdjustmentReason })}>
                <SelectTrigger aria-label="Reason" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {reasonItems.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : (
              <div className="font-semibold">{label(a!.reason)}</div>
            )}
            {form.type === "DECREASE" && form.reason === "DAMAGE" && (
              <p className="mt-1 text-xs text-muted-foreground">On apply, the removed units move to the warehouse's damage section.</p>
            )}
          </div>
          <div className="lg:text-right">
            <span className="mb-1 block text-xs text-muted-foreground">{editing ? "Net change (preview)" : "Net change"}</span>
            <div className="text-2xl leading-tight font-bold tabular-nums"><Change n={net} /></div>
            {!editing && value !== 0 && <div className="text-xs text-muted-foreground">{value > 0 ? "+" : "−"}{taka(Math.abs(value))} at unit cost</div>}
          </div>
        </div>
        {a && (
          <ul className="flex flex-wrap gap-x-8 gap-y-2 border-t bg-muted/30 px-4 py-2.5 text-[13px]">
            <li>
              <span className="block text-xs text-muted-foreground">Created</span>
              {fmtDateTime(a.createdAt)}
              {a.createdBy && ` by ${a.createdBy.name}`}
            </li>
            {a.approvedAt && (
              <li>
                <span className="block text-xs text-muted-foreground">Approved</span>
                {fmtDateTime(a.approvedAt)}
                {a.approvedBy && ` by ${a.approvedBy.name}`}
              </li>
            )}
            {a.appliedAt && (
              <li>
                <span className="block text-xs text-muted-foreground">Applied to stock</span>
                {fmtDateTime(a.appliedAt)}
              </li>
            )}
          </ul>
        )}
      </section>

      {editing && (
        <p className="rounded-xl bg-primary/10 px-3.5 py-2.5 text-[13px] text-primary">
          {count && "Enter what you physically counted. When it's applied, stock is set to the counted number, even if it moved since the count."}
          {form.type === "INCREASE" && "Enter how many units to add."}
          {form.type === "DECREASE" && "Enter how many units to remove."} Stock only changes once it's approved and applied.
        </p>
      )}

      <Card title="Lines" action={<span className="text-muted-foreground">{n0(editing ? form.items.length : lines.length)} {(editing ? form.items.length : lines.length) === 1 ? "line" : "lines"}</span>}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr className="border-y [&>th]:px-3 [&>th]:py-2.5 [&>th]:font-medium [&>th]:whitespace-nowrap [&>th:first-child]:pl-4 [&>th:last-child]:pr-4">
                <th>Item</th>
                <th>Warehouse</th>
                <th>Rack or bin</th>
                <th className="text-right">{editing ? "System now" : "System qty"}</th>
                <th className="text-right">{qtyHeader}</th>
                <th className="text-right">Change</th>
                {editing && <th className="w-10"><span className="sr-only">Remove</span></th>}
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {editing &&
                form.items.map((l) => {
                  const bins = binsOf(l.warehouseId)
                  return (
                    <tr key={l.key} className="border-b border-border/60 last:border-b-0 [&>td]:px-3 [&>td]:py-2.5 [&>td:first-child]:pl-4 [&>td:last-child]:pr-4">
                      <td className="min-w-64">
                        <VariantSelect options={variants} value={l.variantId} onChange={(variantId) => updateLine(l.key, { variantId })} />
                        <div className="mt-1 pl-0.5 font-mono text-[11.5px] text-muted-foreground">{variants.find((v) => v.id === l.variantId)?.sku ?? "Pick an item"}</div>
                      </td>
                      <td>
                        <Select value={l.warehouseId || null} items={warehouseItems} onValueChange={(v) => updateLine(l.key, { warehouseId: v as string, locationId: WHOLE })}>
                          <SelectTrigger aria-label="Warehouse" size="sm" className="w-full min-w-28"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {warehouseItems.map((w) => <SelectItem key={w.value} value={w.value}>{w.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </td>
                      <td>
                        <Select value={l.locationId} items={bins} onValueChange={(v) => updateLine(l.key, { locationId: v as string })}>
                          <SelectTrigger aria-label="Rack or bin" size="sm" className="w-full min-w-36"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {bins.map((b) => <SelectItem key={b.value} value={b.value}>{b.value === WHOLE ? b.label : <RackTag code={b.label} />}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="text-right text-muted-foreground">{l.variantId ? n0(systemQty(l)) : "—"}</td>
                      <td className="text-right">
                        <Input aria-label={count ? "Counted" : "Quantity"} inputMode="numeric" placeholder="0" className={cn(cellInput, "ml-auto")} value={l.qty} onChange={(e) => updateLine(l.key, { qty: e.target.value })} />
                      </td>
                      <td className="text-right"><Change n={previewChange(l)} /></td>
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
                      <div className="font-medium">{l.variant.label ? `${l.variant.productName}, ${l.variant.label}` : l.variant.productName}</div>
                      <div className="font-mono text-[11.5px] text-muted-foreground">{l.variant.sku}</div>
                    </td>
                    <td><WarehouseTag code={l.warehouse.code} /></td>
                    <td>{l.location ? <RackTag code={l.location.code} /> : <span className="text-muted-foreground">Whole warehouse</span>}</td>
                    <td className="text-right text-muted-foreground">{l.expectedQty === null ? "—" : n0(l.expectedQty)}</td>
                    <td className="text-right">{a!.type === "CYCLE_COUNT" ? n0(l.actualQty ?? 0) : n0(Math.abs(l.adjustmentQty))}</td>
                    <td className="text-right"><Change n={l.adjustmentQty} /></td>
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
      </Card>

      <Card title="Note">
        <div className="px-4 pb-4">
          {editing ? (
            <Textarea rows={2} maxLength={1000} placeholder="What happened" value={form.note} onChange={(e) => set({ note: e.target.value })} />
          ) : (
            <p className="text-muted-foreground">{a!.note || "No note."}</p>
          )}
        </div>
      </Card>

      {applying && a && (
        <Dialog open onOpenChange={(o) => !o && setApplying(false)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Apply {a.adjustmentNumber} to stock?</DialogTitle>
              <DialogDescription>
                Each line with a change writes one stock movement tagged {a.adjustmentNumber}, visible on the Movements page.
                {a.type === "CYCLE_COUNT" && " Counts are re-based on stock at this moment, so each place ends up at exactly the counted number."}
                {" "}This can’t be undone; a mistake needs a new adjustment.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setApplying(false)}>Not yet</Button>
              <Button onClick={apply}>Apply to stock</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </DocSheet>
  )
}
