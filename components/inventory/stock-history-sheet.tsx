"use client"

import { useEffect, useState } from "react"
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
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import type { StorageLocation, VariantStock, VariantStockDetail } from "@/types/inventory.type"

import { Card, fmtDateTime, MeterKey, n0, RackTag, rel, StockMeter, taka, WarehouseTag } from "./inventory-ui"
import { MOVEMENT_LABEL, MovementQuantity, movementRacks } from "./movements-table"
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

  const facts = [
    ["SKU", <span key="sku" className="font-mono">{variant.sku}</span>],
    ["Storefront stock", <span key="st" className="text-xl font-bold">{n0(variant.stock)}</span>],
    ["On hand everywhere", <span key="oh" className="text-xl font-bold">{n0(variant.onHand)}</span>],
    ["Value", taka(value)],
    ["Low-stock alert at", n0(variant.lowStockThreshold)],
  ] as const

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full gap-0 bg-muted/50 data-[side=right]:sm:max-w-3xl">
        <SheetHeader className="border-b bg-card">
          <SheetDescription>{variant.product.name}</SheetDescription>
          <SheetTitle className="text-xl">{variant.name}</SheetTitle>
        </SheetHeader>

        <div className="flex-1 space-y-4 overflow-y-auto p-4 text-sm">
          <section className="rounded-xl border bg-card">
            <div className="flex flex-wrap gap-x-7 gap-y-3 px-4 py-3.5">
              {facts.map(([name, factValue]) => (
                <div key={name}>
                  <span className="block text-xs text-muted-foreground">{name}</span>
                  <div className="font-semibold">{factValue}</div>
                </div>
              ))}
            </div>
            <p className="px-4 pb-3.5 text-[12.5px] text-muted-foreground">
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
                    <tr className="border-y [&>th]:px-3 [&>th]:py-2 [&>th]:font-medium">
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
                        className={cn("border-b last:border-b-0 [&>td]:px-3 [&>td]:py-2", l.warehouseId === highlightWarehouseId && "bg-primary/5")}
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
                <ul className="divide-y border-t">
                  {detail.recentMovements.map((m) => (
                    <li key={m.id} className="flex items-start justify-between gap-3 px-4 py-2.5">
                      <div className="min-w-0">
                        <div className="font-medium">{MOVEMENT_LABEL[m.type]}</div>
                        <div className="text-xs text-muted-foreground">
                          {fmtDateTime(m.createdAt)} · {m.inventoryLevel.warehouse.code}
                          {movementRacks(m) && ` · ${movementRacks(m)}`}
                        </div>
                        {m.note && <div className="mt-0.5 text-xs text-muted-foreground">{m.note}</div>}
                      </div>
                      <div className="flex shrink-0 flex-col items-end">
                        <MovementQuantity movement={m} />
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {m.onHandBefore} → {m.onHandAfter}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
