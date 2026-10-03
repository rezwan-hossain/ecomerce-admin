"use client"

import { useState } from "react"
import { BuildingIcon, EllipsisVerticalIcon } from "lucide-react"

import { getStock } from "@/app/actions/inventory.actions"
import { ListTable, type ListColumn } from "@/components/list-table"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { StockLevel, StorageLocation, VariantStock } from "@/types/inventory.type"

import { n0, Pill, RackTag, StockMeter, taka, WarehouseTag, type Tone } from "./inventory-ui"
import { StockHistorySheet } from "./stock-history-sheet"
import { StockSheet, type StockAction, type Warehouse } from "./stock-sheet"

const ALL = "all"

const levelValue = (l: StockLevel) => Number(l.unitCost) * l.onHand
const variantValue = (v: VariantStock) => v.levels.reduce((sum, l) => sum + levelValue(l), 0)

// Virtual warehouses (damage, returns) hold stock that isn't for sale.
const isSellable = (l: StockLevel) => l.warehouse.type === "PHYSICAL" || l.warehouse.type === "STORE"

function levelStatus(v: VariantStock, l: StockLevel): { key: "out" | "low" | "ok"; text: string; tone: Tone } | null {
  if (!isSellable(l)) return null
  if (l.available <= 0) return { key: "out", text: "Out of stock", tone: "red" }
  if (l.available <= v.lowStockThreshold) return { key: "low", text: "Low", tone: "amber" }
  return { key: "ok", text: "In stock", tone: "green" }
}

// A variant row, or one warehouse's level of it when a warehouse is picked.
type Row = { v: VariantStock; level: StockLevel | null }

