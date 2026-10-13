"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRightIcon, HistoryIcon, XIcon } from "lucide-react"
import { toast } from "sonner"

import { getVariantStock, setDefaultRack } from "@/app/actions/inventory.actions"
import { Button } from "@/components/ui/button"
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
import type { StorageLocation, VariantStock, VariantStockDetail } from "@/types/inventory.type"

import { Card, fmtDateTime, MeterKey, n0, RackTag, rel, StockMeter, taka, WarehouseTag } from "./inventory-ui"
import { MovementQuantity, MovementTag } from "./movements-table"
import type { StockAction } from "./stock-sheet"

const NO_RACK = "none"

// Everything about one variant's stock: per warehouse, per rack, held for orders and recent movements.
export function StockHistorySheet({
  variant,
  locations,
  highlightWarehouseId,
  onAction,
  onChanged,
  onClose,
}: {
  variant: VariantStock
  locations: StorageLocation[]
  highlightWarehouseId?: string
  onAction: (action: StockAction, warehouseId: string) => void
  onChanged: () => void
  onClose: () => void
}) {
  const [detail, setDetail] = useState<VariantStockDetail | null>(null)
  const [error, setError] = useState("")

  // Reloads when the variant changes, e.g. after an adjustment from this panel.
  useEffect(() => {
    getVariantStock(variant.variantId).then((res) => {
      if (res.success) setDetail(res.data)
      else setError(res.error)
    })
  }, [variant])

  const value = variant.levels.reduce((sum, l) => sum + Number(l.unitCost) * l.onHand, 0)

  async function changeDefaultRack(warehouseId: string, locationId: string | null) {
    const res = await setDefaultRack(variant.variantId, warehouseId, locationId)
    if (!res.success) {
      toast.error(res.error)
      return
    }
    toast.success("Default rack updated")
    onChanged()
  }

  const stats = [
    ["Storefront stock", n0(variant.stock)],
    ["On hand", n0(variant.onHand)],
    ["Held for orders", n0(variant.reserved)],
    ["Incoming", n0(variant.incoming)],
    ["Stock value", taka(value)],
    ["Alert at", n0(variant.lowStockThreshold)],
  ]

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        showCloseButton={false}
        className="w-full gap-0 border-l-0 bg-sidebar shadow-[-20px_0_60px_rgba(10,14,22,0.22)] data-[side=right]:sm:max-w-[960px]"
      >
        <SheetHeader className="flex-row items-center gap-3 border-b bg-card px-5 py-3">
          <SheetClose render={<Button variant="ghost" size="icon-sm" className="shrink-0" />}>
            <XIcon />
            <span className="sr-only">Close</span>
          </SheetClose>
          <div className="min-w-0 flex-1">
            <SheetDescription className="truncate text-[12.5px] leading-tight">{variant.product.name}</SheetDescription>
            <SheetTitle className="truncate text-[21px] leading-snug font-bold tracking-tight">
              {variant.name === variant.sku ? "Default" : variant.name}
            </SheetTitle>
          </div>
          <span className="hidden rounded-md bg-muted px-2 py-0.5 font-mono text-xs font-semibold text-foreground/75 sm:inline">{variant.sku}</span>
          <Button size="sm" variant="outline" nativeButton={false} render={<Link href={`/inventory/reports/history?variantId=${variant.variantId}`} />}>
            <HistoryIcon />
            Stock history
          </Button>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-5 pt-[18px] pb-7 text-sm *:shrink-0">
          <section>
            {/* The 1px gap over a border-colored background draws the dividers. */}
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border bg-border md:grid-cols-3 xl:grid-cols-6">
              {stats.map(([label, statValue]) => (
                <div key={label} className="min-w-0 bg-card px-4 py-3">
                  <span className="block truncate text-[12.5px] text-muted-foreground">{label}</span>
                  <strong className="mt-0.5 block truncate text-[23px] font-bold tracking-tight tabular-nums">{statValue}</strong>
                </div>
              ))}
            </div>
            <p className="mt-2 px-1 text-[12.5px] text-muted-foreground">
              Storefront stock is what shoppers see: available units in active warehouses and stores. Holds and virtual
              warehouses don’t count.
            </p>
          </section>

          <Card title="By warehouse" action={<MeterKey />}>
            {variant.levels.length === 0 ? (
              <p className="px-4 pb-4 text-muted-foreground">Not stocked anywhere yet. Record opening stock with an adjustment.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="text-left text-xs text-muted-foreground">
                    <tr className="border-y [&>th]:px-3 [&>th]:py-2.5 [&>th]:font-semibold">
                      <th>Warehouse</th>
                      <th>Stock</th>
                      <th className="text-right">On hand</th>
                      <th className="text-right">Reserved</th>
                      <th className="text-right">Available</th>
                      <th className="text-right">Damaged</th>
                      <th>
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="tabular-nums">
                    {variant.levels.map((l) => (
                      <tr
                        key={l.warehouseId}
                        className={cn("border-b border-border/60 last:border-b-0 [&>td]:px-3 [&>td]:py-2.5", l.warehouseId === highlightWarehouseId && "bg-primary/5")}
                      >
                        <td>
                          <div className="font-semibold">{l.warehouse.name}</div>
                          <div className="text-xs text-muted-foreground">Average cost {taka(Number(l.unitCost), 2)}</div>
                        </td>
                        <td className="min-w-24">
                          <StockMeter available={l.available} reserved={l.reserved} incoming={l.incoming} damaged={l.damaged} />
                        </td>
                        <td className="text-right">{n0(l.onHand)}</td>
                        <td className="text-right">{n0(l.reserved)}</td>
                        <td className="text-right text-[15px] font-bold">{n0(l.available)}</td>
                        <td className="text-right">{l.damaged ? <span className="font-semibold text-destructive">{l.damaged}</span> : <span className="text-muted-foreground">0</span>}</td>
                        <td className="text-right whitespace-nowrap">
                          <div className="flex justify-end gap-1">
                            <Button size="xs" variant="outline" onClick={() => onAction("adjust", l.warehouseId)}>Adjust</Button>
                            <Button size="xs" variant="outline" onClick={() => onAction("count", l.warehouseId)}>Count</Button>
                            <Button size="xs" variant="outline" disabled={l.onHand === 0} onClick={() => onAction("move", l.warehouseId)}>
                              Move
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {variant.levels.some((l) => l.onHand > 0 || l.defaultLocation) && (
            <Card title="Rack split" action={<span className="text-muted-foreground">Picking starts at the default rack</span>}>
              <div className="grid gap-x-7 gap-y-4 px-4 pb-4 sm:grid-cols-2">
                {variant.levels
                  .filter((l) => l.onHand > 0 || l.defaultLocation)
                  .map((l) => {
                    const racks = locations.filter((r) => r.warehouseId === l.warehouseId && r.isActive && r.code !== "UNASSIGNED")
                    const items = [{ value: NO_RACK, label: "None (use Unassigned)" }, ...racks.map((r) => ({ value: r.id, label: r.code }))]
                    const most = Math.max(1, ...l.locationStocks.map((s) => s.quantity))
                    return (
                      <div key={l.warehouseId}>
                        <h3 className="mb-2 flex items-center gap-1.5 font-semibold">
                          <WarehouseTag code={l.warehouse.code} /> {l.warehouse.name}
                        </h3>
                        <label className="mb-1 block text-xs font-medium text-muted-foreground">Default rack</label>
                        <Select
                          value={l.defaultLocation?.id ?? NO_RACK}
                          items={items}
                          onValueChange={(value) => changeDefaultRack(l.warehouseId, value === NO_RACK ? null : (value as string))}
                        >
                          <SelectTrigger aria-label={`Default rack in ${l.warehouse.code}`} size="sm" className="mb-3 w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {items.map((item) => (
                              <SelectItem key={item.value} value={item.value}>
                                {item.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="flex flex-col gap-1.5">
                          {l.locationStocks.length === 0 && <p className="text-muted-foreground">Nothing on the racks here.</p>}
                          {l.locationStocks.map((s) => (
                            <div key={s.location.id} className="grid grid-cols-[96px_1fr_48px] items-center gap-2.5">
                              <span>
                                <RackTag code={s.location.code} title={s.location.name ?? undefined} />
                              </span>
                              <div className="h-2 overflow-hidden rounded-xs bg-muted">
                                <i
                                  className={cn("block h-full", s.location.id === l.defaultLocation?.id ? "bg-primary" : "bg-foreground/60")}
                                  style={{ width: `${(s.quantity / most) * 100}%` }}
                                />
                              </div>
                              <span className="text-right font-semibold tabular-nums">{n0(s.quantity)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
              </div>
            </Card>
          )}

          {error && <p className="text-destructive">Couldn’t load the history: {error}</p>}
          {!detail && !error && <p className="text-muted-foreground">Loading history...</p>}

          {detail && detail.activeReservations.length > 0 && (
            <Card title="Held for orders">
              <ul className="divide-y border-t">
                {detail.activeReservations.map((r) => (
                  <li key={r.id} className="flex justify-between px-4 py-2">
                    <span className="font-mono">{r.order?.orderNumber ?? "Checkout in progress"}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {r.quantity}, expires {rel(r.expiresAt)}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {detail && (
            <Card title="Latest movements" action={<span className="text-muted-foreground">{detail.recentMovements.length} {detail.recentMovements.length === 1 ? "row" : "rows"}</span>}>
              {detail.recentMovements.length === 0 ? (
                <p className="px-4 pb-4 text-muted-foreground">No movements yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="text-left text-xs text-muted-foreground">
                      <tr className="border-y [&>th]:px-3 [&>th]:py-2.5 [&>th]:font-semibold">
                        <th>When</th>
                        <th>Type</th>
                        <th>Where</th>
                        <th className="text-right">Qty</th>
                        <th className="text-right">On hand</th>
                      </tr>
                    </thead>
                    <tbody className="tabular-nums">
                      {detail.recentMovements.map((m) => (
                        <tr key={m.id} className="border-b border-border/60 last:border-b-0 [&>td]:px-3 [&>td]:py-[9px]">
                          <td className="whitespace-nowrap text-muted-foreground">{fmtDateTime(m.createdAt)}</td>
                          <td>
                            <MovementTag movement={m} />
                            {m.note && <div className="mt-0.5 max-w-56 truncate text-xs text-muted-foreground">{m.note}</div>}
                          </td>
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
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}
        </div>
        <SheetFooter className="flex-row justify-end border-t bg-card px-5 py-3">
          <Button onClick={onClose}>Done</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
