import Link from "next/link"
import { connection } from "next/server"

import { getTurnoverReport } from "@/app/actions/inventory-report.actions"
import { getWarehouse } from "@/app/actions/warehouse.actions"
import { Card, Kpis, n0, taka } from "@/components/inventory/inventory-ui"
import { money, param, ratio } from "@/components/inventory/reports/format"
import { Pager, ParamSearch, ParamSelect, SortHeader } from "@/components/inventory/reports/report-bits"
import { cn } from "@/lib/utils"

const WINDOWS = ["30", "60", "90", "180", "365"].map((d) => ({ value: d, label: `Last ${d} days` }))
const th = "px-3 py-2.5 font-medium first:pl-4 last:pr-4"
const td = "px-3 py-3 first:pl-4 last:pr-4"

export default async function TurnoverPage({ searchParams }: PageProps<"/inventory/reports/turnover">) {
  await connection()
  const search = await searchParams
  const filters = {
    days: param(search, "days") || "90",
    warehouseId: param(search, "warehouseId"),
    search: param(search, "search"),
    sortBy: param(search, "sortBy") || "turnover",
    sortOrder: param(search, "sortOrder") || "desc",
    page: param(search, "page") || "1",
  }

  const [res, warehouses] = await Promise.all([getTurnoverReport(filters), getWarehouse()])
  if (!res.success) return <p className="px-4 text-muted-foreground lg:px-6">Couldn’t load the report: {res.error}</p>
  const { data: rows, meta } = res.data
  const t = meta.totals
  const warehouseItems = [
    { value: "all", label: "Sellable warehouses" },
    ...(warehouses.success ? warehouses.data : []).map((w) => ({ value: w.id, label: `${w.code}${w.isActive ? "" : " (inactive)"}` })),
  ]
  const sort = { sortBy: filters.sortBy, sortOrder: filters.sortOrder }

  return (
    <>
      <Kpis
        items={[
          { label: "Turnover", value: ratio(t.turnover, "×"), hint: `in ${meta.days} days` },
          { label: "Per year", value: ratio(t.annualizedTurnover, "×"), hint: "at this pace" },
          { label: "Days of inventory", value: ratio(t.daysOfInventory === null ? null : Math.round(t.daysOfInventory)), hint: "how long average stock lasts" },
          { label: "Cost of goods sold", value: taka(Number(t.cogs)), hint: `${n0(t.unitsSold)} units sold` },
          { label: "Average on hand", value: ratio(Math.round(t.averageOnHand)), hint: `across ${n0(t.variants)} SKUs` },
          { label: "Stock value", value: taka(Number(t.stockValue)), hint: "now, at average cost" },
        ]}
      />

      <div className="flex flex-wrap items-center gap-3 px-4 lg:px-6">
        <p className="min-w-0 flex-1 basis-80 text-[13px] text-muted-foreground">
          Turnover = units sold ÷ average units on hand. Higher is better; 0 means nothing sold. Counted in units, from the stock ledger.
        </p>
        <ParamSelect name="days" value={filters.days} items={WINDOWS} label="Window" />
        <ParamSelect name="warehouseId" value={filters.warehouseId || "all"} items={warehouseItems} label="Warehouse" />
        <ParamSearch value={filters.search} placeholder="SKU or product, Enter" />
      </div>

      <Card title={`${n0(meta.total)} SKUs`} className="mx-4 lg:mx-6" action={<span className="text-xs text-muted-foreground">Last {meta.days} days</span>}>
        {rows.length === 0 ? (
          <p className="px-4 pb-4 text-sm text-muted-foreground">No SKUs match these filters.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className={th}>Item</th>
                    <th className={cn(th, "hidden text-right lg:table-cell")}>Opening</th>
                    <th className={cn(th, "hidden text-right lg:table-cell")}>Closing</th>
                    <th className={cn(th, "hidden text-right md:table-cell")}>Average</th>
                    <th className={cn(th, "text-right")}><SortHeader field="unitsSold" text="Sold" {...sort} /></th>
                    <th className={cn(th, "hidden text-right md:table-cell")}><SortHeader field="cogs" text="COGS" {...sort} /></th>
                    <th className={cn(th, "text-right")}><SortHeader field="turnover" text="Turnover" {...sort} /></th>
                    <th className={cn(th, "hidden text-right xl:table-cell")}>Per year</th>
                    <th className={cn(th, "text-right")}><SortHeader field="daysOfInventory" text="Days of inventory" {...sort} /></th>
                    <th className={cn(th, "hidden text-right xl:table-cell")}>Stock value</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {rows.map((r) => (
                    <tr key={r.variant.id} className="border-t border-border/60">
                      <td className={td}>
                        <Link href={`/inventory/reports/history?variantId=${r.variant.id}`} className="font-medium hover:text-primary hover:underline">
                          {r.variant.productName}
                          {r.variant.label && <span className="font-normal text-muted-foreground">, {r.variant.label}</span>}
                        </Link>
                        <div className="font-mono text-[11.5px] text-muted-foreground">{r.variant.sku}</div>
                      </td>
                      <td className={cn(td, "hidden text-right text-muted-foreground lg:table-cell")}>{n0(r.openingOnHand)}</td>
                      <td className={cn(td, "hidden text-right text-muted-foreground lg:table-cell")}>{n0(r.closingOnHand)}</td>
                      <td className={cn(td, "hidden text-right md:table-cell")}>{ratio(r.averageOnHand)}</td>
                      <td className={cn(td, "text-right font-semibold")}>{n0(r.unitsSold)}</td>
                      <td className={cn(td, "hidden text-right whitespace-nowrap md:table-cell")}>{money(r.cogs)}</td>
                      <td className={cn(td, "text-right font-semibold", r.turnover === 0 && "text-muted-foreground")}>{ratio(r.turnover, "×")}</td>
                      <td className={cn(td, "hidden text-right text-muted-foreground xl:table-cell")}>{ratio(r.annualizedTurnover, "×")}</td>
                      <td className={cn(td, "text-right")}>{ratio(r.daysOfInventory === null ? null : Math.round(r.daysOfInventory))}</td>
                      <td className={cn(td, "hidden text-right whitespace-nowrap text-muted-foreground xl:table-cell")}>{money(r.stockValue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager page={meta.page} totalPages={meta.totalPages} total={meta.total} noun="SKUs" />
          </>
        )}
      </Card>
    </>
  )
}
