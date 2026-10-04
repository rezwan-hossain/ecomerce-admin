"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRightIcon, PencilIcon, PlusIcon, ShoppingCartIcon, XIcon } from "lucide-react"
import { toast } from "sonner"

import { bulkAdjustStock, getProductMovements } from "@/app/actions/inventory.actions"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import type { LedgerMovement, ManualMovementType, StorageLocation, VariantStock } from "@/types/inventory.type"

import { Card, fmtDateTime, n0, Pill, RackTag, taka, WarehouseTag } from "./inventory-ui"
import { MovementQuantity, MovementTag } from "./movements-table"
import { levelHealth, shelfTotals, type Health, type ShelfItem } from "./product-shelf"
import type { Warehouse } from "./stock-sheet"

type ShelfWarehouse = Warehouse & { name: string; type: string }

const BIN: Record<Health, string> = {
  ok: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  low: "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  out: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
  hold: "bg-muted text-foreground/70",
  none: "border border-dashed text-muted-foreground",
}

// The key's swatches need an edge; the cell colors alone are too pale at 12px.
const SWATCH: Record<Health, string> = {
  ok: "bg-emerald-50 ring-1 ring-inset ring-emerald-600/60",
  low: "bg-amber-50 ring-1 ring-inset ring-amber-500/70",
  out: "bg-red-50 ring-1 ring-inset ring-red-600/60",
  hold: "bg-muted",
  none: "border border-dashed border-muted-foreground/50",
}

const BIN_KEY: [Health, string][] = [
  ["ok", "In stock"],
  ["low", "Low"],
  ["out", "Out"],
  ["none", "Not stocked"],
]

const isSellableWarehouse = (w: ShelfWarehouse) => w.type === "PHYSICAL" || w.type === "STORE"

