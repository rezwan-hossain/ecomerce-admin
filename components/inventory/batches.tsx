"use client"

import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"
import { ArrowRightIcon, ScanBarcodeIcon } from "lucide-react"
import { toast } from "sonner"

import { getBatch, lookupBatch, quarantineBatch, releaseBatch, updateBatch, writeOffBatch } from "@/app/actions/batch.actions"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import type { Batch, BatchDetail, WriteOffReason } from "@/types/batch.type"
import type { MovementType } from "@/types/inventory.type"
import type { Warehouse } from "@/types/warehouse.type"

import { DocSheet } from "./doc-bits"
import { Card, fmtDate, fmtDateTime, Kpis, label, n0, Pill, RackTag, StatusPill, taka, WarehouseTag } from "./inventory-ui"
import { MovementTag } from "./movements-table"
import { Pager, ParamSearch, ParamSelect, SortHeader, withParams } from "./reports/report-bits"

const HOLDING = ["VIRTUAL_QC", "VIRTUAL_DAMAGE"]
const REASONS: { value: WriteOffReason; label: string; help: string }[] = [
  { value: "EXPIRED", label: "Expired", help: "Takes every unit left; the batch becomes Expired." },
  { value: "DAMAGED", label: "Damaged", help: "Moves the units to the warehouse's damaged count." },
  { value: "RECALLED", label: "Recalled", help: "Takes every unit left; the batch becomes Recalled." },
  { value: "OTHER", label: "Other", help: "Removes the units from stock." },
]

// The expiry date with a badge: red when past, amber within 30 days.
export function ExpiryBadge({ batch }: { batch: Pick<Batch, "expiresAt" | "expiry"> }) {
  if (batch.expiry.state === "NO_EXPIRY") return <span className="text-muted-foreground">No expiry</span>
  let badge = null
  if (batch.expiry.state === "EXPIRED") badge = <Pill tone="red">Expired</Pill>
  if (batch.expiry.state === "EXPIRING_SOON") badge = <Pill tone="amber">in {n0(batch.expiry.daysLeft ?? 0)} days</Pill>
  return (
    <span className="flex flex-col items-start gap-0.5 whitespace-nowrap">
      {fmtDate(batch.expiresAt)}
      {badge}
    </span>
  )
}

const TABS: { text: string; patch: Record<string, string | null> }[] = [
  { text: "Expiring soon", patch: { expiry: "EXPIRING", inStock: "true", status: null } },
  { text: "Expired on shelf", patch: { expiry: "EXPIRED", inStock: "true", status: null } },
  { text: "Quarantined", patch: { status: "QUARANTINED", expiry: null, inStock: null } },
  { text: "In stock", patch: { inStock: "true", expiry: null, status: null } },
  { text: "All", patch: { inStock: null, expiry: null, status: null } },
]

