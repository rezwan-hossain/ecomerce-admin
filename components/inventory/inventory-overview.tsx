import Link from "next/link"
import { BellIcon, CheckIcon, ClipboardListIcon, RepeatIcon, ShoppingCartIcon, TruckIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { DemoAdjustment, DemoPurchaseOrder, DemoTransfer } from "@/lib/inventory-demo"
import { cn } from "@/lib/utils"
import type { InventorySummary, LedgerMovement, StockLevel, StorageLocation, VariantStock } from "@/types/inventory.type"

import { Card, fmtDate, fmtDateTime, Kpis, MeterKey, n0, Pill, rel, StockMeter, taka, WarehouseTag } from "./inventory-ui"
import { MovementQuantity, MovementTag } from "./movements-table"

const WAREHOUSE_TYPE: Record<string, string> = {
  PHYSICAL: "Warehouse",
  STORE: "Retail store",
  VIRTUAL_DAMAGE: "Damage hold",
  VIRTUAL_QC: "Quality check hold",
  VIRTUAL_RETURN: "Returns processing",
}

type Todo = { icon: React.ReactNode; tone: "red" | "amber" | "blue"; title: string; text: string; href: string; action: string }

const tileTone = {
  red: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
  amber: "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  blue: "bg-primary/10 text-primary",
}

function TodoList({ items }: { items: Todo[] }) {
  return (
    <ul className="px-4 pb-2">
      {items.map((t) => (
        <li key={t.title} className="flex items-start gap-3 border-t py-2.5 first:border-t-0">
          <span className={cn("grid size-7.5 shrink-0 place-items-center rounded-md [&_svg]:size-4", tileTone[t.tone])}>{t.icon}</span>
          <div className="min-w-0 flex-1">
            <strong className="font-semibold">{t.title}</strong>
            <p className="mt-0.5 text-[13px] text-muted-foreground">{t.text}</p>
          </div>
          <Button size="sm" variant="outline" nativeButton={false} render={<Link href={t.href} />}>
            {t.action}
          </Button>
        </li>
      ))}
    </ul>
  )
}

// The demo documents that wait on someone: receive, ship, approve or apply.
function demoTodos(pos: DemoPurchaseOrder[], transfers: DemoTransfer[], adjustments: DemoAdjustment[], supplierName: (id: string) => string) {
  const todos: Todo[] = []
  for (const po of pos) {
    if (["SUBMITTED", "CONFIRMED", "PARTIAL"].includes(po.status)) {
      const left = po.items.reduce((sum, i) => sum + i.orderedQty - i.receivedQty - i.damagedQty, 0)
      const late = po.expectedAt !== null && new Date(po.expectedAt).getTime() < Date.now()
      todos.push({
        icon: <ShoppingCartIcon />,
        tone: late ? "red" : "blue",
        title: `Receive ${po.poNumber}`,
        text: `${supplierName(po.supplierId)}: ${n0(left)} units still to arrive, expected ${fmtDate(po.expectedAt)}${late ? " (late)" : ""}.`,
        href: "/inventory/purchase-orders",
        action: "Open",
      })
    } else if (po.status === "DRAFT" && po.fromRule) {
      todos.push({
        icon: <RepeatIcon />,
        tone: "amber",
        title: `Review ${po.poNumber}`,
        text: `Drafted by a reorder rule for ${supplierName(po.supplierId)}. Submit it to place the order.`,
        href: "/inventory/purchase-orders",
        action: "Review",
      })
    }
  }
  for (const t of transfers) {
    if (t.status === "IN_TRANSIT" || t.status === "PARTIAL") {
      todos.push({
        icon: <TruckIcon />,
        tone: "blue",
        title: `Receive ${t.transferNumber}`,
        text: `On the way from ${t.from} to ${t.to}, shipped ${t.shippedAt ? rel(t.shippedAt) : ""}.`,
        href: "/inventory/transfers",
        action: "Open",
      })
    } else if (t.status === "PENDING") {
      todos.push({
        icon: <TruckIcon />,
        tone: "amber",
        title: `Ship ${t.transferNumber}`,
        text: `Approved and waiting to leave ${t.from}.`,
        href: "/inventory/transfers",
        action: "Open",
      })
    }
  }
  for (const a of adjustments) {
    if (a.status === "PENDING" || a.status === "APPROVED") {
      const net = a.items.reduce((sum, i) => sum + i.quantity, 0)
      todos.push({
        icon: <ClipboardListIcon />,
        tone: "amber",
        title: `${a.status === "PENDING" ? "Approve" : "Apply"} ${a.adjustmentNumber}`,
        text: `${a.note || a.reason.toLowerCase()}, net change ${net > 0 ? "+" : ""}${net}.`,
        href: "/inventory/adjustments",
        action: "Open",
      })
    }
  }
  return todos
}

// Problems that would mean a stock operation went wrong.
function ledgerChecks(stock: VariantStock[]) {
  const problems: string[] = []
  const sellable = (l: StockLevel) => l.warehouse.type === "PHYSICAL" || l.warehouse.type === "STORE"
  for (const v of stock) {
    for (const l of v.levels) {
      const tag = `${v.sku} at ${l.warehouse.code}`
      if (l.available !== l.onHand - l.reserved) problems.push(`${tag}: available isn’t on hand minus reserved.`)
      if ([l.onHand, l.reserved, l.available, l.incoming, l.damaged].some((n) => n < 0)) problems.push(`${tag}: a quantity is negative.`)
      const racks = l.locationStocks.reduce((sum, s) => sum + s.quantity, 0)
      if (racks !== l.onHand) problems.push(`${tag}: racks hold ${racks} but on hand is ${l.onHand}.`)
    }
    const storefront = v.levels.filter(sellable).reduce((sum, l) => sum + l.available, 0)
    if (v.stock !== storefront) problems.push(`${v.sku}: storefront stock is out of date.`)
  }
  return problems
}

export function InventoryOverview({
  summary,
  stock,
  movements,
  locations,
  demo,
}: {
  summary: InventorySummary
  stock: VariantStock[]
  movements: LedgerMovement[]
  locations: StorageLocation[]
  demo: {
    purchaseOrders: DemoPurchaseOrder[]
    transfers: DemoTransfer[]
    adjustments: DemoAdjustment[]
    supplierNames: Record<string, string>
  }
}) {
  const todos = demoTodos(demo.purchaseOrders, demo.transfers, demo.adjustments, (id) => demo.supplierNames[id] ?? "Supplier")
  const problems = ledgerChecks(stock)
  const alerts = stock.filter((v) => v.stockStatus !== "IN_STOCK")
  const levelCount = stock.reduce((sum, v) => sum + v.levels.length, 0)

  // One row per warehouse, added up from every variant's level there.
  const byWarehouse = new Map<string, { level: StockLevel; onHand: number; reserved: number; available: number; incoming: number; damaged: number; value: number }>()
  for (const v of stock) {
    for (const l of v.levels) {
      const row = byWarehouse.get(l.warehouseId) ?? { level: l, onHand: 0, reserved: 0, available: 0, incoming: 0, damaged: 0, value: 0 }
      row.onHand += l.onHand
      row.reserved += l.reserved
      row.available += l.available
      row.incoming += l.incoming
      row.damaged += l.damaged
      row.value += Number(l.unitCost) * l.onHand
      byWarehouse.set(l.warehouseId, row)
    }
  }

  return (
    <>
      <Kpis
        items={[
          { label: "Stock value", value: taka(Number(summary.stockValue)), hint: "Weighted average cost" },
          { label: "On hand", value: n0(summary.units.onHand), hint: `${n0(levelCount)} stock rows` },
          { label: "Available to sell", value: n0(summary.units.available), hint: "On hand minus reserved" },
          { label: "Reserved", value: n0(summary.units.reserved), hint: `${summary.activeReservations} open holds` },
          { label: "Incoming", value: n0(summary.units.incoming), hint: "Open orders and transfers" },
          {
            label: "Low or out of stock",
            value: n0(summary.lowStock + summary.outOfStock),
            hint: `${n0(summary.units.damaged)} damaged units set aside`,
            warn: summary.lowStock + summary.outOfStock > 0,
          },
        ]}
      />

      <div className="grid items-start gap-4 px-4 lg:px-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <Card
            title="Needs action"
            action={
              <span className="flex items-center gap-2 text-muted-foreground">
                <Pill tone="amber">Demo</Pill>
                {todos.length || "Nothing"} waiting
              </span>
            }
          >
            {todos.length > 0 ? <TodoList items={todos} /> : <p className="px-4 pb-4 text-muted-foreground">Every order, transfer and adjustment is up to date.</p>}
          </Card>

          <Card
            title="Recent movements"
            action={
              <Button size="sm" variant="ghost" nativeButton={false} render={<Link href="/inventory/movements" />}>
                Open the ledger
              </Button>
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full text-[13.5px]">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr className="border-y [&>th]:px-3 [&>th]:py-2 [&>th]:font-medium">
                    <th>When</th>
                    <th>What</th>
                    <th>Item</th>
                    <th>Where</th>
                    <th className="text-right">Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((m) => (
                    <tr key={m.id} className="border-b last:border-b-0 [&>td]:px-3 [&>td]:py-2">
                      <td className="whitespace-nowrap text-muted-foreground">{fmtDateTime(m.createdAt)}</td>
                      <td><MovementTag movement={m} /></td>
                      <td className="max-w-56 truncate font-mono text-xs">{m.inventoryLevel.variant.sku}</td>
                      <td><WarehouseTag code={m.inventoryLevel.warehouse.code} /></td>
                      <td className="text-right"><MovementQuantity movement={m} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {movements.length === 0 && <p className="px-4 py-6 text-center text-muted-foreground">Stock changes appear here as they happen.</p>}
            </div>
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <Card
            title="Low and out of stock"
            action={
              <Button size="sm" variant="ghost" nativeButton={false} render={<Link href="/inventory/stock" />}>
                See all
              </Button>
            }
          >
            {alerts.length === 0 ? (
              <p className="px-4 pb-4 text-muted-foreground">Every variant is above its alert level.</p>
            ) : (
              <ul className="px-4 pb-2">
                {alerts.slice(0, 6).map((v) => {
                  const out = v.stockStatus === "OUT_OF_STOCK"
                  return (
                    <li key={v.variantId} className="flex items-start gap-3 border-t py-2.5 first:border-t-0">
                      <span className={cn("grid size-7.5 shrink-0 place-items-center rounded-md [&_svg]:size-4", out ? tileTone.red : tileTone.amber)}>
                        <BellIcon />
                      </span>
                      <div className="min-w-0 flex-1">
                        <strong className="font-semibold">
                          {out ? "Out of stock" : "Low stock"}: {v.product.name}
                          {v.name !== v.sku && `, ${v.name}`}
                        </strong>
                        <p className="mt-0.5 text-[13px] text-muted-foreground">
                          {v.stock} available, alert at {v.lowStockThreshold}
                          {v.incoming > 0 && `. ${v.incoming} on the way`}.
                        </p>
                      </div>
                    </li>
                  )
                })}
                {alerts.length > 6 && <li className="border-t py-2.5 text-[13px] text-muted-foreground">{alerts.length - 6} more on the stock page</li>}
              </ul>
            )}
          </Card>

          <Card title="Ledger checks" action={problems.length === 0 && <Pill tone="green">Balanced</Pill>}>
            <div className="px-4 pb-4">
              {problems.length === 0 ? (
                <div className="flex items-start gap-2.5 rounded-md bg-emerald-50 px-3 py-2.5 text-[13px] text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  <CheckIcon className="mt-0.5 size-4 shrink-0" />
                  <span>
                    Every stock row balances: available equals on hand minus reserved, rack quantities add up to on hand, and
                    storefront stock matches.
                  </span>
                </div>
              ) : (
                <div className="rounded-md bg-red-50 px-3 py-2.5 text-[13px] text-red-700 dark:bg-red-950 dark:text-red-300">
                  <strong>{problems.length} problems found</strong>
                  <ul className="mt-1.5 list-disc pl-4.5">
                    {problems.slice(0, 8).map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="mt-2.5 text-[12.5px] text-muted-foreground">Checked {n0(levelCount)} stock rows across {n0(stock.length)} variants.</p>
            </div>
          </Card>
        </div>
      </div>

      <Card title="Warehouses" action={<MeterKey />} className="mx-4 lg:mx-6">
        <div className="overflow-x-auto">
          <table className="w-full text-[13.5px]">
            <thead className="text-left text-xs text-muted-foreground">
              <tr className="border-y [&>th]:px-3 [&>th]:py-2 [&>th]:font-medium">
                <th>Warehouse</th>
                <th>Code</th>
                <th>Stock</th>
                <th className="text-right">On hand</th>
                <th className="text-right">Available</th>
                <th className="text-right">Value</th>
                <th className="text-right">Racks in use</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {[...byWarehouse.entries()].map(([id, row]) => (
                <tr key={id} className="border-b last:border-b-0 [&>td]:px-3 [&>td]:py-2">
                  <td>
                    <div className="font-semibold">{row.level.warehouse.name}</div>
                    <div className="text-xs text-muted-foreground">{WAREHOUSE_TYPE[row.level.warehouse.type] ?? row.level.warehouse.type}</div>
                  </td>
                  <td><WarehouseTag code={row.level.warehouse.code} /></td>
                  <td className="min-w-36"><StockMeter {...row} /></td>
                  <td className="text-right">{n0(row.onHand)}</td>
                  <td className="text-right font-semibold">{n0(row.available)}</td>
                  <td className="text-right">{taka(row.value)}</td>
                  <td className="text-right">{locations.filter((l) => l.warehouseId === id && l.totalUnits > 0).length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  )
}
