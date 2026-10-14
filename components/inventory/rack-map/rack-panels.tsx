"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRightIcon, ChevronLeftIcon, ClipboardListIcon, PlusIcon, RotateCcwIcon, RotateCwIcon } from "lucide-react"
import { toast } from "sonner"

import { setDefaultRack } from "@/app/actions/inventory.actions"
import { getLocationContents, setPlacement, updateLocationFlags } from "@/app/actions/rack-map.actions"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { facingText } from "@/lib/rack-map/geometry"
import { cn } from "@/lib/utils"
import type { CellStats, FloorItem, FloorPlan, LocationContents, PickRoute, PutAwayLine } from "@/types/rack-map.type"

import { label, n0, Pill, RackTag, rel, taka } from "../inventory-ui"
import type { MoveStart } from "./rack-dialogs"

/* ---------- Colour modes ---------- */

export type Mode = "units" | "value" | "activity" | "route"

// Sequential scales, light to dark. Zero stays white.
const SCALES: Record<Mode, [string, string]> = {
  units: ["#E8F0FA", "#1C5AA4"],
  value: ["#E5F4EA", "#167347"],
  activity: ["#FDEDD9", "#C2560B"],
  route: ["#EEF1F4", "#8A97A6"],
}

export function shade(mode: Mode, t: number) {
  const [from, to] = SCALES[mode].map((hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)))
  return `rgb(${from.map((v, i) => Math.round(v + (to[i] - v) * t)).join(",")})`
}

export const scaleGradient = (mode: Mode) => `linear-gradient(90deg, #fff, ${SCALES[mode][0]} 12%, ${SCALES[mode][1]})`

export function metric(stats: CellStats, mode: Mode) {
  if (mode === "value") return Number(stats.value)
  if (mode === "activity") return stats.movements
  return stats.units
}

export function maxMetric(plan: FloorPlan, mode: Mode) {
  if (mode === "value") return Number(plan.maxCell.value)
  if (mode === "activity") return plan.maxCell.movements
  return plan.maxCell.units
}

export function formatMetric(value: number, mode: Mode) {
  if (mode === "value") return taka(value)
  if (mode === "activity") return `${n0(value)} ${value === 1 ? "move" : "moves"}`
  return `${n0(value)} ${value === 1 ? "unit" : "units"}`
}

// A rack's slot column summed over its levels, which is what the plan colours.
export function slotStats(rack: FloorItem, slotIndex: number): CellStats & { binIds: string[] } {
  const bins = (rack.levels ?? []).flatMap((level) => level.bins.filter((b) => b.slotIndex === slotIndex))
  return {
    units: bins.reduce((s, b) => s + b.stock.units, 0),
    value: String(bins.reduce((s, b) => s + Number(b.stock.value), 0)),
    skuCount: bins.reduce((s, b) => s + b.stock.skuCount, 0),
    movements: bins.reduce((s, b) => s + b.stock.movements, 0),
    binIds: bins.map((b) => b.id),
  }
}

export const box = "rounded-2xl border bg-card p-4"
const heading = "text-[15px] font-semibold"

function Stat({ label: text, value, warn }: { label: string; value: React.ReactNode; warn?: boolean }) {
  return (
    <div className="min-w-0 bg-card px-3 py-2.5">
      <span className="block truncate text-xs text-muted-foreground">{text}</span>
      <strong className={cn("block text-xl font-bold tracking-tight tabular-nums", warn && "text-amber-700")}>{value}</strong>
    </div>
  )
}

/* ---------- Warehouse overview ---------- */

