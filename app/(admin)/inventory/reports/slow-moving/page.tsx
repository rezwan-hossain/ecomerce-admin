import Link from "next/link"
import { connection } from "next/server"

import { getSlowMovingReport } from "@/app/actions/inventory-report.actions"
import { getWarehouse } from "@/app/actions/warehouse.actions"
import { Card, fmtDate, n0, Pill, taka, type Tone } from "@/components/inventory/inventory-ui"
import { hrefWith, money, param, ratio } from "@/components/inventory/reports/format"
import { Pager, ParamNumber, ParamSearch, ParamSelect, SortHeader } from "@/components/inventory/reports/report-bits"
import { cn } from "@/lib/utils"
import type { SlowStatus } from "@/types/inventory-report.type"

const PATH = "/inventory/reports/slow-moving"
const STATUS: Record<SlowStatus, { tone: Tone; text: string; help: (days: number, cover: number) => string }> = {
  DEAD: { tone: "red", text: "Dead", help: (days) => `Nothing sold in the last ${days} days, and the stock is older than that.` },
  SLOW: { tone: "amber", text: "Slow", help: (_, cover) => `Selling, but current stock would last more than ${cover} days.` },
  NEW: { tone: "blue", text: "New", help: () => "First received inside the window, no sales yet. Not a problem yet." },
  OK: { tone: "green", text: "OK", help: () => "Selling at a healthy pace." },
}
const WINDOWS = ["30", "60", "90", "180", "365"].map((d) => ({ value: d, label: `Last ${d} days` }))
const TABS = [
  { value: "", text: "Needs attention" },
  { value: "DEAD", text: "Dead" },
  { value: "SLOW", text: "Slow" },
  { value: "NEW", text: "New" },
  { value: "OK", text: "OK" },
  { value: "ALL", text: "All" },
]
const th = "px-3 py-2.5 font-medium first:pl-4 last:pr-4"
const td = "px-3 py-3 first:pl-4 last:pr-4"

