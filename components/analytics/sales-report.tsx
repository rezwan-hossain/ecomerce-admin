"use client"

import Link from "next/link"
import { useState } from "react"
import {
  ArrowDownRightIcon,
  ArrowUpRightIcon,
  BanknoteIcon,
  CalendarIcon,
  CrownIcon,
  DownloadIcon,
  MapPinIcon,
  MinusIcon,
  PackageIcon,
  ReceiptIcon,
  SparklesIcon,
  TagIcon,
  TrophyIcon,
  TruckIcon,
  UserPlusIcon,
} from "lucide-react"
import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

import { buckets, change, periodRange, PERIODS, type Period, type SalesData, within } from "@/components/analytics/analytics-utils"
import { Card, n0, taka } from "@/components/inventory/inventory-ui"
import { PROVIDER_LABEL } from "@/components/orders/orders-table"
import { Button } from "@/components/ui/button"
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { cn } from "@/lib/utils"

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
const WEEKDAY_NAMES = ["Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays", "Sundays"]

// "৳1.2L" style for axis ticks and tight spots; full amounts everywhere else.
export const short = (n: number) => {
  if (n >= 10_000_000) return `৳${(n / 10_000_000).toFixed(1)}Cr`
  if (n >= 100_000) return `৳${(n / 100_000).toFixed(1)}L`
  if (n >= 1_000) return `৳${(n / 1_000).toFixed(0)}k`
  return `৳${Math.round(n)}`
}
const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0)

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
      {rows.length === 0 && <li className="text-sm text-muted-foreground">Nothing in this period.</li>}
    </ul>
  )
}