export function OverviewPanel({
  plan,
  putAway,
  query,
  onSelectBin,
  onSelectItem,
  onMove,
  onEdit,
}: {
  plan: FloorPlan
  putAway: PutAwayLine[]
  query: string
  onSelectBin: (binId: string, rackId: string | null) => void
  onSelectItem: (item: FloorItem) => void
  onMove: (start: MoveStart) => void
  onEdit: () => void
}) {
  const [showAll, setShowAll] = useState(false)
  const racks = plan.items.filter((i) => i.type === "RACK").sort((a, b) => a.code.localeCompare(b.code))
  const areas = plan.items.filter((i) => ["RECEIVING", "STAGING", "PACKING", "DAMAGE"].includes(i.type))
  const bins = racks.flatMap((rack) => (rack.levels ?? []).flatMap((level) => level.bins.map((bin) => ({ rack, bin }))))
  const inactive = bins.filter((b) => !b.bin.isActive).length
  const used = bins.filter((b) => b.bin.isActive && b.bin.stock.units > 0).length
  const empty = bins.length - used - inactive
  const notPicked = bins.filter((b) => b.bin.isActive && !b.bin.isPickable).length
  const share = (n: number) => `${bins.length ? (n / bins.length) * 100 : 0}%`
  // Stock that sat still for the whole activity window: candidates to move further from the pick face.
  const untouched = bins
    .filter((b) => b.bin.stock.units > 0 && b.bin.stock.movements === 0)
    .sort((a, b) => b.bin.stock.units - a.bin.stock.units)
    .slice(0, 5)
  const q = query.trim().toLowerCase()
  // Search runs over each bin's top SKUs, which is what the floor plan returns.
  const found = q
    ? racks.flatMap((rack) =>
        (rack.levels ?? []).flatMap((level) =>
          level.bins.flatMap((bin) => bin.topSkus.filter((s) => s.sku.toLowerCase().includes(q)).map((s) => ({ rack, bin, sku: s })))
        )
      )
    : []
  const busiest = racks
    .flatMap((rack) => Array.from({ length: rack.slotCount ?? 0 }, (_, i) => ({ rack, slot: i, stats: slotStats(rack, i) })))
    .filter((c) => c.stats.movements > 0)
    .sort((a, b) => b.stats.movements - a.stats.movements)
    .slice(0, 5)

  return (
    <>
      {q && (
        <section className={box}>
          <h2 className={cn(heading, "mb-2")}>
            Found {found.length} {found.length === 1 ? "place" : "places"}
          </h2>
          {found.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">Nothing matching “{query}” is on a rack here.</p>
          ) : (
            <ul className="divide-y">
              {found.map(({ rack, bin, sku }) => (
                <li key={bin.id + sku.inventoryLevelId}>
                  <button type="button" className="flex w-full items-center gap-2.5 py-2 text-left" onClick={() => onSelectBin(bin.id, rack.id)}>
                    <RackTag code={bin.code} />
                    <span className="min-w-0 flex-1 truncate font-mono text-xs font-semibold">{sku.sku}</span>
                    <b className="tabular-nums">{n0(sku.quantity)}</b>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {plan.unplaced.length > 0 && (
        <section className={cn(box, "flex items-center gap-3 border-dashed py-3")}>
          <p className="flex-1 text-[13px] text-muted-foreground">
            <b className="text-foreground">{plan.unplaced.length}</b> {plan.unplaced.length === 1 ? "location isn’t" : "locations aren’t"} on the map:{" "}
            {plan.unplaced.map((u) => u.code).join(", ")}
          </p>
          <Button size="sm" variant="outline" onClick={onEdit}>Place</Button>
        </section>
      )}

      <section className={box}>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className={heading}>Bin usage</h2>
          <span className="text-[13px] text-muted-foreground tabular-nums">{bins.length} bins on the map</span>
        </div>
        <div className="flex h-2.5 overflow-hidden rounded-full bg-muted" aria-hidden>
          <i className="bg-[#1C5AA4]" style={{ width: share(used) }} />
          <i className="bg-[#C9D8EA]" style={{ width: share(empty) }} />
          <i className="bg-[repeating-linear-gradient(45deg,#C8D1DA_0_3px,#EEF1F4_3px_6px)]" style={{ width: share(inactive) }} />
        </div>
        <dl className="mt-2.5 grid grid-cols-3 gap-2 text-[13px]">
          {[
            { text: "Holding stock", value: used, dot: "bg-[#1C5AA4]" },
            { text: "Empty", value: empty, dot: "bg-[#C9D8EA]" },
            { text: "Inactive", value: inactive, dot: "bg-slate-300" },
          ].map((row) => (
            <div key={row.text}>
              <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className={cn("size-2 rounded-full", row.dot)} />
                {row.text}
              </dt>
              <dd className="font-semibold tabular-nums">{n0(row.value)}</dd>
            </div>
          ))}
        </dl>
        {notPicked > 0 && (
          <p className="mt-2 text-[12.5px] text-muted-foreground">
            {notPicked} active {notPicked === 1 ? "bin is" : "bins are"} set to not be picked from (overflow or reserve).
          </p>
        )}
        <p className="mt-2 text-[12.5px] text-muted-foreground">
          Select a rack to see it from the front. Drag a SKU onto another bin or rack to move it; every move is written to the ledger.
        </p>
      </section>

      <section className={box}>
        <div className="mb-1 flex items-center justify-between">
          <h2 className={heading}>Waiting for put-away</h2>
          <span className="text-[13px] text-muted-foreground">
            {putAway.length} {putAway.length === 1 ? "line" : "lines"}
          </span>
        </div>
        {putAway.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">Nothing waiting at receiving or in Unassigned.</p>
        ) : (
          <ul className="divide-y">
            {putAway.slice(0, showAll ? undefined : 8).map((line) => (
              <li key={line.locationId + line.inventoryLevelId} className="flex items-center gap-2.5 py-2">
                <RackTag code={line.locationCode} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-mono text-xs font-semibold">{line.sku}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {n0(line.quantity)} {line.quantity === 1 ? "unit" : "units"}
                    {line.suggestedLocationCode ? `, suggested ${line.suggestedLocationCode}` : ", no free bin"}
                  </span>
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0"
                  onClick={() =>
                    onMove({ fromId: line.locationId, levelId: line.inventoryLevelId, toId: line.suggestedLocationId ?? undefined, makeDefault: true })
                  }
                >
                  Put away
                </Button>
              </li>
            ))}
          </ul>
        )}
        {putAway.length > 8 && (
          <Button variant="ghost" size="sm" className="mt-1 w-full" onClick={() => setShowAll(!showAll)}>
            {showAll ? "Show fewer" : `Show all ${putAway.length} lines`}
          </Button>
        )}
      </section>

      {areas.length > 0 && (
        <section className={box}>
          <h2 className={cn(heading, "mb-1")}>Docks and areas</h2>
          <ul className="divide-y">
            {areas.map((item) => (
              <li key={item.id}>
                <button type="button" className="flex w-full items-center gap-2.5 py-2 text-left" onClick={() => onSelectItem(item)}>
                  <RackTag code={item.code} />
                  <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                    {item.type === "DAMAGE" ? "Damage section, not for sale" : (item.name ?? label(item.type))}
                  </span>
                  <b className={cn("tabular-nums", item.type === "DAMAGE" && item.stock.units > 0 && "text-destructive")}>{n0(item.stock.units)}</b>
                  <span className="w-9 text-xs text-muted-foreground">{item.stock.units === 1 ? "unit" : "units"}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {busiest.length > 0 && (
        <section className={box}>
          <h2 className={cn(heading, "mb-1")}>Busiest slots, last {plan.activityDays} days</h2>
          <ul className="divide-y">
            {busiest.map(({ rack, slot, stats }) => (
              <li key={rack.id + slot}>
                <button type="button" className="flex w-full items-center gap-2.5 py-2 text-left" onClick={() => onSelectBin(stats.binIds[0], rack.id)}>
                  <RackTag code={`${rack.code} ${"ABCDEFGH"[slot]}`} />
                  <span className="flex-1 text-xs text-muted-foreground">{n0(stats.units)} units now</span>
                  <b className="tabular-nums">{formatMetric(stats.movements, "activity")}</b>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {untouched.length > 0 && (
        <section className={box}>
          <h2 className={heading}>Untouched for {plan.activityDays} days</h2>
          <p className="mb-1 text-[12.5px] text-muted-foreground">Bins holding stock with no movement in or out. Good candidates for higher or farther slots.</p>
          <ul className="divide-y">
            {untouched.map(({ rack, bin }) => (
              <li key={bin.id}>
                <button type="button" className="flex w-full items-center gap-2.5 py-2 text-left" onClick={() => onSelectBin(bin.id, rack.id)}>
                  <RackTag code={bin.code} />
                  <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">{bin.topSkus.map((t) => t.sku).join(", ")}</span>
                  <b className="tabular-nums">{n0(bin.stock.units)}</b>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}

// Every rack on the floor with its fill, stock and activity; a row opens the rack.
export function RackTable({ plan, selectedId, onSelect }: { plan: FloorPlan; selectedId: string | null; onSelect: (rack: FloorItem) => void }) {
  const racks = plan.items.filter((i) => i.type === "RACK").sort((a, b) => a.code.localeCompare(b.code))
  if (racks.length === 0) return null
  return (
        <section className="overflow-hidden rounded-2xl border bg-card pt-4">
          <h2 className={cn(heading, "mb-2 px-4")}>Racks <span className="font-normal text-muted-foreground">· {racks.length}</span></h2>
          <table className="w-full text-[13px]">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr className="[&>th]:px-2 [&>th]:py-1.5 [&>th]:font-medium [&>th:first-child]:pl-4 [&>th:last-child]:pr-4">
                <th>Rack</th>
                <th className="hidden sm:table-cell">Levels × slots</th>
                <th>Bins used</th>
                <th className="hidden text-right sm:table-cell">SKUs</th>
                <th className="text-right">Units</th>
                <th className="text-right">Value</th>
                <th className="text-right">Moves, {plan.activityDays}d</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {racks.map((rack) => {
                const rackBins = (rack.levels ?? []).flatMap((l) => l.bins)
                const full = rackBins.filter((b) => b.stock.units > 0).length
                return (
                  <tr
                    key={rack.id}
                    tabIndex={0}
                    onClick={() => onSelect(rack)}
                    onKeyDown={(e) => e.key === "Enter" && onSelect(rack)}
                    className={cn("cursor-pointer border-t border-border/60 outline-none hover:bg-muted/40 focus-visible:bg-muted/40 [&>td]:px-2 [&>td]:py-1.5 [&>td:first-child]:pl-4 [&>td:last-child]:pr-4", selectedId === rack.id && "bg-[#EEF4FC]")}
                  >
                    <td className="whitespace-nowrap">
                      <RackTag code={rack.code} />
                      {!rack.isActive && <span className="ml-1 text-[11px] text-destructive">inactive</span>}
                    </td>
                    <td className="hidden text-muted-foreground sm:table-cell">{rack.levels?.length ?? 1} × {rack.slotCount ?? 1}</td>
                    <td>
                      <span className="flex items-center gap-1.5">
                        <span className="h-1.5 w-12 overflow-hidden rounded-full bg-muted">
                          <i className="block h-full bg-[#1C5AA4]" style={{ width: `${rackBins.length ? (full / rackBins.length) * 100 : 0}%` }} />
                        </span>
                        <span className="text-xs text-muted-foreground">{full}/{rackBins.length}</span>
                      </span>
                    </td>
                    <td className="hidden text-right text-muted-foreground sm:table-cell">{rack.stock.skuCount}</td>
                    <td className="text-right">{rack.stock.units ? n0(rack.stock.units) : <span className="text-muted-foreground/60">0</span>}</td>
                    <td className="text-right text-muted-foreground">{taka(Number(rack.stock.value))}</td>
                    <td className="text-right text-muted-foreground">{n0(rack.stock.movements)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </section>
  )
}

/* ---------- Rack front view ---------- */

export function RackPanel({
  rack,
  plan,
  mode,
  binId,
  query,
  onBack,
  onSelectBin,
  onRotate,
  onDropSku,
  children,
}: {
  rack: FloorItem
  plan: FloorPlan
  mode: Mode
  binId: string | null
  query: string
  onBack: () => void
  onSelectBin: (id: string) => void
  onRotate: (direction: "cw" | "ccw" | "180") => void
  onDropSku: (data: string, toBinId: string) => void
  children: React.ReactNode
}) {
  const [over, setOver] = useState<string | null>(null)
  const levels = [...(rack.levels ?? [])].reverse() // highest level on top
  const slots = rack.slotCount ?? 1
  const binsAll = levels.flatMap((l) => l.bins)
  const max = Math.max(1, ...binsAll.map((b) => metric(b.stock, mode === "route" ? "units" : mode)))
  const zone = plan.items.find((i) => i.id === rack.parentId)
  const q = query.trim().toLowerCase()
  const usedBins = binsAll.filter((b) => b.stock.units > 0).length
  // What the rack holds, summed over its bins (each bin reports its biggest SKUs).
  const skus = new Map<string, { sku: string; quantity: number; binId: string; bins: number }>()
  for (const bin of binsAll) {
    for (const s of bin.topSkus) {
      const seen = skus.get(s.inventoryLevelId)
      if (seen) {
        seen.quantity += s.quantity
        seen.bins += 1
      } else skus.set(s.inventoryLevelId, { sku: s.sku, quantity: s.quantity, binId: bin.id, bins: 1 })
    }
  }
  const topSkus = [...skus.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 6)
  const facts = [
    { text: "Layout", value: `${rack.levels?.length ?? 1} ${(rack.levels?.length ?? 1) === 1 ? "level" : "levels"} × ${slots} slots` },
    { text: "Size", value: `${rack.placement.length} × ${rack.placement.depth} m` },
    { text: "Walk order", value: String(rack.pickSequence) },
    { text: `Moves, ${plan.activityDays} days`, value: n0(rack.stock.movements) },
    { text: "Not picked from", value: `${binsAll.filter((b) => !b.isPickable).length} bins` },
    { text: "Inactive", value: `${binsAll.filter((b) => !b.isActive).length} bins` },
  ]

  return (
    <>
      <section className={box}>
        <div className="mb-3 flex items-center justify-between">
          <Button variant="ghost" size="sm" className="-ml-2" onClick={onBack}>
            <ChevronLeftIcon data-icon="inline-start" />
            Warehouse
          </Button>
          {!rack.isActive && <Pill tone="red">Inactive</Pill>}
        </div>
        <div className="mb-3 flex items-center gap-3">
          <span className="inline-flex h-7 items-center rounded-[3px] border-[1.5px] border-stone-800 bg-yellow-300 px-2 font-mono text-base font-bold text-stone-900">
            {rack.code}
          </span>
          <div className="min-w-0">
            <strong className="block truncate">{rack.name ?? label(rack.type)}</strong>
            <small className="block text-muted-foreground">{zone ? (zone.name ?? zone.code) : "Not in a zone"}</small>
          </div>
        </div>
        <div className="mb-3 grid grid-cols-4 gap-px overflow-hidden rounded-xl border bg-border">
          <Stat label="Units" value={n0(rack.stock.units)} />
          <Stat label="Value" value={taka(Number(rack.stock.value))} />
          <Stat label="SKUs" value={rack.stock.skuCount} />
          <Stat
            label="Bins used"
            value={
              <>
                {usedBins}
                <small className="text-sm font-medium text-muted-foreground">/{binsAll.length}</small>
              </>
            }
          />
        </div>
        <dl className="mb-3 grid grid-cols-2 gap-x-4 gap-y-1 text-[13px] sm:grid-cols-3">
          {facts.map((f) => (
            <div key={f.text}>
              <dt className="text-xs text-muted-foreground">{f.text}</dt>
              <dd className="font-medium tabular-nums">{f.value}</dd>
            </div>
          ))}
        </dl>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted px-2.5 py-2 text-[13px]">
          <span>{facingText(rack.placement.rotation)}</span>
          <RotateButtons onRotate={onRotate} />
        </div>

        {/* Steel uprights left and right, an orange beam under every level, ground at the bottom. */}
        <div
          role="grid"
          aria-label={`Rack ${rack.code} front view`}
          className="grid border-x-8 border-[#1C5AA4] bg-slate-100 pt-2"
          style={{ gridTemplateColumns: `28px repeat(${slots}, minmax(0, 1fr))` }}
        >
          <div aria-hidden className="contents">
            <span />
            {Array.from({ length: slots }, (_, slot) => (
              <span key={slot} className="pb-1 text-center font-mono text-[11px] font-bold text-slate-500">
                {"ABCDEFGH"[slot]}
              </span>
            ))}
          </div>
          {levels.map((level) => (
            <div key={level.id} role="row" className="contents">
              <div role="rowheader" className="flex items-center justify-center border-b-[6px] border-[#EE8524]">
                {(rack.levels?.length ?? 0) > 1 && (
                  <span className="rounded bg-white px-1 font-mono text-[11px] font-bold text-slate-600 shadow-xs">L{level.levelNumber}</span>
                )}
              </div>
              {Array.from({ length: slots }, (_, slot) => {
                const bin = level.bins.find((b) => b.slotIndex === slot)
                if (!bin) return <div key={slot} className="border-b-[6px] border-l border-dashed border-b-[#EE8524] border-l-slate-300" />
                const t = metric(bin.stock, mode === "route" ? "units" : mode) / max
                const hit = q && bin.topSkus.some((s) => s.sku.toLowerCase().includes(q))
                const short = bin.code.startsWith(`${rack.code}-`) ? bin.code.slice(rack.code.length + 1) : bin.code
                return (
                  <div
                    key={bin.id}
                    role="gridcell"
                    tabIndex={0}
                    aria-label={`${bin.code}: ${bin.stock.units} units`}
                    onClick={() => onSelectBin(bin.id)}
                    onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onSelectBin(bin.id))}
                    onDragOver={(e) => (e.preventDefault(), setOver(bin.id))}
                    onDragLeave={() => setOver(null)}
                    onDrop={(e) => {
                      e.preventDefault()
                      setOver(null)
                      onDropSku(e.dataTransfer.getData("text/plain"), bin.id)
                    }}
                    className={cn(
                      "relative flex min-h-[88px] min-w-0 cursor-pointer flex-col gap-1 border-b-[6px] border-l border-dashed border-b-[#EE8524] border-l-slate-300 px-1.5 pt-1.5 pb-2 outline-none hover:shadow-[inset_0_0_0_2px_rgba(20,32,43,.25)] focus-visible:shadow-[inset_0_0_0_3px_var(--color-primary)]",
                      binId === bin.id && "shadow-[inset_0_0_0_2px_var(--color-primary)] ring-0",
                      over === bin.id && "bg-orange-100! shadow-[inset_0_0_0_3px_#EE8524]",
                      hit && "shadow-[inset_0_0_0_3px_#F5C518]",
                      !bin.isActive && "bg-[repeating-linear-gradient(45deg,#EEF1F4_0_6px,#E1E6EB_6px_12px)]!"
                    )}
                    style={{ background: binId === bin.id ? "#EEF4FC" : bin.stock.units && bin.isActive ? shade(mode, 0.08 + t * 0.5) : "#fff" }}
                  >
                    <span className="font-mono text-xs font-bold text-slate-600">{short}</span>
                    {bin.stock.units ? (
                      <strong className="text-[22px] leading-none font-bold tabular-nums">{n0(bin.stock.units)}</strong>
                    ) : (
                      <span className="text-xs text-muted-foreground">Empty</span>
                    )}
                    {!bin.isPickable && (
                      <span className="absolute top-1 right-1 rounded-[3px] border bg-white px-1 text-[10px] font-semibold text-muted-foreground">Not picked</span>
                    )}
                    <span className="mt-auto flex flex-wrap gap-0.5">
                      {bin.topSkus.slice(0, 3).map((s) => (
                        <span
                          key={s.inventoryLevelId}
                          draggable
                          onDragStart={(e) => e.dataTransfer.setData("text/plain", `${s.inventoryLevelId}|${bin.id}`)}
                          title={`${s.sku}: ${s.quantity}. Drag to move`}
                          className={cn(
                            "inline-flex max-w-full cursor-grab items-center gap-1 overflow-hidden rounded border border-slate-300 bg-white px-1 font-mono text-[11px] font-semibold whitespace-nowrap",
                            q && s.sku.toLowerCase().includes(q) && "border-stone-800 bg-yellow-300"
                          )}
                        >
                          {s.sku.split("-").slice(-2).join("-")}
                          <b className="text-[#1C5AA4]">{s.quantity}</b>
                        </span>
                      ))}
                      {bin.stock.skuCount > 3 && <span className="px-1 text-[11px] text-muted-foreground">+{bin.stock.skuCount - 3}</span>}
                    </span>
                  </div>
                )
              })}
            </div>
          ))}
          <div aria-hidden className="col-span-full -mx-2 h-1.5 bg-[repeating-linear-gradient(90deg,#3A4754_0_10px,transparent_10px_14px)]" />
        </div>
        <p className="mt-2 text-[12.5px] text-muted-foreground">
          Front view, ground level at the bottom. Colour follows the map mode. Drag a SKU chip onto another bin to move it.
        </p>
      </section>
      {topSkus.length > 0 && (
        <section className={box}>
          <h2 className={cn(heading, "mb-1")}>On this rack</h2>
          <ul className="divide-y">
            {topSkus.map((s) => (
              <li key={s.sku}>
                <button type="button" className="flex w-full items-center gap-2.5 py-1.5 text-left" onClick={() => onSelectBin(s.binId)}>
                  <span className="min-w-0 flex-1 truncate font-mono text-xs font-semibold">{s.sku}</span>
                  {s.bins > 1 && <span className="text-xs text-muted-foreground">{s.bins} bins</span>}
                  <b className="tabular-nums">{n0(s.quantity)}</b>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {children}
    </>
  )
}

export function RotateButtons({ onRotate }: { onRotate: (direction: "cw" | "ccw" | "180") => void }) {
  return (
    <span role="group" aria-label="Rotate" className="inline-flex gap-1">
      <Button variant="outline" size="icon-sm" className="bg-card" title="Rotate left (Shift+R)" aria-label="Rotate 90 degrees counterclockwise" onClick={() => onRotate("ccw")}>
        <RotateCcwIcon />
      </Button>
      <Button variant="outline" size="icon-sm" className="bg-card" title="Rotate right (R)" aria-label="Rotate 90 degrees clockwise" onClick={() => onRotate("cw")}>
        <RotateCwIcon />
      </Button>
      <Button variant="outline" size="sm" className="bg-card" title="Turn around" onClick={() => onRotate("180")}>
        180°
      </Button>
    </span>
  )
}

/* ---------- Bin detail ---------- */

export function BinDetail({
  binId,
  warehouseId,
  version,
  onMove,
  onCount,
  onAddStock,
  onChanged,
}: {
  binId: string
  warehouseId: string
  version: number // bumped after every write so the contents reload
  onMove: (start: MoveStart) => void
  onCount: (contents: LocationContents) => void
  onAddStock: (binId: string, binCode: string) => void
  onChanged: () => void
}) {
  const [data, setData] = useState<LocationContents | null>(null)
  const [error, setError] = useState("")
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    getLocationContents(binId).then((res) => {
      if (res.success) {
        setData(res.data)
        setError("")
      } else setError(res.error)
    })
  }, [binId, version])

  if (error) return <section className={cn(box, "text-sm text-destructive")}>Couldn’t load this location: {error}</section>
  if (!data) return <section className={cn(box, "text-sm text-muted-foreground")}>Loading location...</section>
  // While the next bin loads, keep the last one on screen (dimmed, not clickable) so the panel doesn't jump.
  const loading = data.location.id !== binId

  const loc = data.location
  const isArea = loc.type === "RECEIVING" || loc.type === "STAGING"
  const units = data.rows.reduce((s, r) => s + r.quantity, 0)
  const value = data.rows.reduce((s, r) => s + Number(r.value), 0)

  async function flag(dto: { isPickable?: boolean; isActive?: boolean }) {
    const res = await updateLocationFlags(loc.id, dto)
    if (!res.success) return toast.error(res.error)
    toast.success(`${loc.code} updated`)
    onChanged()
  }

  async function makeDefault(variantId: string, sku: string) {
    const res = await setDefaultRack(variantId, warehouseId, loc.id)
    if (!res.success) return toast.error(res.error)
    toast.success(`${loc.code} is now the default pick location for ${sku}`)
    onChanged()
  }

  return (
    <section className={cn(box, "transition-opacity", loading && "pointer-events-none opacity-50")} aria-busy={loading}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <RackTag code={loc.code} />
          <span className="text-[13px] text-muted-foreground">
            {label(loc.type)}
            {loc.name ? `, ${loc.name}` : ""}
          </span>
        </div>
        <div className="flex gap-1">
          {loc.isPickable ? <Pill tone="green">Pickable</Pill> : <Pill tone="grey">Not picked</Pill>}
          {!loc.isActive && <Pill tone="red">Inactive</Pill>}
        </div>
      </div>
      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
        <span><b className="text-foreground tabular-nums">{n0(units)}</b> units</span>
        <span><b className="text-foreground tabular-nums">{taka(value)}</b> value</span>
        <span><b className="text-foreground tabular-nums">{data.rows.length}</b> {data.rows.length === 1 ? "SKU" : "SKUs"}</span>
        <span>Walk order <b className="text-foreground tabular-nums">{loc.pickSequence}</b></span>
      </div>

      {data.rows.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">Empty. Drop a SKU here to move stock in.</p>
      ) : (
        <div className="rounded-lg border">
          <table className="w-full table-fixed text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr className="[&>th]:px-2.5 [&>th]:py-2 [&>th]:font-medium">
                <th>Item</th>
                <th className="w-14 text-right">Qty</th>
                <th className="w-[92px]"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {data.rows.slice(0, showAll ? undefined : 10).map((r) => (
                <tr key={r.inventoryLevelId} className="border-t align-top [&>td]:px-2.5 [&>td]:py-2">
                  <td>
                    <span
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData("text/plain", `${r.inventoryLevelId}|${loc.id}`)}
                      title={`${r.sku}. Drag to another bin`}
                      className="block cursor-grab truncate font-mono text-xs font-semibold"
                    >
                      {r.sku}
                    </span>
                    <small className="block truncate text-xs text-muted-foreground">
                      {r.productName}, {r.variantLabel} · {taka(Number(r.value))}
                    </small>
                    {r.isDefault && <span className="mt-1 inline-block"><Pill tone="blue">Default pick location</Pill></span>}
                  </td>
                  <td className="text-right font-semibold">{n0(r.quantity)}</td>
                  <td className="text-right">
                    <div className="flex flex-col items-end gap-1">
                      <Button size="xs" variant={isArea ? "default" : "outline"} onClick={() => onMove({ fromId: loc.id, levelId: r.inventoryLevelId, makeDefault: isArea })}>
                        {isArea ? "Put away" : "Move"}
                      </Button>
                      {!r.isDefault && loc.isPickable && !isArea && (
                        <Button size="xs" variant="ghost" onClick={() => makeDefault(r.variantId, r.sku)}>
                          Make default
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.rows.length > 10 && (
            <Button variant="ghost" size="sm" className="w-full rounded-t-none border-t" onClick={() => setShowAll(!showAll)}>
              {showAll ? "Show fewer" : `Show all ${data.rows.length} items`}
            </Button>
          )}
        </div>
      )}

      {!isArea && (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          {loc.isActive && (
            <Button size="sm" onClick={() => onAddStock(loc.id, loc.code)}>
              <PlusIcon data-icon="inline-start" />
              Add stock here
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => onCount(data)}>
            <ClipboardListIcon data-icon="inline-start" />
            Count this {loc.type === "BIN" ? "bin" : "location"}
          </Button>
          <label className="flex items-center gap-2 text-[13px]">
            <Switch checked={loc.isPickable} onCheckedChange={(v) => flag({ isPickable: v })} />
            Pick from here
          </label>
          <label className="flex items-center gap-2 text-[13px]" title={units && loc.isActive ? "Move the stock out before switching it off" : undefined}>
            <Switch checked={loc.isActive} disabled={units > 0 && loc.isActive} onCheckedChange={(v) => flag({ isActive: v })} />
            Active
          </label>
        </div>
      )}

      {data.recentMovements.length > 0 && (
        <>
          <h3 className="mt-4 mb-1.5 text-[13px] font-semibold">Latest movements here</h3>
          <ul className="flex flex-col gap-1.5 text-[13px]">
            {data.recentMovements.slice(0, 6).map((m) => {
              const into = m.toLocationCode === loc.code
              let where = into ? "in" : "out"
              if (into && m.fromLocationCode) where = `in from ${m.fromLocationCode}`
              if (!into && m.toLocationCode) where = `out to ${m.toLocationCode}`
              return (
                <li key={m.id} className="flex flex-wrap items-center gap-2">
                  <span className={cn("font-semibold tabular-nums", into ? "text-emerald-700" : "text-red-700")}>
                    {into ? "+" : "−"}
                    {n0(m.quantity)}
                  </span>
                  <span className="font-mono text-xs font-semibold">{m.sku}</span>
                  <span className="text-muted-foreground">{where}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{rel(m.createdAt)}</span>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </section>
  )
}

// The damage section is view only: damaged units are never moved, counted or picked from here.
export function DamagePanel({ locationId, warehouseId, version }: { locationId: string; warehouseId: string; version: number }) {
  const [data, setData] = useState<LocationContents | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    getLocationContents(locationId).then((res) => {
      if (res.success) {
        setData(res.data)
        setError("")
      } else setError(res.error)
    })
  }, [locationId, version])

  if (error) return <section className={cn(box, "text-sm text-destructive")}>Couldn’t load the damage section: {error}</section>
  if (!data) return <section className={cn(box, "text-sm text-muted-foreground")}>Loading damage section...</section>

  const units = data.rows.reduce((s, r) => s + r.quantity, 0)
  const value = data.rows.reduce((s, r) => s + Number(r.value), 0)

  return (
    <section className={cn(box, "border-red-200")}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <RackTag code={data.location.code} />
          <span className="text-[13px] text-muted-foreground">Damage section</span>
        </div>
        <Pill tone="red">Not for sale</Pill>
      </div>
      <p className="mb-3 text-[13px] text-muted-foreground">
        Units written off as damaged land here. They never count as sellable stock and are never picked.
      </p>
      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
        <span><b className="text-destructive tabular-nums">{n0(units)}</b> units</span>
        <span><b className="text-foreground tabular-nums">{taka(value)}</b> value</span>
        <span><b className="text-foreground tabular-nums">{data.rows.length}</b> {data.rows.length === 1 ? "SKU" : "SKUs"}</span>
      </div>

      {data.rows.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">No damaged stock here.</p>
      ) : (
        <ul className="divide-y rounded-lg border text-sm">
          {data.rows.slice(0, 10).map((r) => (
            <li key={r.inventoryLevelId} className="flex items-start gap-2 px-2.5 py-2">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-mono text-xs font-semibold">{r.sku}</span>
                <small className="block truncate text-xs text-muted-foreground">
                  {r.productName}, {r.variantLabel} · {taka(Number(r.value))}
                </small>
              </span>
              <span className="font-semibold text-destructive tabular-nums">{n0(r.quantity)}</span>
            </li>
          ))}
        </ul>
      )}

      <Button size="sm" variant="outline" className="mt-3" nativeButton={false} render={<Link href={`/inventory/damaged?warehouseId=${warehouseId}`} />}>
        View all damaged stock
        <ArrowRightIcon data-icon="inline-end" />
      </Button>

      {data.recentMovements.length > 0 && (
        <>
          <h3 className="mt-4 mb-1.5 text-[13px] font-semibold">Latest damage</h3>
          <ul className="flex flex-col gap-1.5 text-[13px]">
            {data.recentMovements.slice(0, 6).map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-red-700 tabular-nums">{n0(m.quantity)}</span>
                <span className="font-mono text-xs font-semibold">{m.sku}</span>
                {m.fromLocationCode && <span className="text-muted-foreground">from {m.fromLocationCode}</span>}
                <span className="ml-auto text-xs text-muted-foreground">{rel(m.createdAt)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

/* ---------- Pick route ---------- */

export function RoutePanel({
  orders,
  orderId,
  route,
  onOrder,
  onStop,
}: {
  orders: { orderId: string; lines: number }[] | null
  orderId: string | null
  route: PickRoute | null
  onOrder: (orderId: string) => void
  onStop: (locationId: string, rackId: string | null) => void
}) {
  return (
    <>
      <section className={box}>
        <h2 className={cn(heading, "mb-2")}>Pick route</h2>
        {orders === null && <p className="text-[13px] text-muted-foreground">Loading orders...</p>}
        {orders?.length === 0 && <p className="text-[13px] text-muted-foreground">No orders have stock held in this warehouse yet.</p>}
        {orders && orders.length > 0 && (
          <>
            <label htmlFor="route-order" className="mb-1 block text-[13px] font-medium">
              Order with stock held here
            </label>
            <select
              id="route-order"
              className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
              value={orderId ?? ""}
              onChange={(e) => onOrder(e.target.value)}
            >
              {orders.map((o) => (
                <option key={o.orderId} value={o.orderId}>
                  {o.orderId}, {o.lines} {o.lines === 1 ? "line" : "lines"}
                </option>
              ))}
            </select>
            <p className="mt-2 text-[12.5px] text-muted-foreground">
              Bins are visited in walk order along the aisles, starting and ending at {route?.startLocationCode ?? "the packing bench"}. This is the plan
              shipping the order will pick from.
            </p>
          </>
        )}
      </section>
      {route && (
        <section className={box}>
          <ol className="divide-y">
            {route.stops.map((stop) => (
              <li key={stop.sequence + stop.inventoryLevelId} className="flex items-center gap-2.5 py-2">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[#EE8524] text-xs font-bold text-white">{stop.sequence}</span>
                <button type="button" onClick={() => onStop(stop.locationId, stop.rackId)}>
                  <RackTag code={stop.locationCode} />
                </button>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-mono text-xs font-semibold">{stop.sku}</span>
                  <span className="block truncate text-xs text-muted-foreground">{stop.productName}</span>
                </span>
                <b className="whitespace-nowrap">Pick {n0(stop.quantity)}</b>
              </li>
            ))}
            {route.shortages.map((s) => (
              <li key={s.inventoryLevelId} className="flex items-center gap-2.5 py-2">
                <Pill tone="red">Short</Pill>
                <span className="min-w-0 flex-1 truncate font-mono text-xs font-semibold">{s.sku}</span>
                <b className="whitespace-nowrap text-red-700">{n0(s.quantity)} missing</b>
              </li>
            ))}
          </ol>
        </section>
      )}
    </>
  )
}

/* ---------- Edit layout ---------- */

export function EditPanel({
  plan,
  selected,
  onDone,
  onAddRack,
  onFloorSize,
  onRotate,
  onRemove,
  onPlace,
  onResize,
  onChanged,
}: {
  plan: FloorPlan
  selected: FloorItem | null
  onDone: () => void
  onAddRack: () => void
  onFloorSize: () => void
  onRotate: (direction: "cw" | "ccw" | "180") => void
  onRemove: (item: FloorItem) => void
  onPlace: (id: string) => void
  onResize: (item: FloorItem, length: number, depth: number) => void
  onChanged: () => void
}) {
  async function takeOff(item: FloorItem) {
    const res = await setPlacement(item.id, { remove: true })
    if (!res.success) return toast.error(res.error)
    toast.success(`${item.code} taken off the map`)
    onChanged()
  }

  return (
    <>
      <section className={cn(box, "border-2 border-[#EE8524]")}>
        <div className="mb-2 flex items-center justify-between">
          <h2 className={heading}>Editing the layout</h2>
          <Button size="sm" onClick={onDone}>Done</Button>
        </div>
        <p className="text-[12.5px] text-muted-foreground">
          Drag racks, zones and docks to rearrange the floor; they snap to half a metre. Select a rack and use the round handle, or press R, to turn
          it. Arrow keys nudge it. Layout changes never touch stock.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={onAddRack}>
            <PlusIcon data-icon="inline-start" />
            Add rack
          </Button>
          <Button size="sm" variant="outline" onClick={onFloorSize}>
            Floor size
            <span className="font-normal text-muted-foreground">
              {plan.warehouse.floorWidth} × {plan.warehouse.floorDepth} m
            </span>
          </Button>
        </div>
      </section>

      {selected && (
        <section className={box}>
          <div className="mb-2 flex items-center gap-2">
            <RackTag code={selected.code} />
            <span className="text-[13px] text-muted-foreground">{label(selected.type)}</span>
          </div>
          <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
            <span>
              Centre <b className="text-foreground tabular-nums">{selected.placement.centerX}, {selected.placement.centerY}</b>
            </span>
            <span>
              Size <b className="text-foreground tabular-nums">{selected.placement.length} × {selected.placement.depth} m</b>
            </span>
            {selected.type === "RACK" && (
              <span>
                Rotation <b className="text-foreground tabular-nums">{selected.placement.rotation}°</b>
              </span>
            )}
          </div>
          {selected.type === "RACK" && <p className="mb-3 text-[13px]">{facingText(selected.placement.rotation)}. R turns it clockwise, Shift+R the other way.</p>}
          {selected.type === "DAMAGE" && <p className="mb-3 text-[13px] text-muted-foreground">The damage section is made by the system. You can move, resize and turn it, but not rename or delete it.</p>}
          <SizeEditor key={`${selected.id}-${selected.placement.length}-${selected.placement.depth}`} item={selected} onResize={onResize} />
          <div className="flex flex-wrap items-center gap-2">
            {selected.type !== "ZONE" && selected.type !== "AISLE" && <RotateButtons onRotate={onRotate} />}
            {selected.type === "RACK" ? (
              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => onRemove(selected)}>
                Remove rack
              </Button>
            ) : (
              <Button size="sm" variant="ghost" onClick={() => takeOff(selected)}>
                Take off the map
              </Button>
            )}
          </div>
        </section>
      )}

      {plan.unplaced.length > 0 && (
        <section className={box}>
          <h2 className={cn(heading, "mb-1")}>Not on the map</h2>
          <ul className="divide-y">
            {plan.unplaced.map((u) => (
              <li key={u.id} className="flex items-center gap-2.5 py-2">
                <RackTag code={u.code} />
                <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{u.name ?? label(u.type)}</span>
                <Button size="sm" variant="outline" onClick={() => onPlace(u.id)}>
                  Place
                  <ArrowRightIcon data-icon="inline-end" />
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}

// Length runs along a rack's bins (A → B → C) and depth across it; zones use west–east and north–south.
function SizeEditor({ item, onResize }: { item: FloorItem; onResize: (item: FloorItem, length: number, depth: number) => void }) {
  const [length, setLength] = useState(String(item.placement.length))
  const [depth, setDepth] = useState(String(item.placement.depth))
  const area = item.type === "ZONE" || item.type === "AISLE"
  const lengthLabel = area ? "Width, west to east" : item.type === "RACK" ? "Length, along the bins" : "Length"
  const depthLabel = area ? "Depth, north to south" : item.type === "RACK" ? "Depth, across" : "Depth"

  function apply(nextLength: number, nextDepth: number) {
    if (!(nextLength > 0 && nextDepth > 0)) return toast.error("Enter the size in metres, above 0.")
    onResize(item, nextLength, nextDepth)
  }

  const input = (id: string, text: string, value: string, set: (v: string) => void, step: (d: number) => void) => (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs text-muted-foreground">
        {text}
      </label>
      <div className="flex items-center gap-1">
        <Button size="icon-sm" variant="outline" aria-label={`${text}: half a metre less`} onClick={() => step(-0.5)}>
          −
        </Button>
        <div className="relative">
          <input
            id={id}
            inputMode="decimal"
            value={value}
            onChange={(e) => set(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && apply(Number(length), Number(depth))}
            className="h-8 w-20 rounded-lg border border-input bg-transparent pr-6 pl-2 text-right text-sm tabular-nums outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-xs text-muted-foreground">m</span>
        </div>
        <Button size="icon-sm" variant="outline" aria-label={`${text}: half a metre more`} onClick={() => step(0.5)}>
          +
        </Button>
      </div>
    </div>
  )

  return (
    <div className="mb-3 rounded-lg bg-muted/60 p-3">
      <div className="flex flex-wrap items-end gap-3">
        {input("size-length", lengthLabel, length, setLength, (d) => apply(Math.max(0.5, item.placement.length + d), item.placement.depth))}
        {input("size-depth", depthLabel, depth, setDepth, (d) => apply(item.placement.length, Math.max(0.5, item.placement.depth + d)))}
        <Button size="sm" onClick={() => apply(Number(length), Number(depth))}>
          Apply size
        </Button>
      </div>
      <p className="mt-2 text-[12px] text-muted-foreground">It grows from its centre. The server refuses a size that leaves the floor or touches a neighbour.</p>
    </div>
  )
}