// One product's stock: totals, then a variant × warehouse grid. A cell opens that variant's detail panel.
export function ProductStockSheet({
  item,
  warehouses,
  locations,
  onCell,
  onChanged,
  onClose,
}: {
  item: ShelfItem
  warehouses: ShelfWarehouse[]
  locations: StorageLocation[]
  onCell: (variantId: string, warehouseId: string) => void
  onChanged: () => Promise<void>
  onClose: () => void
}) {
  const [adding, setAdding] = useState(false)
  const { product: p, variants } = item
  const t = shelfTotals(variants)

  // Every sellable warehouse, plus any other warehouse this product has stock in.
  const columns = warehouses.filter((w) => isSellableWarehouse(w) || variants.some((v) => v.levels.some((l) => l.warehouseId === w.id)))
  // Prices live on the product's own variants; the stock rows don't carry them.
  const price = (variantId: string) => {
    const v = p.variants.find((x) => x.id === variantId)
    return v ? taka(Number(v.price)) : ""
  }

  return (
    <>
      <Sheet open onOpenChange={(open) => !open && onClose()}>
        <SheetContent
          showCloseButton={false}
          className="w-full gap-0 border-l-0 bg-sidebar shadow-[-20px_0_60px_rgba(10,14,22,0.22)] data-[side=right]:sm:max-w-[1120px]"
        >
          <SheetHeader className="flex-row items-center gap-3 border-b bg-card px-5 py-3">
            <SheetClose render={<Button variant="ghost" size="icon-sm" className="shrink-0" />}>
              <XIcon />
              <span className="sr-only">Close</span>
            </SheetClose>
            <div className="min-w-0 flex-1">
              <SheetDescription className="text-[12.5px] leading-tight">{p.brand?.name ?? "No brand"}</SheetDescription>
              <SheetTitle className="truncate text-[21px] leading-snug font-bold tracking-tight">{p.name}</SheetTitle>
            </div>
            {p.status === "DRAFT" && <Pill tone="grey">Draft</Pill>}
            {p.status === "ARCHIVED" && <Pill tone="amber">Archived</Pill>}
          </SheetHeader>

          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain *:shrink-0 px-5 pt-[18px] pb-7 text-sm">
            <div className="flex flex-wrap items-end justify-between gap-x-5 gap-y-3.5">
              <div className="min-w-0">
                <div className="flex flex-wrap gap-1.5">
                  <span className="rounded-full bg-foreground px-2.5 py-0.5 text-xs font-semibold text-background">{p.brand?.name ?? "No brand"}</span>
                  {p.categories.map((c) => (
                    <span key={c.category.id} className="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-semibold text-foreground/75 dark:bg-muted">
                      {c.category.name}
                    </span>
                  ))}
                  {p.tags.map((t) => (
                    <span key={t.tag.id} className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                      {t.tag.name}
                    </span>
                  ))}
                </div>
                <p className="mt-2 text-muted-foreground">/products/{p.slug}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" className="bg-card" nativeButton={false} render={<Link href={`/products/${p.id}/edit`} />}>
                  <PencilIcon data-icon="inline-start" />
                  Edit product
                </Button>
                <Button variant="outline" className="bg-card" disabled={variants.length === 0} onClick={() => setAdding(true)}>
                  <PlusIcon data-icon="inline-start" />
                  Add stock
                </Button>
                <Button nativeButton={false} render={<Link href="/inventory/purchase-orders" />}>
                  <ShoppingCartIcon data-icon="inline-start" />
                  Order from supplier
                </Button>
              </div>
            </div>

            {/* The 1px gap over a border-colored background draws the dividers. */}
            <section className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border bg-border md:grid-cols-3 xl:grid-cols-6">
              {[
                ["Storefront stock", n0(t.available)],
                ["On hand", n0(t.onHand)],
                ["Held for orders", n0(t.reserved)],
                ["Incoming", n0(t.incoming)],
                ["Damaged", n0(t.damaged)],
                ["Stock value", taka(t.value)],
              ].map(([label, value]) => (
                <div key={label} className="min-w-0 bg-card px-4 py-3">
                  <span className="block text-[12.5px] text-muted-foreground">{label}</span>
                  <strong className="mt-0.5 block truncate text-[23px] font-bold tracking-tight tabular-nums">{value}</strong>
                </div>
              ))}
            </section>

            <Card
              className="rounded-2xl"
              title="Where the stock is"
              action={
                <span className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-xs text-muted-foreground">
                  {BIN_KEY.map(([health, text]) => (
                    <span key={health} className="inline-flex items-center gap-1.5">
                      <i className={cn("inline-block size-3 rounded-[3px]", SWATCH[health])} />
                      {text}
                    </span>
                  ))}
                  <span>
                    <b className="text-foreground">+12</b> incoming
                  </span>
                </span>
              }
            >
              {variants.length === 0 ? (
                <p className="px-4 pb-4 text-muted-foreground">This product’s variants aren’t in stock tracking yet.</p>
              ) : (
                <div className="overflow-x-auto px-2.5 pb-1">
                  <table className="w-full border-separate border-spacing-1.5">
                    <thead>
                      <tr className="text-xs text-muted-foreground">
                        <th className="w-1/2 px-1 pr-6 text-left font-medium">Variant</th>
                        {columns.map((w) => (
                          <th key={w.id} className="px-1 text-center font-medium" title={w.name}>
                            <WarehouseTag code={w.code} />
                            <small className="mx-auto mt-1 block max-w-32 truncate font-normal">{w.name}</small>
                          </th>
                        ))}
                        <th className="w-1/2 px-2 text-right font-medium">Available</th>
                      </tr>
                    </thead>
                    <tbody>
                      {variants.map((v) => (
                        <tr key={v.variantId} className={cn(!v.isActive && "opacity-50")}>
                          <th scope="row" className="px-1 pr-6 text-left whitespace-nowrap align-middle font-normal">
                            <div className="font-semibold">{v.name === v.sku ? "Default" : v.name}</div>
                            <div className="font-mono text-xs text-muted-foreground">{v.sku}</div>
                            <div className="text-xs text-muted-foreground">
                              {price(v.variantId)}
                              {!v.isActive && ", not for sale"}
                            </div>
                          </th>
                          {columns.map((w) => (
                            <td key={w.id} className="w-40 min-w-36 p-0">
                              <Bin variant={v} warehouse={w} onClick={() => onCell(v.variantId, w.id)} />
                            </td>
                          ))}
                          <td className="px-2 text-right text-[15px] font-bold tabular-nums">{n0(v.stock)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="px-4 pb-4 text-[12.5px] text-muted-foreground">
                Select a cell for racks, holds and stock actions at that warehouse.
              </p>
            </Card>

            <RecentMovements variants={variants} />
          </div>
          <SheetFooter className="flex-row justify-end border-t bg-card px-5 py-3">
            <Button onClick={onClose}>Done</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {adding && (
        <AddStockDialog
          item={item}
          warehouses={warehouses.filter(isSellableWarehouse)}
          locations={locations}
          onClose={() => setAdding(false)}
          onDone={async () => {
            setAdding(false)
            await onChanged()
          }}
        />
      )}
    </>
  )
}

// The latest movements across all of the product's variants, newest first.
function RecentMovements({ variants }: { variants: VariantStock[] }) {
  const [data, setData] = useState<{ movements: LedgerMovement[]; total: number } | null>(null)
  const [error, setError] = useState("")
  // Reload when stock changes (e.g. after "Add stock"), not on every parent render.
  const stockKey = variants.map((v) => `${v.variantId}:${v.onHand}:${v.reserved}`).join(",")

  useEffect(() => {
    getProductMovements(stockKey.split(",").map((part) => part.split(":")[0]).filter(Boolean)).then((res) => {
      if (res.success) setData(res.data)
      else setError(res.error)
    })
  }, [stockKey])

  const userName = (m: LedgerMovement) =>
    m.performedByUser ? [m.performedByUser.firstName, m.performedByUser.lastName].filter(Boolean).join(" ") : "System"

  return (
    <Card className="rounded-2xl" title="Recent movements" action={data && <span className="text-muted-foreground">{n0(data.total)} {data.total === 1 ? "row" : "rows"}</span>}>
      {error && <p className="px-4 pb-4 text-destructive">Couldn’t load movements: {error}</p>}
      {!data && !error && <p className="px-4 pb-4 text-muted-foreground">Loading movements...</p>}
      {data && data.movements.length === 0 && <p className="px-4 pb-4 text-muted-foreground">No movements yet.</p>}
      {data && data.movements.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="text-left text-xs text-muted-foreground">
              <tr className="border-y [&>th]:px-3 [&>th]:py-2.5 [&>th]:font-semibold">
                <th>When</th>
                <th>Type</th>
                <th>Item</th>
                <th>Where</th>
                <th className="text-right">Qty</th>
                <th className="text-right">On hand</th>
                <th>By</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {data.movements.map((m) => (
                <tr key={m.id} className="border-b border-border/60 last:border-b-0 [&>td]:px-3 [&>td]:py-[9px]">
                  <td className="whitespace-nowrap text-muted-foreground">{fmtDateTime(m.createdAt)}</td>
                  <td><MovementTag movement={m} /></td>
                  <td className="max-w-56 truncate font-mono text-xs font-semibold">{m.inventoryLevel.variant.sku}</td>
                  <td>
                    <span className="flex items-center gap-1 whitespace-nowrap">
                      <WarehouseTag code={m.inventoryLevel.warehouse.code} />
                      {m.fromLocation && <RackTag code={m.fromLocation.code} />}
                      {m.fromLocation && m.toLocation && <ArrowRightIcon className="size-3 text-muted-foreground" />}
                      {m.toLocation && <RackTag code={m.toLocation.code} />}
                    </span>
                  </td>
                  <td className="text-right"><MovementQuantity movement={m} /></td>
                  <td className="text-right whitespace-nowrap">
                    {m.onHandBefore === m.onHandAfter ? (
                      <span className="text-muted-foreground">{n0(m.onHandAfter)}</span>
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        <span className="text-muted-foreground">{n0(m.onHandBefore)}</span>
                        <ArrowRightIcon className="size-3 text-muted-foreground" />
                        <strong>{n0(m.onHandAfter)}</strong>
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap text-muted-foreground">{userName(m)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

// One cell of the grid: what can be sold at this warehouse, how much is held, and what's on the way.
function Bin({ variant, warehouse, onClick }: { variant: VariantStock; warehouse: ShelfWarehouse; onClick: () => void }) {
  const level = variant.levels.find((l) => l.warehouseId === warehouse.id)
  const health = level ? levelHealth(variant, level) : "none"
  let label = `${variant.sku} at ${warehouse.code}: not stocked`
  if (level) label = `${variant.sku} at ${warehouse.code}: ${level.available} available, ${level.onHand} on hand`

  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        "relative flex h-16 w-full flex-col justify-center rounded-[10px] border-[1.5px] border-transparent px-3 text-left transition-colors hover:border-current focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
        BIN[health],
        !level && "items-center"
      )}
    >
      {level ? (
        <>
          <strong className="text-2xl leading-none font-bold tracking-tight tabular-nums">{n0(level.available)}</strong>
          <span className="mt-1 text-[11.5px] whitespace-nowrap opacity-85">
            {level.reserved ? `${level.reserved} held of ${n0(level.onHand)}` : "None held"}
          </span>
          {level.incoming > 0 && <em className="absolute top-1.5 right-2 text-[11.5px] font-bold not-italic text-primary">+{n0(level.incoming)}</em>}
        </>
      ) : (
        "—"
      )}
    </button>
  )
}

const INBOUND: { value: ManualMovementType; label: string }[] = [
  { value: "PURCHASE_RECEIVED", label: "Received from supplier" },
  { value: "RETURN_RESTOCKED", label: "Customer return restocked" },
  { value: "ADJUSTMENT_INCREASE", label: "Correction: add" },
]

const AUTO_RACK = "auto"
const isWhole = (s: string) => /^\d+$/.test(s.trim())

// Stock for many variants and warehouses at once, saved as one all-or-nothing ledger transaction.
function AddStockDialog({
  item,
  warehouses,
  locations,
  onClose,
  onDone,
}: {
  item: ShelfItem
  warehouses: ShelfWarehouse[]
  locations: StorageLocation[]
  onClose: () => void
  onDone: () => Promise<void>
}) {
  const variants = item.variants.filter((v) => v.isActive)
  const [type, setType] = useState<ManualMovementType>("PURCHASE_RECEIVED")
  const [qty, setQty] = useState<Record<string, string>>({}) // "variantId:warehouseId" → units
  // Starts from each variant's current average cost, when it has one.
  const [cost, setCost] = useState<Record<string, string>>(() =>
    Object.fromEntries(variants.map((v) => [v.variantId, v.levels.find((l) => Number(l.unitCost) > 0)?.unitCost ?? ""]))
  )
  const [racks, setRacks] = useState<Record<string, string>>({})
  const [note, setNote] = useState("")
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)

  const key = (variantId: string, warehouseId: string) => `${variantId}:${warehouseId}`
  const rowTotal = (v: VariantStock) => warehouses.reduce((s, w) => s + (Number(qty[key(v.variantId, w.id)]) || 0), 0)
  const total = variants.reduce((s, v) => s + rowTotal(v), 0)

  async function save() {
    const lines = []
    for (const v of variants) {
      for (const w of warehouses) {
        const raw = qty[key(v.variantId, w.id)] ?? ""
        if (!raw.trim()) continue
        if (!isWhole(raw)) return setError(`${v.sku}: enter whole numbers.`)
        if (Number(raw) === 0) continue
        const unitCost = (cost[v.variantId] ?? "").trim()
        if (unitCost && !(Number(unitCost) >= 0)) return setError(`${v.sku}: enter the unit cost as a number.`)
        const rack = racks[w.id] ?? AUTO_RACK
        lines.push({
          variantId: v.variantId,
          warehouseId: w.id,
          ...(rack !== AUTO_RACK && { locationId: rack }),
          type,
          quantity: Number(raw),
          ...(unitCost && { unitCost: Number(unitCost) }),
          ...(note.trim() && { note: note.trim() }),
        })
      }
    }
    if (lines.length === 0) return setError("Enter at least one quantity.")

    setSaving(true)
    const res = await bulkAdjustStock(lines)
    setSaving(false)
    if (!res.success) return setError(res.error)
    toast.success(`Added ${n0(total)} units of ${item.product.name}`)
    await onDone()
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Add stock: {item.product.name}</DialogTitle>
          <DialogDescription>
            Every line is written to the movement history, all together or not at all. Leave a cell empty for none.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field>
            <FieldLabel>Reason</FieldLabel>
            <Select value={type} items={INBOUND} onValueChange={(v) => setType(v as ManualMovementType)}>
              <SelectTrigger aria-label="Reason" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INBOUND.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="add-stock-note">Note</FieldLabel>
            <Input id="add-stock-note" placeholder="Optional, e.g. supplier invoice number" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </div>

        <div className="max-h-[50vh] overflow-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-muted text-left text-xs text-muted-foreground">
              <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:font-medium">
                <th>Variant</th>
                <th className="text-right">Unit cost (৳)</th>
                {warehouses.map((w) => {
                  const rackItems = [
                    { value: AUTO_RACK, label: "Default rack" },
                    ...locations.filter((l) => l.warehouseId === w.id && l.isActive).map((l) => ({ value: l.id, label: l.code })),
                  ]
                  return (
                    <th key={w.id} className="text-right">
                      <WarehouseTag code={w.code} />
                      <Select value={racks[w.id] ?? AUTO_RACK} items={rackItems} onValueChange={(v) => setRacks({ ...racks, [w.id]: v as string })}>
                        <SelectTrigger aria-label={`Rack at ${w.code}`} size="sm" className="mt-1.5 ml-auto w-32 bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {rackItems.map((r) => (
                            <SelectItem key={r.value} value={r.value}>
                              {r.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </th>
                  )
                })}
                <th className="text-right">Total</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {variants.map((v) => (
                <tr key={v.variantId} className="border-t [&>td]:px-3 [&>td]:py-2">
                  <td>
                    <div className="font-semibold">{v.name === v.sku ? "Default" : v.name}</div>
                    <div className="font-mono text-xs text-muted-foreground">{v.sku}</div>
                  </td>
                  <td className="text-right">
                    <Input
                      aria-label={`Unit cost of ${v.sku}`}
                      inputMode="decimal"
                      placeholder="Optional"
                      className="ml-auto h-8 w-24 text-right"
                      value={cost[v.variantId] ?? ""}
                      onChange={(e) => setCost({ ...cost, [v.variantId]: e.target.value })}
                    />
                  </td>
                  {warehouses.map((w) => (
                    <td key={w.id} className="text-right">
                      <Input
                        aria-label={`${v.sku} at ${w.code}`}
                        inputMode="numeric"
                        placeholder="0"
                        className="ml-auto h-8 w-20 text-right"
                        value={qty[key(v.variantId, w.id)] ?? ""}
                        onChange={(e) => {
                          setQty({ ...qty, [key(v.variantId, w.id)]: e.target.value })
                          setError("")
                        }}
                      />
                    </td>
                  ))}
                  <td className="text-right text-[15px] font-bold">{n0(rowTotal(v))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <DialogFooter className="items-center">
          {error ? (
            <p className="mr-auto text-[13px] font-medium text-destructive">{error}</p>
          ) : (
            <p className="mr-auto text-[13px] text-muted-foreground">{n0(total)} units across {warehouses.length} warehouses</p>
          )}
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || total === 0}>
            {saving ? "Adding..." : "Add stock"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
