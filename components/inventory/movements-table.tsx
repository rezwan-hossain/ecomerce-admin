"use client"

import { useState } from "react"
import { ArrowRightIcon, BarcodeIcon, BuildingIcon } from "lucide-react"

import { ListTable, type ListColumn } from "@/components/list-table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import type { LedgerMovement, Movement, MovementType } from "@/types/inventory.type"

import { BatchSheet } from "./batches"
import { fmtDateTime, n0, RackTag, taka, WarehouseTag } from "./inventory-ui"

export const MOVEMENT_LABEL: Record<MovementType, string> = {
  PURCHASE_RECEIVED: "Purchase received",
  RETURN_RESTOCKED: "Return restocked",
  ADJUSTMENT_INCREASE: "Adjusted up",
  TRANSFER_IN: "Transfer in",
  INITIAL_STOCK: "Opening stock",
  SALE: "Sale",
  ADJUSTMENT_DECREASE: "Adjusted down",
  TRANSFER_OUT: "Transfer out",
  DAMAGED: "Damaged",
  LOST: "Lost",
  EXPIRED: "Expired",
  SAMPLE: "Sample",
  WRITE_OFF: "Write-off",
  RESERVATION_CREATED: "Reserved",
  RESERVATION_RELEASED: "Reservation released",
  RESERVATION_EXPIRED: "Reservation expired",
  LOCATION_MOVE: "Rack move",
}

// The movement type as a tag: green for stock in, red for stock out, grey for internal.
export function MovementTag({ movement }: { movement: Pick<Movement, "type" | "direction"> }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-[3px] border-l-[3px] border-current bg-muted px-1.5 text-[11.5px] font-bold whitespace-nowrap text-muted-foreground",
        movement.direction === "IN" && "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
        movement.direction === "OUT" && "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
      )}
    >
      {MOVEMENT_LABEL[movement.type]}
    </span>
  )
}

// "+5" for stock in, "−5" for stock out. Internal moves (reservations, rack moves) don't change on-hand.
export function MovementQuantity({ movement }: { movement: Movement }) {
  if (movement.direction === "IN") {
    return <span className="font-bold text-emerald-700 tabular-nums dark:text-emerald-400">+{n0(movement.quantity)}</span>
  }
  if (movement.direction === "OUT") {
    return <span className="font-bold text-destructive tabular-nums">−{n0(movement.quantity)}</span>
  }
  return <span className="font-bold text-muted-foreground tabular-nums">{n0(movement.quantity)}</span>
}

// "A-01 → B-02", or the one rack involved.
export function movementRacks(movement: Movement) {
  const from = movement.fromLocation?.code
  const to = movement.toLocation?.code
  if (from && to) return `${from} → ${to}`
  return from ?? to ?? ""
}

const ALL = "all"
const userName = (m: LedgerMovement) =>
  m.performedByUser ? [m.performedByUser.firstName, m.performedByUser.lastName].filter(Boolean).join(" ") : "System"