export function Batches({
  batches,
  meta,
  filters,
  warehouses,
  summary,
}: {
  batches: Batch[]
  meta: { total: number; page: number; totalPages: number }
  filters: { search: string; warehouseId: string; status: string; expiry: string; inStock: string; sortBy: string; sortOrder: string }
  warehouses: Warehouse[]
  summary: { expiring: number; expired: number; quarantined: number }
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [openId, setOpenId] = useState<string | null>(null)
  const [code, setCode] = useState("")
  const [matches, setMatches] = useState<Batch[] | null>(null)

  const go = (patch: Record<string, string | null>) => router.push(withParams(pathname, params, patch))
  const sort = { sortBy: filters.sortBy, sortOrder: filters.sortOrder }
  const warehouseItems = [{ value: "all", label: "All warehouses" }, ...warehouses.map((w) => ({ value: w.id, label: w.code }))]
  const activeTab = TABS.find((t) => Object.entries(t.patch).every(([key, value]) => (filters[key as keyof typeof filters] || null) === value))

  // A barcode scanner types the code and presses Enter, so this handles both.
  async function lookup(e: React.FormEvent) {
    e.preventDefault()
    if (!code.trim()) return
    const res = await lookupBatch(code.trim())
    if (!res.success) return toast.error(res.error)
    if (res.data.length === 0) {
      setMatches(null)
      return toast.error(`No batch with the number “${code.trim()}”`)
    }
    if (res.data.length === 1) {
      setMatches(null)
      return setOpenId(res.data[0].id)
    }
    setMatches(res.data)
  }

  return (
    <>
      <Kpis
        className="mx-4 xl:grid-cols-4 lg:mx-6"
        items={[
          { label: "Expiring within 30 days", value: n0(summary.expiring), hint: "batches with stock left", warn: summary.expiring > 0 },
          { label: "Expired on the shelf", value: n0(summary.expired), hint: "need a write-off", warn: summary.expired > 0 },
          { label: "Quarantined", value: n0(summary.quarantined), hint: "held in quality check" },
          { label: "Matching batches", value: n0(meta.total), hint: activeTab?.text ?? "with these filters" },
        ]}
      />

      <div className="flex flex-wrap items-start gap-3 px-4 lg:px-6">
        <form onSubmit={lookup} className="relative">
          <ScanBarcodeIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Look up a batch"
            placeholder="Scan or type a lot number, Enter"
            className="h-9 w-72 bg-card pl-8 font-mono"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </form>
        {matches && (
          <div className="flex flex-wrap items-center gap-1.5 text-sm">
            <span className="text-muted-foreground">{matches[0].batchNumber} is in:</span>
            {matches.map((b) => (
              <Button key={b.id} size="sm" variant="outline" onClick={() => setOpenId(b.id)}>
                {b.warehouse.code} · {n0(b.quantity)}
              </Button>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 px-4 lg:px-6">
        <nav aria-label="Quick filters" className="flex gap-0.5 overflow-x-auto rounded-lg bg-muted p-0.5">
          {TABS.map((t) => (
            <button
              key={t.text}
              type="button"
              onClick={() => go(t.patch)}
              className={cn(
                "rounded-md px-2.5 py-1 text-[13px] font-medium whitespace-nowrap text-muted-foreground hover:text-foreground",
                activeTab === t && "bg-card text-foreground shadow-xs"
              )}
            >
              {t.text}
            </button>
          ))}
        </nav>
        <span className="flex-1" />
        <ParamSelect name="warehouseId" value={filters.warehouseId || "all"} items={warehouseItems} label="Warehouse" className="w-36" />
        <ParamSearch value={filters.search} placeholder="Lot, SKU or product, Enter" />
      </div>

      <Card title={`${n0(meta.total)} batches`} className="mx-4 lg:mx-6" action={<span className="text-xs text-muted-foreground">Earliest expiry is picked first</span>}>
        {batches.length === 0 ? (
          <p className="px-4 pb-4 text-sm text-muted-foreground">No batches match these filters.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                  <tr className="[&>th]:px-3 [&>th]:py-2.5 [&>th]:font-medium [&>th:first-child]:pl-4 [&>th:last-child]:pr-4">
                    <th><SortHeader field="batchNumber" text="Batch" {...sort} /></th>
                    <th>Item</th>
                    <th className="hidden md:table-cell">Where</th>
                    <th className="text-right"><SortHeader field="quantity" text="Left" {...sort} /></th>
                    <th><SortHeader field="expiresAt" text="Expiry" {...sort} /></th>
                    <th>Status</th>
                    <th className="hidden xl:table-cell"><SortHeader field="receivedAt" text="Received" {...sort} /></th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {batches.map((b) => (
                    <tr key={b.id} className="border-t border-border/60 [&>td]:px-3 [&>td]:py-2.5 [&>td:first-child]:pl-4 [&>td:last-child]:pr-4">
                      <td>
                        <button type="button" onClick={() => setOpenId(b.id)} className="font-mono text-[13px] font-semibold text-primary hover:underline">
                          {b.batchNumber}
                        </button>
                        {b.barcode && <div className="font-mono text-[11px] text-muted-foreground">{b.barcode}</div>}
                      </td>
                      <td className="max-w-64">
                        <div className="truncate font-medium">
                          {b.variant.productName}
                          {b.variant.label && <span className="font-normal text-muted-foreground">, {b.variant.label}</span>}
                        </div>
                        <div className="font-mono text-[11px] text-muted-foreground">{b.variant.sku}</div>
                      </td>
                      <td className="hidden md:table-cell">
                        <span className="flex flex-wrap items-center gap-1">
                          <WarehouseTag code={b.warehouse.code} />
                          {b.locations.slice(0, 3).map((l) => <RackTag key={l.locationId} code={l.code} title={`${n0(l.quantity)} units`} />)}
                          {b.locations.length > 3 && <span className="text-xs text-muted-foreground">+{b.locations.length - 3}</span>}
                        </span>
                      </td>
                      <td className="text-right">
                        <span className="font-semibold">{n0(b.quantity)}</span>
                        <span className="text-muted-foreground"> / {n0(b.initialQty)}</span>
                      </td>
                      <td><ExpiryBadge batch={b} /></td>
                      <td><StatusPill status={b.status} /></td>
                      <td className="hidden text-muted-foreground xl:table-cell">
                        <div className="whitespace-nowrap">{fmtDate(b.receivedAt)}</div>
                        <div className="text-xs">
                          {b.supplier?.name}
                          {b.purchaseOrder && (
                            <>
                              {" · "}
                              <Link href="/inventory/purchase-orders" className="text-primary hover:underline">{b.purchaseOrder.poNumber}</Link>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager page={meta.page} totalPages={meta.totalPages} total={meta.total} noun="batches" />
          </>
        )}
      </Card>

      <Card title="How batches work" className="mx-4 lg:mx-6">
        <ul className="flex list-disc flex-col gap-1 px-4 pb-4 pl-8 text-[13px] text-muted-foreground">
          <li>Expiry belongs to a batch, not a product: every receipt creates one, with an expiry date for creams, food or medicine.</li>
          <li>Sales, transfers and adjustments take units from specific batches, the earliest expiry first. Expired batches are never picked; they wait for a write-off.</li>
          <li>Transfers keep the batch number and expiry. Quarantine moves a batch to a quality-check warehouse where it can’t be sold; release brings it back.</li>
        </ul>
      </Card>

      {openId && <BatchSheet key={openId} batchId={openId} warehouses={warehouses} onOpen={setOpenId} onClose={() => setOpenId(null)} />}
    </>
  )
}

// One batch with its racks, history and the same lot elsewhere, plus its actions. Also opened from the Movements page.
export function BatchSheet({
  batchId,
  warehouses = [],
  onOpen,
  onClose,
}: {
  batchId: string
  warehouses?: Warehouse[]
  onOpen?: (id: string) => void
  onClose: () => void
}) {
  const [batch, setBatch] = useState<BatchDetail | null>(null)
  const [dialog, setDialog] = useState<"edit" | "write-off" | "quarantine" | "release" | null>(null)

  useEffect(() => {
    let stale = false
    getBatch(batchId).then((res) => {
      if (stale) return
      if (!res.success) return toast.error(res.error)
      setBatch(res.data)
    })
    return () => {
      stale = true
    }
  }, [batchId])

  const b = batch
  const held = b && HOLDING.includes(b.warehouse.type)
  let footer: React.ReactNode = <span className="flex-1" />
  if (b) {
    const canEdit = b.status !== "QUARANTINED"
    const canWriteOff = b.quantity > 0 && (b.status === "AVAILABLE" || (b.status === "QUARANTINED" && held))
    const canQuarantine = b.status === "AVAILABLE" && b.quantity > 0
    footer = (
      <>
        {canWriteOff && (
          <Button variant="ghost" className="text-destructive" onClick={() => setDialog("write-off")}>
            Write off
          </Button>
        )}
        <span className="flex-1" />
        {canEdit && <Button variant="outline" onClick={() => setDialog("edit")}>Edit</Button>}
        {canQuarantine && <Button variant="outline" onClick={() => setDialog("quarantine")}>Quarantine</Button>}
        {b.status === "QUARANTINED" && <Button onClick={() => setDialog("release")}>Release</Button>}
        <Button variant="outline" onClick={onClose}>Done</Button>
      </>
    )
  }

  function done(next: BatchDetail, message: string) {
    setDialog(null)
    toast.success(message)
    // Quarantine answers with the held copy; follow it.
    if (next.id !== batchId && onOpen) return onOpen(next.id)
    setBatch(next)
  }

  return (
    <DocSheet kind="Batch" title={b?.batchNumber ?? "Loading..."} status={b?.status} narrow footer={footer} onClose={onClose}>
      {!b && <p className="text-sm text-muted-foreground">Loading the batch...</p>}
      {b && (
        <>
          <section className="overflow-hidden rounded-2xl border bg-card">
            <div className="px-4 pt-4">
              <div className="font-semibold">
                {b.variant.productName}
                {b.variant.label && <span className="font-normal text-muted-foreground">, {b.variant.label}</span>}
              </div>
              <div className="font-mono text-xs text-muted-foreground">{b.variant.sku}</div>
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 px-4 py-4 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-xs text-muted-foreground">Left</dt>
                <dd className="text-xl font-bold tabular-nums">
                  {n0(b.quantity)} <span className="text-sm font-normal text-muted-foreground">/ {n0(b.initialQty)}</span>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Expires</dt>
                <dd><ExpiryBadge batch={b} /></dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Where</dt>
                <dd className="flex items-center gap-1"><WarehouseTag code={b.warehouse.code} />{held && <Pill tone="amber">Held</Pill>}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Unit cost</dt>
                <dd className="tabular-nums">{b.unitCost ? taka(Number(b.unitCost), 2) : "—"}</dd>
              </div>
            </dl>
            <ul className="flex flex-wrap gap-x-7 gap-y-1.5 border-t bg-muted/30 px-4 py-2.5 text-[13px]">
              <li><span className="block text-xs text-muted-foreground">Received</span>{fmtDate(b.receivedAt)}</li>
              <li><span className="block text-xs text-muted-foreground">Made</span>{fmtDate(b.manufacturedAt)}</li>
              {b.barcode && <li><span className="block text-xs text-muted-foreground">Barcode</span><span className="font-mono">{b.barcode}</span></li>}
              {b.supplier && <li><span className="block text-xs text-muted-foreground">Supplier</span>{b.supplier.name}</li>}
              {b.purchaseOrder && (
                <li>
                  <span className="block text-xs text-muted-foreground">Purchase order</span>
                  <Link href="/inventory/purchase-orders" className="text-primary hover:underline">{b.purchaseOrder.poNumber}</Link>
                </li>
              )}
            </ul>
            {b.note && <p className="border-t px-4 py-2.5 text-[13px] text-muted-foreground">{b.note}</p>}
          </section>

          <Card title="Racks">
            {b.locations.length === 0 ? (
              <p className="px-4 pb-4 text-sm text-muted-foreground">Nothing left on a rack.</p>
            ) : (
              <ul className="flex flex-wrap gap-2 px-4 pb-4">
                {b.locations.map((l) => (
                  <li key={l.locationId} className="flex items-center gap-1.5 rounded-lg border px-2 py-1 text-sm">
                    <RackTag code={l.code} /> <span className="font-semibold tabular-nums">{n0(l.quantity)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {b.related.length > 0 && (
            <Card title="Same lot elsewhere">
              <ul className="flex flex-wrap gap-2 px-4 pb-4">
                {b.related.map((r) => (
                  <li key={r.id}>
                    <Button size="sm" variant="outline" onClick={() => onOpen?.(r.id)} disabled={!onOpen}>
                      {r.warehouse.code} · {n0(r.quantity)} · {label(r.status)}
                    </Button>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card title="History" action={<span className="text-xs text-muted-foreground">Oldest first</span>}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                  <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:font-medium [&>th:first-child]:pl-4 [&>th:last-child]:pr-4">
                    <th>When</th>
                    <th>Type</th>
                    <th>Rack</th>
                    <th className="text-right">Qty</th>
                    <th className="hidden sm:table-cell">Reference</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {b.movements.map((m) => (
                    <tr key={m.id} className="border-t border-border/60 [&>td]:px-3 [&>td]:py-2 [&>td:first-child]:pl-4 [&>td:last-child]:pr-4">
                      <td className="whitespace-nowrap text-muted-foreground">{fmtDateTime(m.createdAt)}</td>
                      <td><MovementTag movement={{ type: m.type as MovementType, direction: m.direction }} /></td>
                      <td>
                        <span className="flex items-center gap-1">
                          {m.fromLocation && <RackTag code={m.fromLocation.code} />}
                          {m.fromLocation && m.toLocation && <ArrowRightIcon className="size-3 text-muted-foreground" />}
                          {m.toLocation && <RackTag code={m.toLocation.code} />}
                        </span>
                      </td>
                      <td className={cn("text-right font-semibold", m.direction === "IN" && "text-emerald-700 dark:text-emerald-400", m.direction === "OUT" && "text-destructive")}>
                        {m.direction === "IN" && "+"}
                        {m.direction === "OUT" && "−"}
                        {n0(m.quantity)}
                      </td>
                      <td className="hidden max-w-48 truncate text-muted-foreground sm:table-cell" title={m.note ?? undefined}>
                        {m.note ?? "—"}
                        {m.performedBy && <span className="block text-[11px]">{m.performedBy.name}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {dialog === "edit" && <EditDialog batch={b} onDone={(next) => done(next, "Batch updated")} onClose={() => setDialog(null)} />}
          {dialog === "write-off" && <WriteOffDialog batch={b} onDone={(next) => done(next, `${b.batchNumber} written off`)} onClose={() => setDialog(null)} />}
          {dialog === "quarantine" && (
            <QuarantineDialog
              batch={b}
              warehouses={warehouses.filter((w) => w.isActive && HOLDING.includes(w.type))}
              onDone={(next) => done(next, `${b.batchNumber} quarantined: its units can't be sold until released`)}
              onClose={() => setDialog(null)}
            />
          )}
          {dialog === "release" && <ReleaseDialog batch={b} onDone={(next) => done(next, `${b.batchNumber} released and sellable again`)} onClose={() => setDialog(null)} />}
        </>
      )}
    </DocSheet>
  )
}

type DialogProps = { batch: BatchDetail; onDone: (next: BatchDetail) => void; onClose: () => void }

function EditDialog({ batch, onDone, onClose }: DialogProps) {
  const notesOnly = batch.status === "EXPIRED" || batch.status === "RECALLED"
  const [barcode, setBarcode] = useState(batch.barcode ?? "")
  const [made, setMade] = useState(batch.manufacturedAt?.slice(0, 10) ?? "")
  const [expires, setExpires] = useState(batch.expiresAt?.slice(0, 10) ?? "")
  const [note, setNote] = useState(batch.note ?? "")
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const day = (d: string) => (d ? new Date(`${d}T12:00:00`).toISOString() : null)

  async function save() {
    if (made && expires && expires <= made) return setError("The expiry date must be after the manufacture date.")
    setSaving(true)
    const res = await updateBatch(batch.id, {
      barcode: barcode.trim() || null,
      note: note.trim() || null,
      manufacturedAt: notesOnly ? batch.manufacturedAt : day(made),
      expiresAt: notesOnly ? batch.expiresAt : day(expires),
    })
    setSaving(false)
    if (!res.success) return setError(res.error)
    onDone(res.data)
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit {batch.batchNumber}</DialogTitle>
          <DialogDescription>Fix a mistyped label. {notesOnly ? "An expired or recalled batch keeps its dates." : "Changing the expiry changes the picking order."}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="batch-barcode">Barcode</FieldLabel>
            <Input id="batch-barcode" className="font-mono" value={barcode} onChange={(e) => setBarcode(e.target.value)} disabled={notesOnly} />
          </Field>
          <Field>
            <FieldLabel htmlFor="batch-made">Manufactured</FieldLabel>
            <Input id="batch-made" type="date" value={made} onChange={(e) => setMade(e.target.value)} disabled={notesOnly} />
          </Field>
          <Field>
            <FieldLabel htmlFor="batch-expires">Expires</FieldLabel>
            <Input id="batch-expires" type="date" value={expires} onChange={(e) => setExpires(e.target.value)} disabled={notesOnly} />
          </Field>
          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="batch-note">Note</FieldLabel>
            <Textarea id="batch-note" rows={2} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </div>
        <DialogFooter className="items-center">
          {error && <p className="mr-auto text-sm text-destructive">{error}</p>}
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function WriteOffDialog({ batch, onDone, onClose }: DialogProps) {
  const [reason, setReason] = useState<WriteOffReason>(batch.expiry.state === "EXPIRED" ? "EXPIRED" : "DAMAGED")
  const [quantity, setQuantity] = useState(String(batch.quantity))
  const [note, setNote] = useState("")
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  // Expired and recalled batches always go whole.
  const whole = reason === "EXPIRED" || reason === "RECALLED"
  const units = whole ? batch.quantity : Number(quantity) || 0

  async function save() {
    if (!whole && (!/^\d+$/.test(quantity) || units < 1 || units > batch.quantity)) return setError(`Enter 1 to ${batch.quantity}.`)
    setSaving(true)
    const res = await writeOffBatch(batch.id, { reason, quantity: whole ? undefined : units, note: note.trim() || undefined })
    setSaving(false)
    if (!res.success) return setError(res.error)
    onDone(res.data)
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Write off {batch.batchNumber}</DialogTitle>
          <DialogDescription>Removes {n0(units)} {units === 1 ? "unit" : "units"} from stock for good. {REASONS.find((r) => r.value === reason)?.help}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field>
            <FieldLabel>Reason</FieldLabel>
            <Select value={reason} items={REASONS} onValueChange={(v) => setReason(v as WriteOffReason)}>
              <SelectTrigger aria-label="Reason" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {REASONS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          {!whole && (
            <Field>
              <FieldLabel htmlFor="writeoff-qty">Units (of {n0(batch.quantity)})</FieldLabel>
              <Input id="writeoff-qty" inputMode="numeric" className="text-right tabular-nums" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </Field>
          )}
          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="writeoff-note">Note</FieldLabel>
            <Textarea id="writeoff-note" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What happened" />
          </Field>
        </div>
        <DialogFooter className="items-center">
          {error && <p className="mr-auto text-sm text-destructive">{error}</p>}
          <Button variant="outline" onClick={onClose}>Keep it</Button>
          <Button variant="destructive" onClick={save} disabled={saving}>{saving ? "Writing off..." : "Write off"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function QuarantineDialog({ batch, warehouses, onDone, onClose }: DialogProps & { warehouses: Warehouse[] }) {
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? "")
  const [note, setNote] = useState("")
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const items = warehouses.map((w) => ({ value: w.id, label: `${w.code} · ${w.name}` }))

  async function save() {
    setSaving(true)
    const res = await quarantineBatch(batch.id, { toWarehouseId: warehouseId || undefined, note: note.trim() || undefined })
    setSaving(false)
    if (!res.success) return setError(res.error)
    onDone(res.data)
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Quarantine {batch.batchNumber}</DialogTitle>
          <DialogDescription>Moves all {n0(batch.quantity)} units to a quality-check warehouse, where they can’t be sold, until you release them.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          {items.length > 0 ? (
            <Field>
              <FieldLabel>Hold in</FieldLabel>
              <Select value={warehouseId} items={items} onValueChange={(v) => setWarehouseId(v as string)}>
                <SelectTrigger aria-label="Quality-check warehouse" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {items.map((w) => <SelectItem key={w.value} value={w.value}>{w.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          ) : (
            <p className="text-sm text-muted-foreground">The first active quality-check warehouse will be used.</p>
          )}
          <Field>
            <FieldLabel htmlFor="quarantine-note">Note</FieldLabel>
            <Textarea id="quarantine-note" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why it's on hold" />
          </Field>
        </div>
        <DialogFooter className="items-center">
          {error && <p className="mr-auto text-sm text-destructive">{error}</p>}
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Moving..." : "Quarantine"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ReleaseDialog({ batch, onDone, onClose }: DialogProps) {
  const [note, setNote] = useState("")
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    const res = await releaseBatch(batch.id, note.trim() || undefined)
    setSaving(false)
    if (!res.success) return setError(res.error)
    onDone(res.data)
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Release {batch.batchNumber}</DialogTitle>
          <DialogDescription>Brings the held units back to their warehouse, where they can be sold again.</DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor="release-note">Note</FieldLabel>
          <Textarea id="release-note" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Passed the check" />
        </Field>
        <DialogFooter className="items-center">
          {error && <p className="mr-auto text-sm text-destructive">{error}</p>}
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Releasing..." : "Release"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
