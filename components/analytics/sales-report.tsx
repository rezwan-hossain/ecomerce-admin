"use client"

import { useState } from "react"
import { ArrowDownRightIcon, ArrowUpRightIcon, DownloadIcon, MinusIcon } from "lucide-react"
import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

import { buckets, change, periodRange, PERIODS, type Period, type SalesData, within } from "@/components/analytics/analytics-utils"
import { Card, n0, taka } from "@/components/inventory/inventory-ui"
import { PROVIDER_LABEL } from "@/components/orders/orders-table"
import { Button } from "@/components/ui/button"
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { cn } from "@/lib/utils"

// "৳1.2L" style for axis ticks; full amounts everywhere else.
const short = (n: number) => {
  if (n >= 10_000_000) return `৳${(n / 10_000_000).toFixed(1)}Cr`
  if (n >= 100_000) return `৳${(n / 100_000).toFixed(1)}L`
  if (n >= 1_000) return `৳${(n / 1_000).toFixed(0)}k`
  return `৳${Math.round(n)}`
}

export function PeriodPicker({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  return (
    <ToggleGroup multiple={false} value={[value]} onValueChange={(v) => v[0] && onChange(v[0] as Period)} variant="outline" size="sm" spacing={0} aria-label="Period">
      {PERIODS.map((p) => (
        <ToggleGroupItem key={p.value} value={p.value} className="bg-card px-3 text-xs data-pressed:bg-primary data-pressed:text-primary-foreground">
          {p.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}

// Up or down against the previous period, always with an arrow and words, never colour alone.
export function Change({ value, invert = false, bare = false }: { value: number | null; invert?: boolean; bare?: boolean }) {
  if (value === null) return <span className="text-xs text-muted-foreground">{bare ? "new" : "no earlier data"}</span>
  const flat = Math.abs(value) < 0.5
  const good = invert ? value < 0 : value > 0
  let Icon = value > 0 ? ArrowUpRightIcon : ArrowDownRightIcon
  if (flat) Icon = MinusIcon
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-medium",
        flat && "text-muted-foreground",
        !flat && good && "text-emerald-700 dark:text-emerald-400",
        !flat && !good && "text-red-700 dark:text-red-400"
      )}
    >
      <Icon className="size-3.5" />
      {flat ? "same" : `${value > 0 ? "+" : "−"}${Math.abs(value).toFixed(0)}%`}
      {!bare && <span className="font-normal text-muted-foreground">vs previous</span>}
    </span>
  )
}

export function Stat({ label, value, hint, delta, invert }: { label: string; value: string; hint?: string; delta?: number | null; invert?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 bg-card px-4 py-3.5">
      <span className="text-[12.5px] text-muted-foreground">{label}</span>
      <strong className="truncate text-2xl font-bold tracking-tight tabular-nums">{value}</strong>
      {delta !== undefined && <Change value={delta} invert={invert} />}
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  )
}

export function ShareBars({ rows, total, format = taka }: { rows: { label: string; value: number; note: string }[]; total: number; format?: (n: number) => string }) {
  return (
    <ul className="flex flex-col gap-3 px-4 pb-4">
      {rows.map((r) => (
        <li key={r.label} className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="truncate">{r.label}</span>
            <span className="shrink-0 font-medium tabular-nums">
              {format(r.value)} <span className="text-xs font-normal text-muted-foreground">· {r.note}</span>
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-chart-1" style={{ width: `${total > 0 ? (r.value / total) * 100 : 0}%` }} />
          </div>
        </li>
      ))}
      {rows.length === 0 && <li className="text-sm text-muted-foreground">No sales in this period.</li>}
    </ul>
  )
}

const salesConfig = {
  net: { label: "This period", color: "var(--chart-1)" },
  previous: { label: "Previous period", color: "var(--chart-2)" },
} satisfies ChartConfig
const ordersConfig = { orders: { label: "Orders", color: "var(--chart-1)" } } satisfies ChartConfig

export function SalesReport({ data }: { data: SalesData }) {
  const [period, setPeriod] = useState<Period>("90d")
  const firstAt = data.orders.reduce<string | undefined>((first, o) => (!first || o.at < first ? o.at : first), undefined)
  const { start, end, previousStart } = periodRange(period, firstAt)

  const inPeriod = data.orders.filter((o) => within(o.at, start, end))
  const before = data.orders.filter((o) => within(o.at, previousStart, start))
  const sold = inPeriod.filter((o) => !o.cancelled)
  const soldBefore = before.filter((o) => !o.cancelled)
  const lines = data.lines.filter((l) => within(l.at, start, end))

  const sum = (list: typeof sold, pick: (o: (typeof sold)[number]) => number) => list.reduce((s, o) => s + pick(o), 0)
  const netOf = (list: typeof sold) => sum(list, (o) => o.gross - o.discount - o.returned)
  const gross = sum(sold, (o) => o.gross)
  const discounts = sum(sold, (o) => o.discount)
  const returns = sum(sold, (o) => o.returned)
  const net = netOf(sold)
  const netBefore = netOf(soldBefore)
  const units = lines.reduce((s, l) => s + l.units, 0)
  const unitsBefore = data.lines.filter((l) => within(l.at, previousStart, start)).reduce((s, l) => s + l.units, 0)
  const aov = sold.length ? net / sold.length : 0
  const aovBefore = soldBefore.length ? netBefore / soldBefore.length : 0
  // Profit only from lines whose unit cost is known; say how much that covers.
  const costed = lines.filter((l) => l.cost !== null)
  const costedRevenue = costed.reduce((s, l) => s + l.revenue, 0)
  const profit = costedRevenue - costed.reduce((s, l) => s + (l.cost ?? 0), 0)
  const revenueAll = lines.reduce((s, l) => s + l.revenue, 0)
  const cancelRate = inPeriod.length ? ((inPeriod.length - sold.length) / inPeriod.length) * 100 : 0
  const cancelRateBefore = before.length ? ((before.length - soldBefore.length) / before.length) * 100 : 0

  // The same buckets for the previous window, matched by position.
  const now = buckets(start, end)
  const prev = buckets(previousStart, start)
  const series = now.list.map((b, index) => ({ label: b.label, key: b.key, net: 0, previous: 0, orders: 0, units: 0, gross: 0, discounts: 0, returns: 0, previousKey: prev.list[index]?.key }))
  const byKey = new Map(series.map((s) => [s.key, s]))
  const byPreviousKey = new Map(series.map((s) => [s.previousKey, s]))
  for (const o of sold) {
    const row = byKey.get(now.keyOf(o.at))
    if (!row) continue
    row.net += o.gross - o.discount - o.returned
    row.gross += o.gross
    row.discounts += o.discount
    row.returns += o.returned
    row.orders += 1
  }
  // Units kept (returns taken out), the same count as the Units sold tile.
  for (const l of lines) {
    const row = byKey.get(now.keyOf(l.at))
    if (row) row.units += l.units
  }
  for (const o of soldBefore) {
    const row = byPreviousKey.get(prev.keyOf(o.at))
    if (row) row.previous += o.gross - o.discount - o.returned
  }

  const byCategory = new Map<string, number>()
  const productCategory = new Map(data.products.map((p) => [p.id, p.category ?? "No category"]))
  for (const l of lines) {
    const c = productCategory.get(l.productId) ?? "No category"
    byCategory.set(c, (byCategory.get(c) ?? 0) + l.revenue)
  }
  const categories = [...byCategory.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)

  const byProvider = new Map<string, { value: number; orders: number }>()
  for (const o of sold) {
    const row = byProvider.get(o.provider) ?? { value: 0, orders: 0 }
    row.value += o.gross - o.discount - o.returned
    row.orders += 1
    byProvider.set(o.provider, row)
  }
  const providers = [...byProvider.entries()].sort((a, b) => b[1].value - a[1].value)

  // Where the period's orders ended up.
  const outcomes = [
    { label: "Delivered or completed", match: ["DELIVERED", "COMPLETED"], tone: "bg-emerald-500" },
    { label: "Still in progress", match: ["PENDING", "CONFIRMED", "PROCESSING", "READY_TO_SHIP", "SHIPPED"], tone: "bg-chart-1" },
    { label: "Returned or refunded", match: ["RETURNED", "PARTIALLY_RETURNED", "REFUNDED"], tone: "bg-amber-500" },
    { label: "Cancelled or failed", match: ["CANCELLED", "FAILED"], tone: "bg-red-500" },
  ].map((o) => ({ ...o, count: inPeriod.filter((x) => o.match.includes(x.status)).length }))

  function downloadCsv() {
    const header = ["Period", "Orders", "Units", "Gross sales", "Discounts", "Returns", "Net sales"]
    const rows = series.map((s) => [s.label, s.orders, s.units, s.gross, s.discounts, s.returns, s.net].map((v) => (typeof v === "number" ? v.toFixed(2) : `"${v}"`)))
    const csv = [header.join(","), ...rows.map((r) => r.join(","))].join("\n")
    const link = document.createElement("a")
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }))
    link.download = `sales-${period}-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  const sizeWord = { day: "Day", week: "Week of", month: "Month" }[now.size]

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 lg:px-6">
        <PeriodPicker value={period} onChange={setPeriod} />
        <span className="text-xs text-muted-foreground">
          {new Date(start).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} – today · compared with the {PERIODS.find((p) => p.value === period)!.label.toLowerCase()} before
        </span>
      </div>

      <section className="mx-4 grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border md:grid-cols-3 lg:mx-6 xl:grid-cols-6">
        <Stat label="Net sales" value={taka(net)} delta={change(net, netBefore)} />
        <Stat label="Orders" value={n0(sold.length)} delta={change(sold.length, soldBefore.length)} />
        <Stat label="Average order" value={taka(aov)} delta={change(aov, aovBefore)} />
        <Stat label="Units sold" value={n0(units)} delta={change(units, unitsBefore)} />
        <Stat
          label="Gross profit"
          value={costedRevenue > 0 ? taka(profit) : "—"}
          hint={costedRevenue > 0 ? `${Math.round((profit / costedRevenue) * 100)}% margin · cost known for ${Math.round((costedRevenue / (revenueAll || 1)) * 100)}% of sales` : "no unit costs recorded"}
        />
        <Stat label="Cancelled" value={`${cancelRate.toFixed(0)}%`} delta={change(cancelRate, cancelRateBefore)} invert hint={`${n0(inPeriod.length - sold.length)} of ${n0(inPeriod.length)} orders`} />
      </section>

      <div className="grid items-start gap-4 px-4 md:gap-6 lg:px-6 xl:grid-cols-3">
        <Card title="Net sales" className="xl:col-span-2" action={<span className="text-xs text-muted-foreground">by {now.size}, after discounts and returns</span>}>
          <div className="px-2 pb-4 sm:px-4">
            <ChartContainer config={salesConfig} className="aspect-auto h-[280px] w-full">
              <AreaChart data={series} margin={{ left: 4, right: 8, top: 8 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} />
                <YAxis tickLine={false} axisLine={false} width={52} tickFormatter={short} />
                <ChartTooltip cursor={{ stroke: "var(--border)", strokeWidth: 1 }} content={<ChartTooltipContent indicator="line" formatter={(value, name) => (
                  <span className="flex w-full justify-between gap-4">
                    <span className="text-muted-foreground">{salesConfig[name as keyof typeof salesConfig]?.label}</span>
                    <span className="font-medium tabular-nums">{taka(Number(value))}</span>
                  </span>
                )} />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Area dataKey="previous" type="monotone" fill="var(--color-previous)" fillOpacity={0} stroke="var(--color-previous)" strokeWidth={2} strokeDasharray="4 4" />
                <Area dataKey="net" type="monotone" fill="var(--color-net)" fillOpacity={0.1} stroke="var(--color-net)" strokeWidth={2} />
              </AreaChart>
            </ChartContainer>
          </div>
        </Card>

        <Card title="Where the money went">
          <dl className="flex flex-col gap-2.5 px-4 pb-4 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Gross sales</dt>
              <dd className="font-medium tabular-nums">{taka(gross)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Discounts</dt>
              <dd className="font-medium tabular-nums">−{taka(discounts)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Returns</dt>
              <dd className="font-medium tabular-nums">−{taka(returns)}</dd>
            </div>
            <div className="flex justify-between gap-2 border-t pt-2.5 text-base font-semibold">
              <dt>Net sales</dt>
              <dd className="tabular-nums">{taka(net)}</dd>
            </div>
            <div className="flex justify-between gap-2 text-xs">
              <dt className="text-muted-foreground">Delivery charged on top</dt>
              <dd className="tabular-nums">{taka(sum(sold, (o) => o.shipping))}</dd>
            </div>
            <div className="mt-2 flex flex-col gap-2 border-t pt-3">
              <span className="text-xs font-medium text-muted-foreground">How orders ended up</span>
              {/* One row per outcome: a dot, the words and the count, so colour never works alone. */}
              <div className="flex h-2 overflow-hidden rounded-full bg-muted">
                {outcomes.map((o) => (
                  <span key={o.label} className={o.tone} style={{ width: `${inPeriod.length ? (o.count / inPeriod.length) * 100 : 0}%` }} />
                ))}
              </div>
              {outcomes.map((o) => (
                <div key={o.label} className="flex items-center gap-2 text-xs">
                  <span className={cn("size-2 rounded-full", o.tone)} />
                  <span className="flex-1 text-muted-foreground">{o.label}</span>
                  <span className="font-medium tabular-nums">{n0(o.count)}</span>
                </div>
              ))}
            </div>
          </dl>
        </Card>
      </div>

      <div className="grid items-start gap-4 px-4 md:gap-6 lg:px-6 xl:grid-cols-3">
        <Card title="Orders" action={<span className="text-xs text-muted-foreground">by {now.size}</span>}>
          <div className="px-2 pb-4 sm:px-4">
            <ChartContainer config={ordersConfig} className="aspect-auto h-[220px] w-full">
              <BarChart data={series} margin={{ left: 0, right: 4, top: 8 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={20} />
                <YAxis tickLine={false} axisLine={false} width={28} allowDecimals={false} />
                <ChartTooltip cursor={{ fill: "var(--muted)" }} content={<ChartTooltipContent hideIndicator />} />
                <Bar dataKey="orders" fill="var(--color-orders)" radius={[4, 4, 0, 0]} maxBarSize={24} />
              </BarChart>
            </ChartContainer>
          </div>
        </Card>
        <Card title="Sales by category" action={<span className="text-xs text-muted-foreground">primary category</span>}>
          <ShareBars rows={categories.map(([label, value]) => ({ label, value, note: `${Math.round((value / (revenueAll || 1)) * 100)}%` }))} total={categories[0]?.[1] ?? 0} />
        </Card>
        <Card title="Payment methods">
          <ShareBars
            rows={providers.map(([provider, row]) => ({ label: PROVIDER_LABEL[provider as keyof typeof PROVIDER_LABEL] ?? provider, value: row.value, note: `${n0(row.orders)} orders` }))}
            total={providers[0]?.[1].value ?? 0}
          />
        </Card>
      </div>

      <Card
        title={`Sales by ${now.size}`}
        className="mx-4 lg:mx-6"
        action={
          <Button size="sm" variant="outline" onClick={downloadCsv}>
            <DownloadIcon />
            Download CSV
          </Button>
        }
      >
        <div className="max-h-[420px] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted text-left text-xs text-muted-foreground">
              <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:font-medium [&>th:first-child]:pl-4 [&>th:last-child]:pr-4">
                <th>{sizeWord}</th>
                <th className="text-right">Orders</th>
                <th className="text-right">Units</th>
                <th className="hidden text-right sm:table-cell">Gross</th>
                <th className="hidden text-right md:table-cell">Discounts</th>
                <th className="hidden text-right md:table-cell">Returns</th>
                <th className="text-right">Net sales</th>
                <th className="hidden text-right lg:table-cell">Average order</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {[...series].reverse().map((s) => (
                <tr key={s.key} className={cn("border-t border-border/60 [&>td]:px-3 [&>td]:py-2 [&>td:first-child]:pl-4 [&>td:last-child]:pr-4", s.orders === 0 && "text-muted-foreground")}>
                  <td>{s.label}</td>
                  <td className="text-right">{n0(s.orders)}</td>
                  <td className="text-right">{n0(s.units)}</td>
                  <td className="hidden text-right sm:table-cell">{taka(s.gross)}</td>
                  <td className="hidden text-right md:table-cell">{s.discounts > 0 ? `−${taka(s.discounts)}` : "—"}</td>
                  <td className="hidden text-right md:table-cell">{s.returns > 0 ? `−${taka(s.returns)}` : "—"}</td>
                  <td className="text-right font-medium">{taka(s.net)}</td>
                  <td className="hidden text-right lg:table-cell">{s.orders ? taka(s.net / s.orders) : "—"}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t bg-muted/40 font-semibold tabular-nums">
              <tr className="[&>td]:px-3 [&>td]:py-2 [&>td:first-child]:pl-4 [&>td:last-child]:pr-4">
                <td>Total</td>
                <td className="text-right">{n0(sold.length)}</td>
                <td className="text-right">{n0(series.reduce((s, r) => s + r.units, 0))}</td>
                <td className="hidden text-right sm:table-cell">{taka(gross)}</td>
                <td className="hidden text-right md:table-cell">−{taka(discounts)}</td>
                <td className="hidden text-right md:table-cell">−{taka(returns)}</td>
                <td className="text-right">{taka(net)}</td>
                <td className="hidden text-right lg:table-cell">{taka(aov)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
      <p className="px-4 text-xs text-muted-foreground lg:px-6">
        Counts every order except cancelled and failed ones, by the day it was placed. Net sales = list price − discounts − returns; delivery charges are shown
        apart. Gross profit uses each variant&apos;s average unit cost, only where one is recorded.
      </p>
    </>
  )
}
