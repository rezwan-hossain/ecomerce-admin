"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import { getDamagedStockMovements } from "@/app/actions/damaged-stock.actions"
import { Button } from "@/components/ui/button"
import type { DamagedStockList, DamagedStockMovement, DamagedStockRow } from "@/types/damaged-stock.type"
import type { Warehouse } from "@/types/warehouse.type"

import { DocSheet } from "./doc-bits"
import { Card, fmtDate, fmtDateTime, Kpis, n0, RackTag, rel, taka, WarehouseTag } from "./inventory-ui"
import { Pager, ParamSearch, ParamSelect, SortHeader } from "./reports/report-bits"

const itemName = (r: DamagedStockRow) => (r.variantLabel ? `${r.productName}, ${r.variantLabel}` : r.productName)

export function DamagedStock({
  list,
  filters,
  warehouses,
}: {
  list: DamagedStockList
  filters: { warehouseId: string; search: string; sortBy: string; sortOrder: string }
  warehouses: Warehouse[]
}) {
  const [open, setOpen] = useState<DamagedStockRow | null>(null)
  const sort = { sortBy: filters.sortBy, sortOrder: filters.sortOrder }
  const warehouseItems = [{ value: "all", label: "All warehouses" }, ...warehouses.map((w) => ({ value: w.id, label: w.code }))]

  return (
    <>
      <Kpis
        className="mx-4 xl:grid-cols-3 lg:mx-6"
        items={[
          { label: "Damaged units", value: n0(list.totals.units), hint: "in this view" },
          { label: "Value", value: taka(Number(list.totals.value)), hint: "in this view, at cost" },
          { label: "SKUs", value: n0(list.totals.skuCount), hint: "in this view" },
        ]}
      />

      <div className="flex flex-wrap items-center justify-end gap-3 px-4 lg:px-6">
        <ParamSelect name="warehouseId" value={filters.warehouseId || "all"} items={warehouseItems} label="Warehouse" className="w-40" />
        <ParamSearch value={filters.search} placeholder="SKU, product or batch, Enter" />
      </div>

      <Card title={`${n0(list.meta.total)} rows`} className="mx-4 lg:mx-6">
        {list.data.length === 0 ? (
          <p className="px-4 pb-6 text-center text-sm text-muted-foreground">No damaged stock</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                  <tr className="[&>th]:px-3 [&>th]:py-2.5 [&>th]:font-medium [&>th:first-child]:pl-4 [&>th:last-child]:pr-4">
                    <th>Item</th>
                    <th>Warehouse</th>
                    <th className="hidden md:table-cell">Batch</th>
                    <th className="text-right"><SortHeader field="quantity" text="Units" {...sort} /></th>
                    <th className="hidden text-right lg:table-cell">Unit cost</th>
                    <th className="text-right"><SortHeader field="value" text="Value" {...sort} /></th>
                    <th className="hidden xl:table-cell">First damaged</th>
                    <th><SortHeader field="lastDamagedAt" text="Last damaged" {...sort} /></th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {list.data.map((r) => (
                    <tr
                      key={r.id}
                      tabIndex={0}
                      onClick={() => setOpen(r)}
                      onKeyDown={(e) => e.key === "Enter" && setOpen(r)}
                      className="cursor-pointer border-t border-border/60 hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none [&>td]:px-3 [&>td]:py-2.5 [&>td:first-child]:pl-4 [&>td:last-child]:pr-4"
                    >
                      <td>
                        <div className="font-medium">{itemName(r)}</div>
                        <div className="font-mono text-[11px] text-muted-foreground">{r.sku}</div>
                      </td>
                      <td><WarehouseTag code={r.warehouseCode} /></td>
                      <td className="hidden md:table-cell">
                        {r.batchNumber ? (
                          <span className="flex flex-col">
                            <span className="font-mono text-xs">{r.batchNumber}</span>
                            {r.expiresAt && <span className="text-[11px] text-muted-foreground">exp {fmtDate(r.expiresAt)}</span>}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="text-right font-semibold text-destructive">{n0(r.quantity)}</td>
                      <td className="hidden text-right text-muted-foreground lg:table-cell">{taka(Number(r.unitCost), 2)}</td>
                      <td className="text-right">{taka(Number(r.value), 2)}</td>
                      <td className="hidden whitespace-nowrap text-muted-foreground xl:table-cell" title={fmtDateTime(r.firstDamagedAt)}>{rel(r.firstDamagedAt)}</td>
                      <td className="whitespace-nowrap text-muted-foreground" title={fmtDateTime(r.lastDamagedAt)}>{rel(r.lastDamagedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager page={list.meta.page} totalPages={list.meta.totalPages} total={list.meta.total} noun="rows" />
          </>
        )}
      </Card>

      {open && <DamagedSheet key={open.id} row={open} onClose={() => setOpen(null)} />}
    </>
  )
}

// Where a damaged unit came from: an adjustment, a transfer, or a manual change / write-off.
function Reference({ m, row }: { m: DamagedStockMovement; row: DamagedStockRow }) {
  if (m.referenceType === "ADJUSTMENT") return <Link href="/inventory/adjustments" className="text-primary hover:underline">Adjustment</Link>
  if (m.referenceType === "TRANSFER") return <Link href="/inventory/transfers" className="text-primary hover:underline">Transfer</Link>
  return (
    <span>
      Manual
      {row.batchNumber && (
        <>
          {" · "}
          <Link href={`/inventory/batches?search=${encodeURIComponent(row.batchNumber)}`} className="font-mono text-primary hover:underline">
            {row.batchNumber}
          </Link>
        </>
      )}
    </span>
  )
}

function DamagedSheet({ row, onClose }: { row: DamagedStockRow; onClose: () => void }) {
  const [history, setHistory] = useState<DamagedStockMovement[] | null>(null)

  useEffect(() => {
    let stale = false
    getDamagedStockMovements(row.id).then((res) => {
      if (stale) return
      if (!res.success) return toast.error(res.error)
      setHistory(res.data)
    })
    return () => {
      stale = true
    }
  }, [row.id])

  return (
    <DocSheet
      kind="Damaged stock"
      title={itemName(row)}
      narrow
      onClose={onClose}
      footer={
        <>
          <span className="flex-1" />
          <Button variant="outline" onClick={onClose}>Done</Button>
        </>
      }
    >
      <section className="overflow-hidden rounded-2xl border bg-card">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 px-4 py-4 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs text-muted-foreground">Damaged units</dt>
            <dd className="text-xl font-bold text-destructive tabular-nums">{n0(row.quantity)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Value</dt>
            <dd className="text-xl font-bold tabular-nums">{taka(Number(row.value))}</dd>
            <dd className="text-xs text-muted-foreground">{taka(Number(row.unitCost), 2)} each</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Where</dt>
            <dd className="flex items-center gap-1"><WarehouseTag code={row.warehouseCode} /><RackTag code={row.locationCode} /></dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Batch</dt>
            <dd className="font-mono text-xs">{row.batchNumber ?? "—"}</dd>
            {row.expiresAt && <dd className="text-xs text-muted-foreground">exp {fmtDate(row.expiresAt)}</dd>}
          </div>
        </dl>
        <p className="border-t bg-muted/30 px-4 py-2.5 text-[13px] text-muted-foreground">
          <span className="font-mono">{row.sku}</span> · first damaged {fmtDateTime(row.firstDamagedAt)} · last {fmtDateTime(row.lastDamagedAt)}
        </p>
      </section>

      <Card title="History" action={<span className="text-xs text-muted-foreground">Newest first</span>}>
        {history === null && <p className="px-4 pb-4 text-sm text-muted-foreground">Loading...</p>}
        {history?.length === 0 && <p className="px-4 pb-4 text-sm text-muted-foreground">No history recorded.</p>}
        {history && history.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:font-medium [&>th:first-child]:pl-4 [&>th:last-child]:pr-4">
                  <th>When</th>
                  <th className="text-right">Units</th>
                  <th>From rack</th>
                  <th>Reason</th>
                  <th>Reference</th>
                  <th className="hidden sm:table-cell">By</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {history.map((m) => (
                  <tr key={m.id} className="border-t border-border/60 align-top [&>td]:px-3 [&>td]:py-2 [&>td:first-child]:pl-4 [&>td:last-child]:pr-4">
                    <td className="whitespace-nowrap text-muted-foreground">{fmtDateTime(m.createdAt)}</td>
                    <td className="text-right font-semibold text-destructive">{n0(m.quantity)}</td>
                    <td>{m.fromLocationCode ? <RackTag code={m.fromLocationCode} /> : <span className="text-muted-foreground">—</span>}</td>
                    <td className="max-w-48 text-muted-foreground">{m.note ?? "—"}</td>
                    <td className="whitespace-nowrap"><Reference m={m} row={row} /></td>
                    <td className="hidden text-muted-foreground sm:table-cell">{m.performedBy?.name ?? "System"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </DocSheet>
  )
}