export function MovementsTable({ movements, limited }: { movements: LedgerMovement[]; limited: boolean }) {
  const [warehouseId, setWarehouseId] = useState(ALL)
  const [type, setType] = useState(ALL)
  const [batchId, setBatchId] = useState<string | null>(null)

  const warehouses = [...new Map(movements.map((m) => [m.inventoryLevel.warehouse.id, m.inventoryLevel.warehouse])).values()]
  const rows = movements.filter(
    (m) => (warehouseId === ALL || m.inventoryLevel.warehouse.id === warehouseId) && (type === ALL || m.type === type)
  )

  const columns: ListColumn<LedgerMovement>[] = [
    { key: "date", header: "When", className: "whitespace-nowrap", cell: (m) => <span className="text-muted-foreground">{fmtDateTime(m.createdAt)}</span> },
    { key: "type", header: "Type", cell: (m) => <MovementTag movement={m} /> },
    {
      key: "item",
      header: "Item",
      cell: (m) => (
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-mono text-xs font-semibold">{m.inventoryLevel.variant.sku}</span>
          <span className="truncate text-xs text-muted-foreground">{m.inventoryLevel.variant.product.name}</span>
          {m.batchId && (
            <button
              type="button"
              onClick={() => setBatchId(m.batchId!)}
              className="mt-0.5 inline-flex w-fit items-center gap-1 rounded bg-muted px-1.5 text-[11px] font-medium text-muted-foreground hover:text-primary"
            >
              <BarcodeIcon className="size-3" />
              Batch
            </button>
          )}
        </div>
      ),
    },
    {
      key: "where",
      header: "Where",
      className: "hidden lg:table-cell",
      cell: (m) => (
        <span className="flex items-center gap-1 whitespace-nowrap">
          <WarehouseTag code={m.inventoryLevel.warehouse.code} />
          {m.fromLocation && <RackTag code={m.fromLocation.code} />}
          {m.fromLocation && m.toLocation && <ArrowRightIcon className="size-3 text-muted-foreground" />}
          {m.toLocation && <RackTag code={m.toLocation.code} />}
        </span>
      ),
    },
    { key: "quantity", header: "Qty", className: "text-right", cell: (m) => <MovementQuantity movement={m} /> },
    {
      key: "onHand",
      header: "On hand",
      className: "hidden text-right whitespace-nowrap tabular-nums md:table-cell",
      cell: (m) =>
        m.onHandBefore === m.onHandAfter ? (
          <span className="text-muted-foreground">{n0(m.onHandAfter)}</span>
        ) : (
          <span className="inline-flex items-center gap-1">
            <span className="text-muted-foreground">{n0(m.onHandBefore)}</span>
            <ArrowRightIcon className="size-3 text-muted-foreground" />
            <strong>{n0(m.onHandAfter)}</strong>
          </span>
        ),
    },
    {
      key: "cost",
      header: "Unit cost",
      className: "hidden text-right tabular-nums xl:table-cell",
      cell: (m) =>
        m.unitCost !== null && m.direction !== "INTERNAL" ? taka(Number(m.unitCost), 2) : <span className="text-muted-foreground">—</span>,
    },
    {
      key: "note",
      header: "Reference",
      className: "hidden max-w-64 truncate xl:table-cell",
      cell: (m) => (
        <span className="text-xs text-muted-foreground">
          {m.note ?? (m.referenceType ? m.referenceType.toLowerCase().replace(/_/g, " ") : "—")}
        </span>
      ),
    },
    { key: "by", header: "By", className: "hidden whitespace-nowrap 2xl:table-cell", cell: (m) => <span className="text-muted-foreground">{userName(m)}</span> },
  ]

  const warehouseItems = [{ value: ALL, label: "All warehouses" }, ...warehouses.map((w) => ({ value: w.id, label: w.code }))]
  const typeItems = [{ value: ALL, label: "All types" }, ...Object.entries(MOVEMENT_LABEL).map(([value, text]) => ({ value, label: text }))]

  return (
    <>
      <ListTable
        rows={rows}
        columns={columns}
        getRowId={(m) => m.id}
        searchText={(m) =>
          `${m.inventoryLevel.variant.product.name} ${m.inventoryLevel.variant.sku} ${MOVEMENT_LABEL[m.type]} ${movementRacks(m)} ${m.note ?? ""}`
        }
        searchPlaceholder="SKU, item, rack or note..."
        filters={[
          { label: "All", value: "all", match: () => true },
          { label: "In", value: "in", match: (m) => m.direction === "IN" },
          { label: "Out", value: "out", match: (m) => m.direction === "OUT" },
          { label: "Internal", value: "internal", match: (m) => m.direction === "INTERNAL" },
        ]}
        pageSize={20}
        emptyText={limited ? "No movements match. Only the latest 500 are loaded." : "No movements match."}
        toolbar={
          <div className="flex gap-2">
            <Select value={type} items={typeItems} onValueChange={(value) => setType(value as string)}>
              <SelectTrigger aria-label="Movement type" size="sm" className="min-w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {typeItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={warehouseId} items={warehouseItems} onValueChange={(value) => setWarehouseId(value as string)}>
              <SelectTrigger aria-label="Warehouse" size="sm" className="min-w-40">
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
      {batchId && <BatchSheet key={batchId} batchId={batchId} onOpen={setBatchId} onClose={() => setBatchId(null)} />}
    </>
  )
}
