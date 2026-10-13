import { connection } from "next/server"
import { ArrowRightIcon, CircleAlertIcon, CircleCheckIcon } from "lucide-react"

import { getStockHistory } from "@/app/actions/inventory-report.actions"
import { getStock } from "@/app/actions/inventory.actions"
import { getWarehouse } from "@/app/actions/warehouse.actions"
import { Card, fmtDateTime, n0, RackTag, signed, WarehouseTag } from "@/components/inventory/inventory-ui"
import { MovementTag } from "@/components/inventory/movements-table"
import { money, param } from "@/components/inventory/reports/format"
import { DateRange, Pager, ParamSelect, VariantPicker } from "@/components/inventory/reports/report-bits"
import { cn } from "@/lib/utils"
import type { StockHistoryReport } from "@/types/inventory-report.type"

const th = "px-3 py-2.5 font-medium first:pl-4 last:pr-4"
const td = "px-3 py-2.5 first:pl-4 last:pr-4"

function Change({ n }: { n: number }) {
  if (n > 0) return <span className="font-bold text-emerald-700 dark:text-emerald-400">{signed(n)}</span>
  if (n < 0) return <span className="font-bold text-destructive">{signed(n)}</span>
  return <span className="text-muted-foreground">0</span>
}

export default async function StockHistoryPage({ searchParams }: PageProps<"/inventory/reports/history">) {
  await connection()
  const search = await searchParams
  const variantId = param(search, "variantId")
  const filters = { warehouseId: param(search, "warehouseId"), dateFrom: param(search, "dateFrom"), dateTo: param(search, "dateTo"), page: param(search, "page") || "1" }

  const [stock, warehouses, history] = await Promise.all([
    getStock(),
    getWarehouse(),
    variantId ? getStockHistory(variantId, filters) : Promise.resolve(null),
  ])
  const options = (stock.success ? stock.data : []).map((v) => ({ id: v.variantId, sku: v.sku, label: v.name !== v.sku ? `${v.product.name}, ${v.name}` : v.product.name }))
  const warehouseItems = [{ value: "all", label: "All warehouses" }, ...(warehouses.success ? warehouses.data : []).map((w) => ({ value: w.id, label: w.code }))]

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 px-4 lg:px-6">
        <VariantPicker options={options} value={variantId} />
        <span className="flex-1" />
        <ParamSelect name="warehouseId" value={filters.warehouseId || "all"} items={warehouseItems} label="Warehouse" className="w-36" />
        <DateRange from={filters.dateFrom} to={filters.dateTo} />
      </div>

      {!variantId && (
        <p className="mx-4 rounded-2xl border border-dashed bg-card px-4 py-8 text-center text-sm text-muted-foreground lg:mx-6">
          Pick a SKU to see every stock movement with a running balance, and whether the ledger adds up to the stored count.
        </p>
      )}
      {history && !history.success && <p className="px-4 text-muted-foreground lg:px-6">Couldn’t load the history: {history.error}</p>}
      {history?.success && <History report={history.data} />}
    </>
  )
}