export default async function SlowMovingPage({ searchParams }: PageProps<"/inventory/reports/slow-moving">) {
  await connection()
  const search = await searchParams
  const filters = {
    days: param(search, "days") || "90",
    coverDays: param(search, "coverDays") || "180",
    status: param(search, "status"),
    warehouseId: param(search, "warehouseId"),
    search: param(search, "search"),
    sortBy: param(search, "sortBy") || "stockValue",
    sortOrder: param(search, "sortOrder") || "desc",
    page: param(search, "page") || "1",
  }

  const [res, warehouses] = await Promise.all([getSlowMovingReport(filters), getWarehouse()])
  if (!res.success) return <p className="px-4 text-muted-foreground lg:px-6">Couldn’t load the report: {res.error}</p>
  const { data: rows, meta } = res.data
  const warehouseItems = [
    { value: "all", label: "Sellable warehouses" },
    ...(warehouses.success ? warehouses.data : []).map((w) => ({ value: w.id, label: `${w.code}${w.isActive ? "" : " (inactive)"}` })),
  ]

  return (
    <>
      <section className="grid grid-cols-2 gap-4 px-4 lg:grid-cols-4 lg:px-6">
        {(["DEAD", "SLOW", "NEW", "OK"] as SlowStatus[]).map((s) => {
          const sum = meta.summary[s]
          return (
            <Link
              key={s}
              href={hrefWith(PATH, search, { status: s })}
              className={cn("flex flex-col gap-1 rounded-2xl border bg-card px-4 py-3.5 transition-colors hover:border-primary/40", filters.status === s && "ring-2 ring-primary/30")}
              title={STATUS[s].help(meta.days, meta.coverDays)}
            >
              <span className="flex items-center justify-between gap-2">
                <Pill tone={STATUS[s].tone}>{STATUS[s].text}</Pill>
                <span className="text-xs text-muted-foreground">{n0(sum.variants)} SKUs</span>
              </span>
              <strong className="text-2xl font-bold tracking-tight tabular-nums">{taka(Number(sum.stockValue))}</strong>
              <span className="text-xs text-muted-foreground">{n0(sum.units)} units tied up</span>
            </Link>
          )
        })}
      </section>

      <div className="flex flex-wrap items-center gap-3 px-4 lg:px-6">
        <nav aria-label="Status" className="flex gap-0.5 overflow-x-auto rounded-lg bg-muted p-0.5">
          {TABS.map((t) => (
            <Link
              key={t.value}
              href={hrefWith(PATH, search, { status: t.value || null })}
              className={cn(
                "rounded-md px-2.5 py-1 text-[13px] font-medium whitespace-nowrap text-muted-foreground hover:text-foreground",
                filters.status === t.value && "bg-card text-foreground shadow-xs"
              )}
            >
              {t.text}
            </Link>
          ))}
        </nav>
        <span className="flex-1" />
        <ParamSelect name="days" value={filters.days} items={WINDOWS} label="Sales window" />
        <ParamNumber name="coverDays" value={filters.coverDays} label="Slow after" suffix="days of cover" />
        <ParamSelect name="warehouseId" value={filters.warehouseId || "all"} items={warehouseItems} label="Warehouse" />
        <ParamSearch value={filters.search} placeholder="SKU or product, Enter" />
      </div>

      <Card title={`${n0(meta.total)} SKUs`} className="mx-4 lg:mx-6" action={<span className="text-xs text-muted-foreground">Sales in the last {meta.days} days</span>}>
        {rows.length === 0 ? (
          <p className="px-4 pb-4 text-sm text-muted-foreground">Nothing here: no stock matches these filters.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className={th}>Item</th>
                    <th className={th}>Status</th>
                    <th className={cn(th, "text-right")}><SortHeader field="onHand" text="On hand" sortBy={filters.sortBy} sortOrder={filters.sortOrder} /></th>
                    <th className={cn(th, "text-right")}><SortHeader field="stockValue" text="Value" sortBy={filters.sortBy} sortOrder={filters.sortOrder} /></th>
                    <th className={cn(th, "hidden text-right md:table-cell")}>Sold</th>
                    <th className={cn(th, "hidden text-right md:table-cell")}><SortHeader field="daysOfCover" text="Days of cover" sortBy={filters.sortBy} sortOrder={filters.sortOrder} /></th>
                    <th className={cn(th, "hidden lg:table-cell")}><SortHeader field="lastSaleAt" text="Last sale" sortBy={filters.sortBy} sortOrder={filters.sortOrder} /></th>
                    <th className={cn(th, "hidden xl:table-cell")}>Last received</th>
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
                      <td className={td} title={STATUS[r.status].help(meta.days, meta.coverDays)}>
                        <Pill tone={STATUS[r.status].tone}>{STATUS[r.status].text}</Pill>
                      </td>
                      <td className={cn(td, "text-right font-semibold")}>{n0(r.onHand)}</td>
                      <td className={cn(td, "text-right whitespace-nowrap")}>{money(r.stockValue)}</td>
                      <td className={cn(td, "hidden text-right text-muted-foreground md:table-cell")}>{n0(r.unitsSold)}</td>
                      <td className={cn(td, "hidden text-right md:table-cell", r.daysOfCover !== null && r.daysOfCover > meta.coverDays && "text-amber-700 dark:text-amber-400")}>
                        {ratio(r.daysOfCover === null ? null : Math.round(r.daysOfCover))}
                      </td>
                      <td className={cn(td, "hidden whitespace-nowrap lg:table-cell")}>
                        {r.lastSaleAt ? (
                          <span className="flex flex-col">
                            {fmtDate(r.lastSaleAt)}
                            <span className="text-xs text-muted-foreground">{n0(r.daysSinceLastSale ?? 0)} days ago</span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Never</span>
                        )}
                      </td>
                      <td className={cn(td, "hidden whitespace-nowrap text-muted-foreground xl:table-cell")}>{fmtDate(r.lastReceivedAt)}</td>
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