export function StockManager({ initialStock, locations }: { initialStock: VariantStock[]; locations: StorageLocation[] }) {
  const [stock, setStock] = useState(initialStock)
  const [warehouseId, setWarehouseId] = useState(ALL)
  const [active, setActive] = useState<{ action: StockAction; variant: VariantStock; warehouseId?: string } | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)

  // There's no warehouses endpoint; every warehouse has at least its UNASSIGNED rack.
  const warehouses: Warehouse[] = [...new Map(locations.map((l) => [l.warehouse.id, l.warehouse])).values()]
  const detail = stock.find((v) => v.variantId === detailId)

  async function refresh() {
    const res = await getStock()
    if (res.success) setStock(res.data)
  }

  let rows: Row[]
  if (warehouseId === ALL) {
    rows = stock.map((v) => ({ v, level: null }))
  } else {
    rows = stock.flatMap((v) => {
      const level = v.levels.find((l) => l.warehouseId === warehouseId)
      return level ? [{ v, level }] : []
    })
  }

  // Low/out counts per row: across sellable warehouses, or for the picked one.
  const statuses = (r: Row) => (r.level ? [levelStatus(r.v, r.level)] : r.v.levels.map((l) => levelStatus(r.v, l))).filter(Boolean)
  const isLow = (r: Row) => statuses(r).some((s) => s!.key === "low")
  const isOut = (r: Row) => r.v.levels.length === 0 || statuses(r).some((s) => s!.key === "out")
  const incoming = (r: Row) => (r.level ? r.level.incoming : r.v.incoming)
  const damaged = (r: Row) => (r.level ? r.level.damaged : r.v.damaged)

  const itemColumn: ListColumn<Row> = {
    key: "item",
    header: "Item",
    cell: ({ v }) => (
      <button type="button" className="flex min-w-48 flex-col text-left" onClick={() => setDetailId(v.variantId)}>
        <span className="font-semibold hover:underline">{v.product.name}</span>
        {v.name !== v.sku && <span className="text-xs text-muted-foreground">{v.name}</span>}
        <span className="font-mono text-xs text-muted-foreground">{v.sku}</span>
      </button>
    ),
  }
  const num = "text-right tabular-nums"
  const dimZero = (n: number, className = "") =>
    n ? <span className={className}>{n0(n)}</span> : <span className="text-muted-foreground">0</span>

  const actionsColumn: ListColumn<Row> = {
    key: "actions",
    header: <span className="sr-only">Actions</span>,
    className: "w-12 text-right",
    cell: ({ v, level }) => (
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="icon" className="size-8 text-muted-foreground data-open:bg-muted" />}
        >
          <EllipsisVerticalIcon />
          <span className="sr-only">Stock actions for {v.sku}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => setDetailId(v.variantId)}>View details</DropdownMenuItem>
          <DropdownMenuSeparator />
          {(["adjust", "count", "move", "threshold"] as const).map((action) => (
            <DropdownMenuItem key={action} onClick={() => setActive({ action, variant: v, warehouseId: level?.warehouseId })}>
              {{ adjust: "Adjust stock", count: "Count stock", move: "Move between racks", threshold: "Low-stock alert" }[action]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  }

  let columns: ListColumn<Row>[]
  if (warehouseId === ALL) {
    columns = [
      itemColumn,
      {
        key: "byWarehouse",
        header: "Available by warehouse",
        className: "hidden lg:table-cell",
        cell: ({ v }) =>
          v.levels.length === 0 ? (
            <span className="text-muted-foreground">Not stocked anywhere</span>
          ) : (
            <div className="flex flex-wrap gap-1">
              {v.levels.map((l) => {
                const st = levelStatus(v, l)
                let tone: "warn" | "bad" | undefined
                if (st?.key === "out") tone = "bad"
                else if (st?.key === "low") tone = "warn"
                return <WarehouseTag key={l.warehouseId} code={l.warehouse.code} count={l.available} tone={tone} />
              })}
            </div>
          ),
      },
      { key: "meter", header: "Stock", className: "hidden min-w-32 md:table-cell", cell: ({ v }) => <StockMeter available={v.stock} reserved={v.reserved} incoming={v.incoming} damaged={v.damaged} /> },
      { key: "onHand", header: "On hand", className: num, cell: ({ v }) => n0(v.onHand) },
      { key: "reserved", header: "Reserved", className: `hidden ${num} md:table-cell`, cell: ({ v }) => dimZero(v.reserved) },
      { key: "available", header: "Available", className: num, cell: ({ v }) => <span className="text-[15px] font-bold">{n0(v.stock)}</span> },
      { key: "incoming", header: "Incoming", className: `hidden ${num} xl:table-cell`, cell: ({ v }) => dimZero(v.incoming) },
      { key: "damaged", header: "Damaged", className: `hidden ${num} xl:table-cell`, cell: ({ v }) => dimZero(v.damaged, "font-semibold text-destructive") },
      { key: "value", header: "Value", className: `hidden ${num} lg:table-cell`, cell: ({ v }) => taka(variantValue(v)) },
      actionsColumn,
    ]
  } else {
    columns = [
      itemColumn,
      {
        key: "rack",
        header: "Default rack",
        className: "hidden md:table-cell",
        cell: ({ level }) => <RackTag code={level!.defaultLocation?.code ?? null} />,
      },
      { key: "meter", header: "Stock", className: "hidden min-w-32 lg:table-cell", cell: ({ level: l }) => <StockMeter available={l!.available} reserved={l!.reserved} incoming={l!.incoming} damaged={l!.damaged} /> },
      { key: "onHand", header: "On hand", className: num, cell: ({ level }) => n0(level!.onHand) },
      { key: "reserved", header: "Reserved", className: `hidden ${num} md:table-cell`, cell: ({ level }) => dimZero(level!.reserved) },
      { key: "available", header: "Available", className: num, cell: ({ level }) => <span className="text-[15px] font-bold">{n0(level!.available)}</span> },
      { key: "damaged", header: "Damaged", className: `hidden ${num} xl:table-cell`, cell: ({ level }) => dimZero(level!.damaged, "font-semibold text-destructive") },
      { key: "cost", header: "Unit cost", className: `hidden ${num} xl:table-cell`, cell: ({ level }) => taka(Number(level!.unitCost), 2) },
      { key: "value", header: "Value", className: `hidden ${num} lg:table-cell`, cell: ({ level }) => taka(levelValue(level!)) },
      { key: "alertAt", header: "Alert at", className: `hidden ${num} xl:table-cell`, cell: ({ v }) => v.lowStockThreshold },
      {
        key: "status",
        header: "Status",
        cell: ({ v, level }) => {
          const st = levelStatus(v, level!)
          return st ? <Pill tone={st.tone}>{st.text}</Pill> : <span className="text-muted-foreground">Not for sale</span>
        },
      },
      actionsColumn,
    ]
  }

  const warehouseItems = [{ value: ALL, label: "All warehouses" }, ...warehouses.map((w) => ({ value: w.id, label: w.code }))]

  return (
    <>
      <ListTable
        rows={rows}
        columns={columns}
        getRowId={(r) => r.v.variantId}
        searchText={({ v }) => `${v.product.name} ${v.name} ${v.sku}`}
        searchPlaceholder="Search by name or SKU..."
        filters={[
          { label: "All", value: "all", match: () => true },
          { label: "Low", value: "low", match: isLow },
          { label: "Out of stock", value: "out", match: isOut },
          { label: "Incoming", value: "incoming", match: (r) => incoming(r) > 0 },
          { label: "Damaged", value: "damaged", match: (r) => damaged(r) > 0 },
        ]}
        emptyText={stock.length === 0 ? "No variants yet. Create a product first." : "No stock matches. Try another search or filter."}
        toolbar={
          <div className="flex items-center gap-4">
            <Select value={warehouseId} items={warehouseItems} onValueChange={(value) => setWarehouseId(value as string)}>
              <SelectTrigger aria-label="Warehouse" size="sm" className="min-w-44">
                <BuildingIcon className="text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {warehouseItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      />

      {detail && (
        <StockHistorySheet
          key={detail.variantId}
          variant={detail}
          locations={locations}
          highlightWarehouseId={warehouseId === ALL ? undefined : warehouseId}
          onAction={(action, id) => setActive({ action, variant: detail, warehouseId: id })}
          onChanged={refresh}
          onClose={() => setDetailId(null)}
        />
      )}
      {active && (
        <StockSheet
          key={`${active.action}-${active.variant.variantId}-${active.warehouseId}`}
          action={active.action}
          variant={active.variant}
          warehouseId={active.warehouseId}
          warehouses={warehouses}
          locations={locations}
          onClose={() => setActive(null)}
          onDone={async () => {
            setActive(null)
            await refresh()
          }}
        />
      )}
    </>
  )
}