function History({ report }: { report: StockHistoryReport }) {
  const { data: h, meta } = report
  const off = h.reconciliation.filter((r) => !r.ok)
  let period = "All time"
  if (h.period.from || h.period.to) period = `${h.period.from ? fmtDateTime(h.period.from) : "Start"} – ${h.period.to ? fmtDateTime(h.period.to) : "now"}`

  return (
    <>
      <section className="mx-4 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl border bg-card px-5 py-4 lg:mx-6">
        <div className="min-w-0 flex-1 basis-60">
          <div className="text-lg font-semibold">
            {h.variant.productName}
            {h.variant.label && <span className="font-normal text-muted-foreground">, {h.variant.label}</span>}
          </div>
          <div className="font-mono text-xs text-muted-foreground">{h.variant.sku}</div>
          <div className="text-xs text-muted-foreground">{period}</div>
        </div>
        <div className="flex flex-wrap items-center gap-3 tabular-nums">
          <div>
            <div className="text-xs text-muted-foreground">Opening</div>
            <div className="text-xl font-bold">{n0(h.openingOnHand)}</div>
          </div>
          <ArrowRightIcon className="size-4 text-muted-foreground" />
          <div>
            <div className="text-xs text-muted-foreground">In / out</div>
            <div className="text-xl font-bold">
              <span className="text-emerald-700 dark:text-emerald-400">+{n0(h.unitsIn)}</span>{" "}
              <span className="text-destructive">−{n0(h.unitsOut)}</span>
            </div>
          </div>
          <ArrowRightIcon className="size-4 text-muted-foreground" />
          <div>
            <div className="text-xs text-muted-foreground">Closing</div>
            <div className="text-xl font-bold">{n0(h.closingOnHand)}</div>
          </div>
          <div className="ml-3 border-l pl-6">
            <div className="text-xs text-muted-foreground">On hand now</div>
            <div className="text-xl font-bold">{n0(h.currentOnHand)}</div>
          </div>
        </div>
      </section>

      {h.reconciled ? (
        <p className="mx-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800 lg:mx-6 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
          <CircleCheckIcon className="size-4 shrink-0" />
          Ledger matches stock: every movement adds up to the stored count{h.reconciliation.length > 1 && " in every warehouse"}.
        </p>
      ) : (
        <div className="mx-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900 lg:mx-6 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <CircleAlertIcon className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-medium">The ledger doesn’t add up to the stored count</p>
            <ul>
              {off.map((r) => (
                <li key={r.warehouse.id}>
                  {r.warehouse.code}: stored {n0(r.onHand)}, ledger {n0(r.ledgerOnHand)} ({signed(r.difference)} unexplained)
                </li>
              ))}
            </ul>
            <p className="text-xs">Stock was changed outside the ledger. Run a stock count to set it right; the count is recorded as a movement.</p>
          </div>
        </div>
      )}

      {h.byType.length > 0 && (
        <div className="flex flex-wrap gap-2 px-4 lg:px-6">
          {h.byType.map((b) => (
            <span key={`${b.type}-${b.direction}`} className="inline-flex items-center gap-2 rounded-lg border bg-card px-2.5 py-1.5 text-xs">
              <MovementTag movement={b} />
              <span className="tabular-nums">
                {n0(b.movements)}× · {n0(b.units)} units
              </span>
            </span>
          ))}
        </div>
      )}

      <Card title="Movements" className="mx-4 lg:mx-6" action={<span className="text-xs text-muted-foreground">Oldest first · balance carries across pages</span>}>
        {h.movements.length === 0 ? (
          <p className="px-4 pb-4 text-sm text-muted-foreground">No movements in this period.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className={th}>When</th>
                    <th className={th}>Type</th>
                    <th className={th}>Where</th>
                    <th className={cn(th, "text-right")}>Change</th>
                    <th className={cn(th, "text-right")}>Balance</th>
                    <th className={cn(th, "hidden text-right lg:table-cell")}>Unit cost</th>
                    <th className={cn(th, "hidden md:table-cell")}>Reference</th>
                    <th className={cn(th, "hidden xl:table-cell")}>By</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {h.movements.map((m) => (
                    <tr key={m.id} className="border-t border-border/60">
                      <td className={cn(td, "whitespace-nowrap text-muted-foreground")}>{fmtDateTime(m.createdAt)}</td>
                      <td className={td}>
                        <MovementTag movement={m} />
                      </td>
                      <td className={td}>
                        <span className="flex flex-wrap items-center gap-1">
                          <WarehouseTag code={m.warehouse.code} />
                          {m.fromLocation && <RackTag code={m.fromLocation.code} />}
                          {m.fromLocation && m.toLocation && <ArrowRightIcon className="size-3 text-muted-foreground" />}
                          {m.toLocation && <RackTag code={m.toLocation.code} />}
                        </span>
                      </td>
                      <td className={cn(td, "text-right")}>
                        <Change n={m.change} />
                        {m.change === 0 && <div className="text-[11px] text-muted-foreground">{n0(m.quantity)} units</div>}
                      </td>
                      <td className={cn(td, "text-right font-semibold")}>{n0(m.balance)}</td>
                      <td className={cn(td, "hidden text-right text-muted-foreground lg:table-cell")}>{m.unitCost ? money(m.unitCost) : "—"}</td>
                      <td className={cn(td, "hidden max-w-64 truncate text-muted-foreground md:table-cell")} title={m.note ?? undefined}>
                        {m.note ?? (m.referenceType ? m.referenceType.toLowerCase().replace(/_/g, " ") : "—")}
                      </td>
                      <td className={cn(td, "hidden text-muted-foreground xl:table-cell")}>{m.performedBy?.name ?? "System"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager page={meta.page} totalPages={meta.totalPages} total={meta.total} noun="movements" />
          </>
        )}
      </Card>
    </>
  )
}
