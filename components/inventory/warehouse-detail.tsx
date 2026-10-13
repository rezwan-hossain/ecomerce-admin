"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { ArchiveIcon, ChevronLeftIcon, MapIcon, MapPinIcon, PencilIcon, StoreIcon, WarehouseIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { FloorPlan, PutAwayLine } from "@/types/rack-map.type"
import type { LedgerMovement, MovementType, StockLevel, StorageLocation, VariantStock } from "@/types/inventory.type"
import type { Warehouse } from "@/types/warehouse.type"

import { Card, fmtDate, fmtDateTime, Kpis, n0, Pill, RackTag, rel, StatusPill, StockMeter, taka, WarehouseTag } from "./inventory-ui"
import { MovementQuantity, MovementTag, movementRacks } from "./movements-table"
import { StockCard, WAREHOUSE_TYPE_LABEL, WarehouseSheet } from "./setup"

const th = "px-3 py-2 font-medium first:pl-4 last:pr-4"
const td = "px-3 py-2.5 first:pl-4 last:pr-4"
const DAY = 86_400_000

type Level = { variant: VariantStock; level: StockLevel }

// A bar with a label and a value, for shares of a whole.
function Share({ text, value, total, tone, detail }: { text: string; value: number; total: number; tone: string; detail: string }) {
  const percent = total > 0 ? (value / total) * 100 : 0
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="text-muted-foreground">{text}</span>
        <span className="font-semibold tabular-nums">{detail}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", tone)} style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}

export function WarehouseDetail({
  warehouse,
  totals,
  racks,
  levels,
  movements,
  putAway,
}: {
  warehouse: Warehouse
  totals: FloorPlan["totals"] | null
  racks: StorageLocation[]
  levels: Level[]
  movements: LedgerMovement[]
  putAway: PutAwayLine[]
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)

  const sells = warehouse.isActive && (warehouse.type === "PHYSICAL" || warehouse.type === "STORE")
  const sum = (pick: (l: StockLevel) => number) => levels.reduce((s, l) => s + pick(l.level), 0)
  const units = { available: sum((l) => l.available), reserved: sum((l) => l.reserved), incoming: sum((l) => l.incoming), damaged: sum((l) => l.damaged) }
  const stocked = levels.filter((l) => l.level.onHand > 0)

  // Out of stock first, then the lowest against their alert. Stock that isn't for sale has no alerts.
  const attention = sells
    ? levels.filter((l) => l.level.available <= l.variant.lowStockThreshold).sort((a, b) => a.level.available - b.level.available)
    : []
  const out = attention.filter((l) => l.level.available <= 0).length
  const low = attention.length - out

  const valueOf = (l: Level) => Number(l.level.unitCost) * l.level.onHand
  const stockValue = Number(warehouse.counts.stockValue)
  const topValue = [...stocked].sort((a, b) => valueOf(b) - valueOf(a)).filter((l) => valueOf(l) > 0).slice(0, 6)

  // The last 30 days of ledger rows, from the newest 100.
  const since = Date.now() - 30 * DAY
  const recent = movements.filter((m) => new Date(m.createdAt).getTime() >= since)
  const unitsIn = recent.filter((m) => m.direction === "IN").reduce((s, m) => s + m.quantity, 0)
  const unitsOut = recent.filter((m) => m.direction === "OUT").reduce((s, m) => s + m.quantity, 0)
  const byType = new Map<MovementType, number>()
  for (const m of recent) byType.set(m.type, (byType.get(m.type) ?? 0) + 1)
  const types = [...byType.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
  const capped = movements.length === 100 && recent.length === 100

  const shelves = racks.filter((r) => r.code !== "UNASSIGNED").sort((a, b) => b.totalUnits - a.totalUnits)
  // What each rack holds, most units first: "MacBook Pro 14 · 16GB ×22".
  const contents = new Map<string, { text: string; quantity: number }[]>()
  for (const { variant: v, level } of levels) {
    for (const s of level.locationStocks) {
      if (s.quantity <= 0) continue
      const text = v.name !== v.sku ? `${v.product.name} · ${v.name}` : v.product.name
      contents.set(s.location.id, [...(contents.get(s.location.id) ?? []), { text, quantity: s.quantity }])
    }
  }
  const holds = (rackId: string) => {
    const items = (contents.get(rackId) ?? []).sort((a, b) => b.quantity - a.quantity)
    const shown = items.slice(0, 2).map((i) => `${i.text} ×${n0(i.quantity)}`).join(", ")
    if (items.length > 2) return `${shown} +${items.length - 2} more`
    return shown
  }
  const address = [warehouse.addressLine1, warehouse.addressLine2, warehouse.city, warehouse.state, warehouse.postalCode].filter(Boolean)
  const onRacks = totals?.unitsOnRacks ?? 0
  const toPutAway = totals?.unitsToPutAway ?? 0

  let Icon = WarehouseIcon
  if (warehouse.type === "STORE") Icon = StoreIcon
  if (warehouse.type.startsWith("VIRTUAL")) Icon = ArchiveIcon

  async function changed(deleted?: boolean) {
    if (deleted) router.push("/inventory/setup/warehouses")
    else router.refresh()
  }

  const mapHref = `/inventory/setup/warehouses/${warehouse.id}/map`

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <header className="flex flex-col gap-3 px-4 lg:px-6">
        <Link href="/inventory/setup/warehouses" className="inline-flex items-center gap-1 self-start text-[13px] text-muted-foreground hover:text-foreground">
          <ChevronLeftIcon className="size-3.5" />
          Warehouses
        </Link>
        <div className="flex flex-wrap items-center gap-4">
          <span
            className={cn(
              "hidden size-14 shrink-0 place-items-center rounded-2xl sm:grid",
              sells ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
            )}
          >
            <Icon className="size-7" />
          </span>
          <div className="min-w-0 flex-1 basis-72">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{warehouse.name}</h1>
              <WarehouseTag code={warehouse.code} />
              {warehouse.isActive ? <StatusPill status="ACTIVE" text="Active" /> : <StatusPill status="DISMISSED" text="Inactive" />}
              {warehouse.isDefault && <Pill tone="blue">Default</Pill>}
              {sells ? <Pill tone="green">Sells to storefront</Pill> : <Pill tone="grey">Not for sale</Pill>}
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span>{WAREHOUSE_TYPE_LABEL[warehouse.type]}</span>
              <span className="inline-flex items-center gap-1">
                <MapPinIcon className="size-3.5" />
                {address.join(", ") || "No address"}
              </span>
              <span>Priority {warehouse.priority}</span>
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <PencilIcon />
              Edit
            </Button>
            <Button size="sm" nativeButton={false} render={<Link href={mapHref} />}>
              <MapIcon />
              Rack map
            </Button>
          </div>
        </div>
      </header>

      <Kpis
        items={[
          { label: "Units on hand", value: n0(warehouse.counts.unitsOnHand), hint: `${n0(units.available)} available · ${n0(units.reserved)} held` },
          { label: "Stock value", value: taka(stockValue), hint: stockValue === 0 && warehouse.counts.unitsOnHand > 0 ? "no unit cost recorded" : "at unit cost", warn: stockValue === 0 && warehouse.counts.unitsOnHand > 0 },
          { label: "SKUs in stock", value: n0(warehouse.counts.variantsStocked), hint: `of ${n0(levels.length)} tracked here` },
          { label: "Racks and bins", value: n0(warehouse.counts.locations), hint: totals ? `${n0(totals.binsUsed)} of ${n0(totals.binsTotal)} bins in use` : "no floor plan" },
          { label: "To put away", value: n0(toPutAway), hint: `${n0(putAway.length)} lines not on a rack`, warn: toPutAway > 0 },
          { label: "Needs attention", value: n0(attention.length), hint: sells ? `${n0(out)} out · ${n0(low)} low` : "not for sale", warn: attention.length > 0 },
        ]}
      />

      <div className="grid gap-4 px-4 md:gap-6 lg:px-6 xl:grid-cols-3">
        <Card title="Stock health" className="xl:col-span-2">
          <div className="grid gap-6 px-4 pb-4 md:grid-cols-2">
            <div className="flex flex-col gap-3">
              <span className="text-xs font-medium text-muted-foreground">Units</span>
              <StockMeter large {...units} />
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                {[
                  { text: "Available", value: units.available, dot: "bg-emerald-600" },
                  { text: "Held for orders", value: units.reserved, dot: "bg-amber-500" },
                  { text: "Incoming", value: units.incoming, dot: "bg-slate-400" },
                  { text: "Damaged", value: units.damaged, dot: "bg-red-600" },
                ].map((row) => (
                  <div key={row.text} className="flex items-center justify-between gap-2">
                    <dt className="flex items-center gap-1.5 text-muted-foreground">
                      <span className={cn("size-2 rounded-full", row.dot)} />
                      {row.text}
                    </dt>
                    <dd className="font-semibold tabular-nums">{n0(row.value)}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="flex flex-col gap-3">
              <span className="text-xs font-medium text-muted-foreground">SKUs and racks</span>
              <Share
                text="Healthy SKUs"
                value={levels.length - attention.length}
                total={Math.max(1, levels.length)}
                tone="bg-emerald-600"
                detail={`${n0(Math.max(0, levels.length - attention.length))} of ${n0(levels.length)}`}
              />
              <Share text="Low or out" value={attention.length} total={Math.max(1, levels.length)} tone="bg-amber-500" detail={n0(attention.length)} />
              <Share
                text="Units on racks"
                value={onRacks}
                total={Math.max(1, onRacks + toPutAway)}
                tone="bg-primary"
                detail={`${Math.round((onRacks / Math.max(1, onRacks + toPutAway)) * 100)}%`}
              />
            </div>
          </div>
        </Card>

        <Card title="Last 30 days" action={capped && <span className="text-xs text-muted-foreground">latest 100 movements</span>}>
          <div className="flex flex-col gap-4 px-4 pb-4">
            <div className="grid grid-cols-3 divide-x rounded-xl border bg-muted/30 text-center">
              <div className="px-2 py-2.5">
                <div className="text-lg font-bold text-emerald-700 tabular-nums dark:text-emerald-400">+{n0(unitsIn)}</div>
                <div className="text-[11px] text-muted-foreground">Units in</div>
              </div>
              <div className="px-2 py-2.5">
                <div className="text-lg font-bold text-red-700 tabular-nums dark:text-red-400">−{n0(unitsOut)}</div>
                <div className="text-[11px] text-muted-foreground">Units out</div>
              </div>
              <div className="px-2 py-2.5">
                <div className="text-lg font-bold tabular-nums">{n0(recent.length)}</div>
                <div className="text-[11px] text-muted-foreground">Movements</div>
              </div>
            </div>
            {types.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing moved in the last 30 days.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {types.map(([type, count]) => (
                  <li key={type} className="flex items-center justify-between gap-2 text-sm">
                    <MovementTag movement={{ type, direction: recent.find((m) => m.type === type)!.direction }} />
                    <span className="text-muted-foreground tabular-nums">
                      {n0(count)} {count === 1 ? "time" : "times"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <div className="flex min-w-0 flex-col gap-4 md:gap-6 xl:col-span-2">
          <Card
            title="Needs attention"
            action={
              <Link href="/inventory/stock" className="text-xs font-medium text-primary hover:underline">
                Stock levels
              </Link>
            }
          >
            {attention.length === 0 ? (
              <p className="px-4 pb-4 text-sm text-muted-foreground">
                {sells ? "Every SKU here is above its low-stock alert." : "This stock isn’t for sale, so low-stock alerts don’t apply."}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                    <tr>
                      <th className={th}>Product</th>
                      <th className={`${th} hidden sm:table-cell`}>Rack</th>
                      <th className={`${th} text-right`}>Available</th>
                      <th className={`${th} hidden text-right sm:table-cell`}>Alert at</th>
                      <th className={th}>Status</th>
                    </tr>
                  </thead>
                  <tbody className="tabular-nums">
                    {attention.slice(0, 8).map(({ variant: v, level: l }) => (
                      <tr key={v.variantId} className="border-t border-border/60">
                        <td className={td}>
                          <Link href={`/products/${v.product.id}`} className="font-medium hover:text-primary hover:underline">
                            {v.product.name}
                          </Link>
                          {v.name !== v.sku && <span className="text-muted-foreground"> · {v.name}</span>}
                          <div className="font-mono text-[11.5px] text-muted-foreground">{v.sku}</div>
                        </td>
                        <td className={`${td} hidden sm:table-cell`}>
                          <RackTag code={l.defaultLocation?.code ?? null} />
                        </td>
                        <td className={`${td} text-right font-semibold`}>{n0(l.available)}</td>
                        <td className={`${td} hidden text-right text-muted-foreground sm:table-cell`}>{n0(v.lowStockThreshold)}</td>
                        <td className={td}>{l.available <= 0 ? <Pill tone="red">Out of stock</Pill> : <Pill tone="amber">Low</Pill>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {attention.length > 8 && (
                  <p className="border-t px-4 py-2 text-xs text-muted-foreground">And {n0(attention.length - 8)} more in Stock levels.</p>
                )}
              </div>
            )}
          </Card>

          <StockCard warehouseId={warehouse.id} />

          <Card
            title="Recent movements"
            action={
              <Link href="/inventory/movements" className="text-xs font-medium text-primary hover:underline">
                All movements
              </Link>
            }
          >
            {movements.length === 0 ? (
              <p className="px-4 pb-4 text-sm text-muted-foreground">No stock has moved here yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                    <tr>
                      <th className={th}>When</th>
                      <th className={th}>Type</th>
                      <th className={`${th} hidden md:table-cell`}>Product</th>
                      <th className={`${th} hidden sm:table-cell`}>Rack</th>
                      <th className={`${th} text-right`}>Qty</th>
                      <th className={`${th} hidden text-right 2xl:table-cell`}>After</th>
                    </tr>
                  </thead>
                  <tbody className="tabular-nums">
                    {movements.slice(0, 12).map((m) => (
                      <tr key={m.id} className="border-t border-border/60">
                        <td className={`${td} whitespace-nowrap text-muted-foreground`} title={fmtDateTime(m.createdAt)}>
                          {rel(m.createdAt)}
                        </td>
                        <td className={td}>
                          <MovementTag movement={m} />
                        </td>
                        <td className={`${td} hidden max-w-48 md:table-cell`}>
                          <div className="truncate">{m.inventoryLevel.variant.product.name}</div>
                          <div className="truncate font-mono text-[11px] text-muted-foreground" title={m.inventoryLevel.variant.sku}>
                            {m.inventoryLevel.variant.sku}
                          </div>
                        </td>
                        <td className={`${td} hidden sm:table-cell`}>{movementRacks(m) && <RackTag code={movementRacks(m)} />}</td>
                        <td className={`${td} text-right`}>
                          <MovementQuantity movement={m} />
                        </td>
                        <td className={`${td} hidden text-right text-muted-foreground 2xl:table-cell`}>{n0(m.onHandAfter)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-4 md:gap-6">
          <Card title="Details">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 px-4 pb-4 text-sm">
              <dt className="text-muted-foreground">Type</dt>
              <dd>{WAREHOUSE_TYPE_LABEL[warehouse.type]}</dd>
              <dt className="text-muted-foreground">Storefront</dt>
              <dd>{sells ? "Its stock can be sold" : "Its stock isn’t for sale"}</dd>
              <dt className="text-muted-foreground">Priority</dt>
              <dd>
                {warehouse.priority} <span className="text-muted-foreground">· higher reserves first</span>
              </dd>
              <dt className="text-muted-foreground">Address</dt>
              <dd>
                {address.length ? (
                  <address className="not-italic">
                    {warehouse.addressLine1 && <div>{warehouse.addressLine1}</div>}
                    {warehouse.addressLine2 && <div>{warehouse.addressLine2}</div>}
                    <div className="text-muted-foreground">{[warehouse.city, warehouse.state, warehouse.postalCode].filter(Boolean).join(", ")}</div>
                  </address>
                ) : (
                  <span className="text-muted-foreground">Not set</span>
                )}
              </dd>
              <dt className="text-muted-foreground">Floor</dt>
              <dd>
                {warehouse.floorWidth && warehouse.floorDepth ? (
                  `${Number(warehouse.floorWidth)} × ${Number(warehouse.floorDepth)} m`
                ) : (
                  <span className="text-muted-foreground">Not set; set it on the rack map</span>
                )}
              </dd>
              <dt className="text-muted-foreground">Created</dt>
              <dd>{fmtDate(warehouse.createdAt)}</dd>
              <dt className="text-muted-foreground">Updated</dt>
              <dd>{fmtDate(warehouse.updatedAt)}</dd>
              <dt className="text-muted-foreground">ID</dt>
              <dd className="truncate font-mono text-xs leading-5" title={warehouse.id}>
                {warehouse.id}
              </dd>
            </dl>
          </Card>

          <Card title="Top by value" action={<span className="text-xs text-muted-foreground">Share of {taka(stockValue)}</span>}>
            {topValue.length === 0 ? (
              <p className="px-4 pb-4 text-sm text-muted-foreground">No stock here has a unit cost yet, so it has no value to rank.</p>
            ) : (
              <ul className="flex flex-col gap-3 px-4 pb-4">
                {topValue.map((l) => (
                  <li key={l.variant.variantId}>
                    <Share
                      text={l.variant.name !== l.variant.sku ? `${l.variant.product.name} · ${l.variant.name}` : l.variant.product.name}
                      value={valueOf(l)}
                      total={Math.max(1, stockValue)}
                      tone="bg-primary"
                      detail={taka(valueOf(l))}
                    />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card
            title="Waiting for put-away"
            action={
              <Link href={mapHref} className="text-xs font-medium text-primary hover:underline">
                Put away on the map
              </Link>
            }
          >
            {putAway.length === 0 ? (
              <p className="px-4 pb-4 text-sm text-muted-foreground">Everything here is on a rack.</p>
            ) : (
              <ul className="flex flex-col px-4 pb-2">
                {putAway.slice(0, 6).map((line) => (
                  <li key={line.inventoryLevelId} className="flex items-center gap-3 border-b py-2 text-sm last:border-b-0">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-mono text-xs font-semibold">{line.sku}</div>
                      <div className="text-xs text-muted-foreground">
                        {n0(line.quantity)} {line.quantity === 1 ? "unit" : "units"}
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">to</span>
                    <RackTag code={line.suggestedLocationCode} title="Suggested rack" />
                  </li>
                ))}
                {putAway.length > 6 && <li className="py-2 text-xs text-muted-foreground">And {n0(putAway.length - 6)} more lines.</li>}
              </ul>
            )}
          </Card>

          <Card title="Racks" action={<span className="text-xs text-muted-foreground">Fullest first</span>}>
            {totals && totals.binsTotal > 0 && (
              <div className="px-4 pb-3">
                <Share text="Bins in use" value={totals.binsUsed} total={totals.binsTotal} tone="bg-primary" detail={`${n0(totals.binsUsed)} of ${n0(totals.binsTotal)}`} />
              </div>
            )}
            {shelves.length === 0 ? (
              <p className="px-4 pb-4 text-sm text-muted-foreground">No racks yet. Add them on the rack map.</p>
            ) : (
              <ul className="flex flex-col border-t px-4 pb-2">
                {shelves.slice(0, 8).map((r) => (
                  <li key={r.id} className="flex items-center gap-3 border-b py-2 text-sm last:border-b-0">
                    <RackTag code={r.code} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-muted-foreground">{r.name ?? ""}</span>
                      <span className="block truncate text-[11px] text-muted-foreground/80" title={holds(r.id)}>
                        {holds(r.id) || "Empty"}
                      </span>
                    </span>
                    {!r.isActive && <Pill tone="grey">Inactive</Pill>}
                    <span className="font-semibold tabular-nums">{n0(r.totalUnits)}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="border-t px-4 py-3">
              <Button variant="outline" size="sm" className="w-full" nativeButton={false} render={<Link href={mapHref} />}>
                <MapIcon />
                Open rack map
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {editing && <WarehouseSheet warehouse={warehouse} racks={racks} onChanged={changed} onClose={() => setEditing(false)} />}
    </div>
  )
}