// A KPI with a tiny trend of the same number across the period.
function SparkStat({
  label,
  value,
  delta,
  hint,
  spark,
  invert,
  icon: Icon,
}: {
  label: string
  value: string
  delta?: number | null
  hint?: string
  spark: number[]
  invert?: boolean
  icon: typeof ReceiptIcon
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-2xl border bg-card p-4">
      <div className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
        <span className="grid size-6 place-items-center rounded-md bg-primary/10 text-primary">
          <Icon className="size-3.5" />
        </span>
        {label}
      </div>
      <strong className="truncate text-2xl font-bold tracking-tight tabular-nums">{value}</strong>
      {delta !== undefined && <Change value={delta} invert={invert} />}
      <ChartContainer config={{ v: { label, color: "var(--chart-1)" } }} className="mt-1 aspect-auto h-10 w-full">
        <AreaChart data={spark.map((v, i) => ({ i, v }))} margin={{ top: 2, bottom: 2, left: 0, right: 0 }}>
          <Area dataKey="v" type="monotone" stroke="var(--color-v)" strokeWidth={2} fill="var(--color-v)" fillOpacity={0.1} isAnimationActive={false} dot={false} />
        </AreaChart>
      </ChartContainer>
      {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
    </div>
  )
}

const METRICS = [
  { value: "net", label: "Net sales" },
  { value: "orders", label: "Orders" },
  { value: "units", label: "Units" },
  { value: "aov", label: "Average order" },
] as const
type Metric = (typeof METRICS)[number]["value"]

const ordersConfig = { orders: { label: "Orders", color: "var(--chart-1)" } } satisfies ChartConfig

export function SalesReport({ data }: { data: SalesData }) {
  const [period, setPeriod] = useState<Period>("90d")
  const [metric, setMetric] = useState<Metric>("net")
  const firstAt = data.orders.reduce<string | undefined>((first, o) => (!first || o.at < first ? o.at : first), undefined)
  const { start, end, previousStart } = periodRange(period, firstAt)
  const periodLabel = PERIODS.find((p) => p.value === period)!.label.toLowerCase()

  const inPeriod = data.orders.filter((o) => within(o.at, start, end))
  const before = data.orders.filter((o) => within(o.at, previousStart, start))
  const sold = inPeriod.filter((o) => !o.cancelled)
  const soldBefore = before.filter((o) => !o.cancelled)
  const lines = data.lines.filter((l) => within(l.at, start, end))
  const linesBefore = data.lines.filter((l) => within(l.at, previousStart, start))

  type O = (typeof sold)[number]
  const netOf = (o: O) => o.gross - o.discount - o.returned
  const sum = (list: O[], pick: (o: O) => number) => list.reduce((s, o) => s + pick(o), 0)
  const gross = sum(sold, (o) => o.gross)
  const discounts = sum(sold, (o) => o.discount)
  const returns = sum(sold, (o) => o.returned)
  const net = sum(sold, netOf)
  const netBefore = sum(soldBefore, netOf)
  const delivery = sum(sold, (o) => o.shipping)
  const units = lines.reduce((s, l) => s + l.units, 0)
  const unitsBefore = linesBefore.reduce((s, l) => s + l.units, 0)
  const aov = sold.length ? net / sold.length : 0
  const aovBefore = soldBefore.length ? netBefore / soldBefore.length : 0
  const costed = lines.filter((l) => l.cost !== null)
  const costedRevenue = costed.reduce((s, l) => s + l.revenue, 0)
  const cost = costed.reduce((s, l) => s + (l.cost ?? 0), 0)
  const revenueAll = lines.reduce((s, l) => s + l.revenue, 0)
  const cancelRate = pct(inPeriod.length - sold.length, inPeriod.length)
  const cancelRateBefore = pct(before.length - soldBefore.length, before.length)
  const customers = new Set(sold.map((o) => o.customer))
  const customersBefore = new Set(soldBefore.map((o) => o.customer))
  const newCustomers = sold.filter((o) => o.firstOrder)
  const repeatOrders = sold.filter((o) => !o.firstOrder)
  const delivered = sold.filter((o) => o.deliveryDays !== null)
  const avgDelivery = delivered.length ? sum(delivered, (o) => o.deliveryDays ?? 0) / delivered.length : null

  // The period in buckets, the previous one matched by position.
  const now = buckets(start, end)
  const prev = buckets(previousStart, start)
  const series = now.list.map((b, index) => ({
    label: b.label,
    key: b.key,
    previousKey: prev.list[index]?.key,
    net: 0,
    orders: 0,
    units: 0,
    gross: 0,
    discounts: 0,
    returns: 0,
    cancelled: 0,
    aov: 0,
    previous: { net: 0, orders: 0, units: 0, aov: 0 },
  }))
  const byKey = new Map(series.map((s) => [s.key, s]))
  const byPreviousKey = new Map(series.map((s) => [s.previousKey, s]))
  for (const o of inPeriod) {
    const row = byKey.get(now.keyOf(o.at))
    if (!row) continue
    if (o.cancelled) {
      row.cancelled += 1
      continue
    }
    row.net += netOf(o)
    row.gross += o.gross
    row.discounts += o.discount
    row.returns += o.returned
    row.orders += 1
  }
  for (const l of lines) {
    const row = byKey.get(now.keyOf(l.at))
    if (row) row.units += l.units
  }
  for (const o of soldBefore) {
    const row = byPreviousKey.get(prev.keyOf(o.at))
    if (!row) continue
    row.previous.net += netOf(o)
    row.previous.orders += 1
  }
  for (const l of linesBefore) {
    const row = byPreviousKey.get(prev.keyOf(l.at))
    if (row) row.previous.units += l.units
  }
  for (const s of series) {
    s.aov = s.orders ? s.net / s.orders : 0
    s.previous.aov = s.previous.orders ? s.previous.net / s.previous.orders : 0
  }
  const chartData = series.map((s) => ({ label: s.label, current: s[metric], previous: s.previous[metric] }))
  const metricText = METRICS.find((m) => m.value === metric)!.label
  const counted = metric === "orders" || metric === "units"
  const formatMetric = (n: number) => (counted ? n0(n) : taka(n))
  const chartConfig = {
    current: { label: "This period", color: "var(--chart-1)" },
    previous: { label: "Period before", color: "var(--chart-2)" },
  } satisfies ChartConfig

  // ── Highlights ─────────────────────────────────
  const days = new Map<string, number>()
  for (const o of sold) {
    const day = new Date(o.at).toDateString()
    days.set(day, (days.get(day) ?? 0) + netOf(o))
  }
  const bestDay = [...days.entries()].sort((a, b) => b[1] - a[1])[0]
  const biggest = [...sold].sort((a, b) => netOf(b) - netOf(a))[0]
  const productRevenue = new Map<string, number>()
  for (const l of lines) productRevenue.set(l.productId, (productRevenue.get(l.productId) ?? 0) + l.revenue)
  const topProductEntry = [...productRevenue.entries()].sort((a, b) => b[1] - a[1])[0]
  const topProduct = topProductEntry ? data.products.find((p) => p.id === topProductEntry[0]) : undefined
  const spend = new Map<string, { name: string; value: number; orders: number }>()
  for (const o of sold) {
    const c = spend.get(o.customer) ?? { name: o.customerName, value: 0, orders: 0 }
    c.value += netOf(o)
    c.orders += 1
    spend.set(o.customer, c)
  }
  const topCustomer = [...spend.values()].sort((a, b) => b.value - a.value)[0]

  // ── When people order: weekday × hour ────────────────
  const heat = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0))
  for (const o of sold) {
    const d = new Date(o.at)
    heat[(d.getDay() + 6) % 7][d.getHours()] += 1
  }
  const heatMax = Math.max(1, ...heat.flat())
  const weekdayTotals = heat.map((row) => row.reduce((s, v) => s + v, 0))
  const busiestDay = weekdayTotals.indexOf(Math.max(...weekdayTotals))
  const hourTotals = Array.from({ length: 24 }, (_, h) => heat.reduce((s, row) => s + row[h], 0))
  const busiestHour = hourTotals.indexOf(Math.max(...hourTotals))
  const hourText = (h: number) => `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? "am" : "pm"}`
  const heatColor = (share: number) => `color-mix(in oklab, var(--chart-1) ${Math.round(20 + share * 80)}%, transparent)`

  // ── Breakdowns ─────────────────────────────────
  const group = (pick: (o: O) => string | null) => {
    const map = new Map<string, { value: number; orders: number }>()
    for (const o of sold) {
      const key = pick(o) ?? "Unknown"
      const row = map.get(key) ?? { value: 0, orders: 0 }
      row.value += netOf(o)
      row.orders += 1
      map.set(key, row)
    }
    return [...map.entries()].sort((a, b) => b[1].value - a[1].value)
  }
  const districts = group((o) => o.city).slice(0, 6)
  const providers = group((o) => PROVIDER_LABEL[o.provider as keyof typeof PROVIDER_LABEL] ?? o.provider)
  const productCategory = new Map(data.products.map((p) => [p.id, p.category ?? "No category"]))
  const byCategory = new Map<string, number>()
  for (const l of lines) {
    const c = productCategory.get(l.productId) ?? "No category"
    byCategory.set(c, (byCategory.get(c) ?? 0) + l.revenue)
  }
  const categories = [...byCategory.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
  const promoUse = new Map<string, { orders: number; discount: number; value: number }>()
  for (const o of sold) {
    for (const name of o.promotions) {
      const row = promoUse.get(name) ?? { orders: 0, discount: 0, value: 0 }
      row.orders += 1
      // An order with two promotions splits its discount evenly between them.
      row.discount += o.discount / o.promotions.length
      row.value += netOf(o)
      promoUse.set(name, row)
    }
  }
  const promos = [...promoUse.entries()].sort((a, b) => b[1].discount - a[1].discount).slice(0, 5)
  const codNet = sum(sold.filter((o) => o.cod), netOf)
  const codFinished = inPeriod.filter((o) => o.cod && ["DELIVERED", "COMPLETED", "RETURNED", "PARTIALLY_RETURNED", "FAILED"].includes(o.status))
  const codDelivered = codFinished.filter((o) => o.status === "DELIVERED" || o.status === "COMPLETED")

  const outcomes = [
    { label: "Delivered", match: ["DELIVERED", "COMPLETED"], tone: "bg-emerald-500" },
    { label: "In progress", match: ["PENDING", "CONFIRMED", "PROCESSING", "READY_TO_SHIP", "SHIPPED"], tone: "bg-chart-1" },
    { label: "Returned", match: ["RETURNED", "PARTIALLY_RETURNED", "REFUNDED"], tone: "bg-amber-500" },
    { label: "Cancelled", match: ["CANCELLED", "FAILED"], tone: "bg-red-500" },
  ].map((o) => ({ ...o, count: inPeriod.filter((x) => o.match.includes(x.status)).length }))

  function downloadCsv() {
    const header = ["Period", "Orders", "Units", "Gross sales", "Discounts", "Returns", "Net sales", "Average order"]
    const rows = series.map((s) => [`"${s.label}"`, s.orders, s.units, s.gross.toFixed(2), s.discounts.toFixed(2), s.returns.toFixed(2), s.net.toFixed(2), s.aov.toFixed(2)])
    const csv = [header.join(","), ...rows.map((r) => r.join(","))].join("\n")
    const link = document.createElement("a")
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }))
    link.download = `sales-${period}-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  const bestBucket = Math.max(1, ...series.map((s) => s.net))
  const fromDate = new Date(start).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
  let headline = { value: taka(net), delta: change(net, netBefore) }
  if (metric === "orders") headline = { value: n0(sold.length), delta: change(sold.length, soldBefore.length) }
  if (metric === "units") headline = { value: n0(units), delta: change(units, unitsBefore) }
  if (metric === "aov") headline = { value: taka(aov), delta: change(aov, aovBefore) }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 lg:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <PeriodPicker value={period} onChange={setPeriod} />
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarIcon className="size-3.5" />
            {fromDate} – today · compared with the {period === "all" ? "same length" : periodLabel} before
          </span>
        </div>
        <Button size="sm" variant="outline" onClick={downloadCsv}>
          <DownloadIcon />
          Download CSV
        </Button>
      </div>

      <section className="grid grid-cols-2 gap-3 px-4 md:grid-cols-3 lg:px-6 xl:grid-cols-6">
        <SparkStat icon={ReceiptIcon} label="Net sales" value={short(net)} delta={change(net, netBefore)} spark={series.map((s) => s.net)} hint={taka(net)} />
        <SparkStat icon={PackageIcon} label="Orders" value={n0(sold.length)} delta={change(sold.length, soldBefore.length)} spark={series.map((s) => s.orders)} />
        <SparkStat icon={BanknoteIcon} label="Average order" value={short(aov)} delta={change(aov, aovBefore)} spark={series.map((s) => s.aov)} />
        <SparkStat icon={TagIcon} label="Units sold" value={n0(units)} delta={change(units, unitsBefore)} spark={series.map((s) => s.units)} />
        <SparkStat
          icon={UserPlusIcon}
          label="Customers"
          value={n0(customers.size)}
          delta={change(customers.size, customersBefore.size)}
          spark={series.map((s) => s.orders)}
          hint={`${n0(new Set(newCustomers.map((o) => o.customer)).size)} new · ${n0(new Set(repeatOrders.map((o) => o.customer)).size)} returning`}
        />
        <SparkStat
          icon={TruckIcon}
          label="Cancelled"
          value={`${cancelRate}%`}
          delta={change(cancelRate, cancelRateBefore)}
          invert
          spark={series.map((s) => s.cancelled)}
          hint={`${n0(inPeriod.length - sold.length)} of ${n0(inPeriod.length)} orders`}
        />
      </section>

      <div className="grid items-start gap-4 px-4 md:gap-6 lg:px-6 xl:grid-cols-3">
        <section className="overflow-hidden rounded-2xl border bg-card xl:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3 px-4 pt-4">
            <div>
              <div className="text-sm text-muted-foreground">{metricText}</div>
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-3xl font-bold tracking-tight tabular-nums">{headline.value}</span>
                <Change value={headline.delta} />
              </div>
              <div className="text-xs text-muted-foreground">
                by {now.size}
                {metric === "net" && ", after discounts and returns"}
              </div>
            </div>
            <ToggleGroup multiple={false} value={[metric]} onValueChange={(v) => v[0] && setMetric(v[0] as Metric)} variant="outline" size="sm" spacing={0} aria-label="Chart metric">
              {METRICS.map((m) => (
                <ToggleGroupItem key={m.value} value={m.value} className="px-2.5 text-xs data-pressed:bg-muted data-pressed:font-semibold">
                  {m.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
          <div className="px-2 pt-2 pb-3 sm:px-4">
            <ChartContainer config={chartConfig} className="aspect-auto h-[300px] w-full">
              <AreaChart data={chartData} margin={{ left: 4, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="fill-current" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-current)" stopOpacity={0.18} />
                    <stop offset="100%" stopColor="var(--color-current)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} />
                <YAxis tickLine={false} axisLine={false} width={56} allowDecimals={false} tickFormatter={(v: number) => (counted ? n0(v) : short(v))} />
                <ChartTooltip
                  cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
                  content={
                    <ChartTooltipContent
                      indicator="line"
                      formatter={(value, name) => (
                        <span className="flex w-full justify-between gap-4">
                          <span className="text-muted-foreground">{chartConfig[name as keyof typeof chartConfig]?.label}</span>
                          <span className="font-medium tabular-nums">{formatMetric(Number(value))}</span>
                        </span>
                      )}
                    />
                  }
                />
                <ChartLegend content={<ChartLegendContent />} />
                <Area dataKey="previous" type="monotone" fill="none" stroke="var(--color-previous)" strokeWidth={2} strokeDasharray="4 4" />
                <Area dataKey="current" type="monotone" fill="url(#fill-current)" stroke="var(--color-current)" strokeWidth={2} />
              </AreaChart>
            </ChartContainer>
          </div>
        </section>

        <Card title="Highlights" action={<SparklesIcon className="size-4 text-amber-500" />}>
          <ul className="flex flex-col">
            <Highlight
              icon={TrophyIcon}
              tone="amber"
              label="Best day"
              value={bestDay ? short(bestDay[1]) : "—"}
              detail={bestDay ? new Date(bestDay[0]).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" }) : "No sales yet"}
            />
            <Highlight
              icon={ReceiptIcon}
              tone="blue"
              label="Biggest order"
              value={biggest ? short(netOf(biggest)) : "—"}
              detail={biggest ? `${biggest.number} · ${biggest.customerName}` : "No sales yet"}
              href={biggest ? `/orders/${biggest.id}` : undefined}
            />
            <Highlight
              icon={PackageIcon}
              tone="green"
              label="Top product"
              value={topProductEntry ? short(topProductEntry[1]) : "—"}
              detail={topProduct?.name ?? "No sales yet"}
              image={topProduct?.image}
              href={topProduct ? `/products/${topProduct.id}` : undefined}
            />
            <Highlight
              icon={CrownIcon}
              tone="violet"
              label="Top customer"
              value={topCustomer ? short(topCustomer.value) : "—"}
              detail={topCustomer ? `${topCustomer.name} · ${n0(topCustomer.orders)} ${topCustomer.orders === 1 ? "order" : "orders"}` : "No sales yet"}
            />
            <Highlight
              icon={CalendarIcon}
              tone="grey"
              label="Busiest time"
              value={sold.length ? WEEKDAY_NAMES[busiestDay] : "—"}
              detail={sold.length ? `Most orders around ${hourText(busiestHour)}` : "No sales yet"}
            />
          </ul>
        </Card>
      </div>

      <div className="grid items-start gap-4 px-4 md:gap-6 lg:px-6 xl:grid-cols-3">
        <Card title="From gross to net" className="xl:col-span-2" action={<span className="text-xs text-muted-foreground">where every taka went</span>}>
          <div className="flex flex-col gap-2.5 px-4 pb-4">
            {[
              { label: "Gross sales", value: gross, offset: 0, tone: "bg-chart-1", sign: "" },
              { label: "Discounts", value: discounts, offset: gross - discounts, tone: "bg-amber-400", sign: "−" },
              { label: "Returns", value: returns, offset: gross - discounts - returns, tone: "bg-red-400", sign: "−" },
              { label: "Net sales", value: net, offset: 0, tone: "bg-emerald-500", sign: "" },
            ].map((step) => (
              <div key={step.label} className="grid grid-cols-[6.5rem_1fr_8.5rem] items-center gap-3 text-sm">
                <span className={cn("text-muted-foreground", step.label === "Net sales" && "font-semibold text-foreground")}>{step.label}</span>
                {/* Waterfall: each deduction hangs from where the running total ends. */}
                <span className="relative h-6 rounded-md bg-muted/50">
                  <span
                    className={cn("absolute inset-y-0 rounded-md", step.tone)}
                    style={{ left: `${gross ? (step.offset / gross) * 100 : 0}%`, width: `${gross ? Math.max((step.value / gross) * 100, step.value > 0 ? 0.6 : 0) : 0}%` }}
                  />
                </span>
                <span className={cn("text-right tabular-nums", step.label === "Net sales" ? "font-semibold" : "font-medium")}>
                  {step.sign}
                  {taka(step.value)}
                  <span className="ml-1 text-[11px] font-normal text-muted-foreground">{pct(step.value, gross)}%</span>
                </span>
              </div>
            ))}
            <div className="mt-1 grid gap-4 border-t pt-3 text-sm sm:grid-cols-3">
              <div>
                <div className="text-xs text-muted-foreground">Delivery charged on top</div>
                <div className="font-semibold tabular-nums">{taka(delivery)}</div>
                <div className="text-[11px] text-muted-foreground">not part of net sales</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Gross profit</div>
                <div className="font-semibold tabular-nums">
                  {costedRevenue > 0 ? taka(costedRevenue - cost) : "—"}
                  {costedRevenue > 0 && <span className="ml-1 text-xs font-normal text-muted-foreground">{pct(costedRevenue - cost, costedRevenue)}% margin</span>}
                </div>
                <div className="text-[11px] text-muted-foreground">unit cost known for {pct(costedRevenue, revenueAll)}% of sales</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">How orders ended up</div>
                <div className="mt-1.5 flex h-2 overflow-hidden rounded-full bg-muted">
                  {outcomes.map((o) => (
                    <span key={o.label} className={o.tone} style={{ width: `${pct(o.count, inPeriod.length)}%` }} title={`${o.label}: ${o.count}`} />
                  ))}
                </div>
                <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5">
                  {outcomes.map((o) => (
                    <span key={o.label} className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <span className={cn("size-1.5 shrink-0 rounded-full", o.tone)} />
                      {o.label}
                      <span className="ml-auto font-medium text-foreground tabular-nums">{n0(o.count)}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Card>

        <Card title="Customers" action={<UserPlusIcon className="size-4 text-muted-foreground" />}>
          <div className="flex flex-col gap-3 px-4 pb-4 text-sm">
            <div className="flex h-3 gap-0.5 overflow-hidden rounded-full bg-muted">
              <span className="bg-chart-1" style={{ width: `${pct(sum(newCustomers, netOf), net)}%` }} />
              <span className="bg-chart-2" style={{ width: `${pct(sum(repeatOrders, netOf), net)}%` }} />
            </div>
            {[
              { label: "New customers", tone: "bg-chart-1", list: newCustomers },
              { label: "Returning customers", tone: "bg-chart-2", list: repeatOrders },
            ].map((row) => (
              <div key={row.label} className="flex items-center gap-2">
                <span className={cn("size-2.5 rounded-sm", row.tone)} />
                <span className="flex-1">{row.label}</span>
                <span className="text-right tabular-nums">
                  <span className="font-semibold">{taka(sum(row.list, netOf))}</span>
                  <span className="block text-[11px] text-muted-foreground">
                    {n0(row.list.length)} {row.list.length === 1 ? "order" : "orders"} · {pct(sum(row.list, netOf), net)}%
                  </span>
                </span>
              </div>
            ))}
            <div className="grid grid-cols-2 gap-x-3 gap-y-3 border-t pt-3">
              <div>
                <div className="text-xs text-muted-foreground">Orders per customer</div>
                <div className="font-semibold tabular-nums">{customers.size ? (sold.length / customers.size).toFixed(1) : "—"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Placed → delivered</div>
                <div className="font-semibold tabular-nums">{avgDelivery === null ? "—" : `${avgDelivery.toFixed(1)} days`}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Paid on delivery</div>
                <div className="font-semibold tabular-nums">
                  {pct(codNet, net)}%<span className="ml-1 text-[11px] font-normal text-muted-foreground">of sales</span>
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">COD delivered</div>
                <div className="font-semibold tabular-nums">
                  {codFinished.length ? `${pct(codDelivered.length, codFinished.length)}%` : "—"}
                  <span className="ml-1 text-[11px] font-normal text-muted-foreground">of finished</span>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid items-start gap-4 px-4 md:gap-6 lg:px-6 xl:grid-cols-3">
        <Card title="When customers order" className="xl:col-span-2" action={<span className="text-xs text-muted-foreground">orders by weekday and hour</span>}>
          <div className="overflow-x-auto px-4 pb-4">
            {/* minmax(0, 1fr) keeps the hour labels from widening their column. */}
            <div className="grid min-w-[560px] grid-cols-[2.25rem_repeat(24,minmax(0,1fr))] gap-[3px] text-[10px] text-muted-foreground">
              <span />
              {Array.from({ length: 24 }, (_, h) => (
                <span key={h} className="overflow-visible text-left whitespace-nowrap">
                  {h % 3 === 0 ? hourText(h) : ""}
                </span>
              ))}
              {heat.map((row, d) => (
                <div key={d} className="contents">
                  <span className="self-center">{WEEKDAYS[d]}</span>
                  {row.map((count, h) => (
                    <span
                      key={h}
                      title={`${WEEKDAYS[d]} ${hourText(h)}: ${count} ${count === 1 ? "order" : "orders"}`}
                      className="aspect-square rounded-[3px] border border-border/40"
                      style={{ background: count ? heatColor(count / heatMax) : undefined }}
                    />
                  ))}
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-end gap-1.5 text-[10px] text-muted-foreground">
              Fewer
              {[0, 0.25, 0.5, 0.75, 1].map((step) => (
                <span key={step} className="size-3 rounded-[3px] border border-border/40" style={{ background: step ? heatColor(step) : undefined }} />
              ))}
              More
            </div>
          </div>
        </Card>

        <Card title="Orders by weekday" action={<span className="text-xs text-muted-foreground">busiest: {sold.length ? WEEKDAYS[busiestDay] : "—"}</span>}>
          <div className="px-2 pb-4 sm:px-4">
            <ChartContainer config={ordersConfig} className="aspect-auto h-[220px] w-full">
              <BarChart data={WEEKDAYS.map((d, i) => ({ day: d, orders: weekdayTotals[i] }))} margin={{ left: 0, right: 4, top: 8 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis tickLine={false} axisLine={false} width={24} allowDecimals={false} />
                <ChartTooltip cursor={{ fill: "var(--muted)" }} content={<ChartTooltipContent hideIndicator />} />
                <Bar dataKey="orders" fill="var(--color-orders)" radius={[4, 4, 0, 0]} maxBarSize={24} />
              </BarChart>
            </ChartContainer>
          </div>
        </Card>
      </div>

      <div className="grid items-start gap-4 px-4 md:grid-cols-2 md:gap-6 lg:px-6 xl:grid-cols-4">
        <Card title="Top districts" action={<MapPinIcon className="size-4 text-muted-foreground" />}>
          <ShareBars rows={districts.map(([label, row]) => ({ label, value: row.value, note: `${n0(row.orders)} orders` }))} total={districts[0]?.[1].value ?? 0} format={short} />
        </Card>
        <Card title="Categories">
          <ShareBars rows={categories.map(([label, value]) => ({ label, value, note: `${pct(value, revenueAll)}%` }))} total={categories[0]?.[1] ?? 0} format={short} />
        </Card>
        <Card title="Payment methods">
          <ShareBars rows={providers.map(([label, row]) => ({ label, value: row.value, note: `${n0(row.orders)} orders` }))} total={providers[0]?.[1].value ?? 0} format={short} />
        </Card>
        <Card title="Promotions used" action={<TagIcon className="size-4 text-muted-foreground" />}>
          {promos.length === 0 ? (
            <p className="px-4 pb-4 text-sm text-muted-foreground">No promotions in this period.</p>
          ) : (
            <ul className="flex flex-col">
              {promos.map(([name, row]) => (
                <li key={name} className="flex items-center gap-2 border-t border-border/60 px-4 py-2.5 text-sm">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{name}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {n0(row.orders)} {row.orders === 1 ? "order" : "orders"} · {short(row.value)} sold
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-sm font-semibold tabular-nums">−{short(row.discount)}</span>
                    <span className="text-[11px] text-muted-foreground">given</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title={`Sales by ${now.size}`} className="mx-4 lg:mx-6" action={<span className="text-xs text-muted-foreground">newest first</span>}>
        <div className="max-h-[440px] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-muted text-left text-xs text-muted-foreground">
              <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:font-medium [&>th:first-child]:pl-4 [&>th:last-child]:pr-4">
                <th>{{ day: "Day", week: "Week of", month: "Month" }[now.size]}</th>
                <th className="text-right">Orders</th>
                <th className="text-right">Units</th>
                <th className="hidden text-right sm:table-cell">Gross</th>
                <th className="hidden text-right md:table-cell">Discounts</th>
                <th className="hidden text-right md:table-cell">Returns</th>
                <th className="text-right">Net sales</th>
                <th className="hidden w-40 lg:table-cell">
                  <span className="sr-only">Share of the best {now.size}</span>
                </th>
                <th className="hidden text-right lg:table-cell">Average order</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {[...series].reverse().map((s) => (
                <tr
                  key={s.key}
                  className={cn("border-t border-border/60 hover:bg-muted/30 [&>td]:px-3 [&>td]:py-2 [&>td:first-child]:pl-4 [&>td:last-child]:pr-4", s.orders === 0 && "text-muted-foreground")}
                >
                  <td>{s.label}</td>
                  <td className="text-right">{n0(s.orders)}</td>
                  <td className="text-right">{n0(s.units)}</td>
                  <td className="hidden text-right sm:table-cell">{s.gross ? taka(s.gross) : "—"}</td>
                  <td className="hidden text-right md:table-cell">{s.discounts > 0 ? `−${taka(s.discounts)}` : "—"}</td>
                  <td className="hidden text-right md:table-cell">{s.returns > 0 ? `−${taka(s.returns)}` : "—"}</td>
                  <td className="text-right font-medium">{s.net ? taka(s.net) : "—"}</td>
                  <td className="hidden lg:table-cell">
                    <span className="block h-1.5 overflow-hidden rounded-full bg-muted">
                      <span className="block h-full rounded-full bg-chart-1" style={{ width: `${(Math.max(0, s.net) / bestBucket) * 100}%` }} />
                    </span>
                  </td>
                  <td className="hidden text-right lg:table-cell">{s.orders ? taka(s.aov) : "—"}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="sticky bottom-0 border-t bg-muted font-semibold tabular-nums">
              <tr className="[&>td]:px-3 [&>td]:py-2 [&>td:first-child]:pl-4 [&>td:last-child]:pr-4">
                <td>Total</td>
                <td className="text-right">{n0(sold.length)}</td>
                <td className="text-right">{n0(units)}</td>
                <td className="hidden text-right sm:table-cell">{taka(gross)}</td>
                <td className="hidden text-right md:table-cell">−{taka(discounts)}</td>
                <td className="hidden text-right md:table-cell">−{taka(returns)}</td>
                <td className="text-right">{taka(net)}</td>
                <td className="hidden lg:table-cell" />
                <td className="hidden text-right lg:table-cell">{taka(aov)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
      <p className="px-4 text-xs text-muted-foreground lg:px-6">
        Counts every order except cancelled and failed ones, by the time it was placed. Net sales = list price − discounts − returns; delivery is shown apart. A
        customer is one phone number (or email). Gross profit uses each variant&apos;s average unit cost, only where one is recorded.
      </p>
    </>
  )
}

const HIGHLIGHT_TONE = {
  amber: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:ring-amber-900",
  blue: "bg-primary/10 text-primary ring-primary/20",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-900",
  violet: "bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-950 dark:text-violet-300 dark:ring-violet-900",
  grey: "bg-muted text-muted-foreground ring-border",
}

function Highlight({
  icon: Icon,
  tone,
  label,
  value,
  detail,
  href,
  image,
}: {
  icon: typeof TrophyIcon
  tone: keyof typeof HIGHLIGHT_TONE
  label: string
  value: string
  detail: string
  href?: string
  image?: string
}) {
  const body = (
    <>
      <span className={cn("grid size-9 shrink-0 place-items-center overflow-hidden rounded-xl ring-1", HIGHLIGHT_TONE[tone])}>
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element -- any image host is allowed
          <img src={image} alt="" className="size-full object-cover" />
        ) : (
          <Icon className="size-4" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] text-muted-foreground">{label}</span>
        <span className="block truncate text-sm font-medium">{detail}</span>
      </span>
      <span className="shrink-0 text-sm font-semibold tabular-nums">{value}</span>
    </>
  )
  const className = "flex items-center gap-3 border-t border-border/60 px-4 py-3"
  return (
    <li>
      {href ? (
        <Link href={href} className={cn(className, "hover:bg-muted/40")}>
          {body}
        </Link>
      ) : (
        <div className={className}>{body}</div>
      )}
    </li>
  )
}
