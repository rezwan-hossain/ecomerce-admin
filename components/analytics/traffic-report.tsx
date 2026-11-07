"use client"

import Link from "next/link"
import { useState } from "react"
import {
  CalendarIcon,
  ClockIcon,
  EyeIcon,
  FileTextIcon,
  LaptopIcon,
  LogOutIcon,
  MapPinIcon,
  MonitorSmartphoneIcon,
  MousePointerClickIcon,
  PackageIcon,
  MegaphoneIcon,
  RadioIcon,
  SearchIcon,
  ShoppingCartIcon,
  SmartphoneIcon,
  TabletIcon,
  UsersIcon,
} from "lucide-react"
import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

import { buckets, change, periodRange, type Period, within } from "@/components/analytics/analytics-utils"
import { Change, PeriodPicker, ShareBars } from "@/components/analytics/sales-report"
import { Card, DemoNote, n0 } from "@/components/inventory/inventory-ui"
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { cn } from "@/lib/utils"
import { BROWSERS, CAMPAIGNS, DEPTHS, DEVICES, DISTRICTS, PAGES, SEARCHES, SOURCES, TIMES, type TrafficDay } from "@/lib/traffic-demo"

const pct = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : 0)
const pct0 = (part: number, whole: number) => Math.round(pct(part, whole))
// "12.4k" visits, "1.2L" for lakhs.
function compact(n: number) {
  if (n >= 100_000) return `${(n / 100_000).toFixed(1)}L`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return n0(n)
}
const duration = (seconds: number) => `${Math.floor(seconds / 60)}m ${String(Math.round(seconds % 60)).padStart(2, "0")}s`
const hourText = (h: number) => `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? "am" : "pm"}`
const DEVICE_ICON = [SmartphoneIcon, LaptopIcon, TabletIcon]
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
const taka0 = (n: number) => `৳${n0(Math.round(n))}`
const DEVICE_TONE = ["bg-chart-1", "bg-chart-2", "bg-chart-3"]

const METRICS = [
  { value: "visitors", label: "Visitors" },
  { value: "sessions", label: "Sessions" },
  { value: "pageViews", label: "Page views" },
  { value: "orders", label: "Orders" },
] as const
type Metric = (typeof METRICS)[number]["value"]

type Totals = Omit<TrafficDay, "at">

// Add up a list of days, arrays position by position.
function total(days: TrafficDay[]): Totals {
  const sum = (pick: (d: TrafficDay) => number) => days.reduce((s, d) => s + pick(d), 0)
  const sumAll = (pick: (d: TrafficDay) => number[], size: number) => Array.from({ length: size }, (_, k) => days.reduce((s, d) => s + pick(d)[k], 0))
  return {
    visitors: sum((d) => d.visitors),
    newVisitors: sum((d) => d.newVisitors),
    sessions: sum((d) => d.sessions),
    pageViews: sum((d) => d.pageViews),
    bounces: sum((d) => d.bounces),
    seconds: sum((d) => d.seconds),
    productViews: sum((d) => d.productViews),
    carts: sum((d) => d.carts),
    checkouts: sum((d) => d.checkouts),
    orders: sum((d) => d.orders),
    revenue: sum((d) => d.revenue),
    sources: sumAll((d) => d.sources, SOURCES.length),
    sourceOrders: sumAll((d) => d.sourceOrders, SOURCES.length),
    devices: sumAll((d) => d.devices, DEVICES.length),
    districts: sumAll((d) => d.districts, DISTRICTS.length),
    pages: sumAll((d) => d.pages, PAGES.length),
    hours: sumAll((d) => d.hours, 24),
    newOrders: sum((d) => d.newOrders),
    deviceOrders: sumAll((d) => d.deviceOrders, DEVICES.length),
    exits: sumAll((d) => d.exits, PAGES.length),
    browsers: sumAll((d) => d.browsers, BROWSERS.length),
    searches: sumAll((d) => d.searches, SEARCHES.length),
    campaignSessions: sumAll((d) => d.campaignSessions, CAMPAIGNS.length),
    campaignOrders: sumAll((d) => d.campaignOrders, CAMPAIGNS.length),
    depth: sumAll((d) => d.depth, DEPTHS.length),
    time: sumAll((d) => d.time, TIMES.length),
  }
}

function Kpi({
  icon: Icon,
  label,
  value,
  delta,
  invert,
  hint,
  spark,
}: {
  icon: typeof EyeIcon
  label: string
  value: string
  delta: number | null
  invert?: boolean
  hint: string
  spark: number[]
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
      <Change value={delta} invert={invert} />
      <ChartContainer config={{ v: { label, color: "var(--chart-1)" } }} className="mt-1 aspect-auto h-9 w-full">
        <AreaChart data={spark.map((v, i) => ({ i, v }))} margin={{ top: 2, bottom: 2, left: 0, right: 0 }}>
          <Area dataKey="v" type="monotone" stroke="var(--color-v)" strokeWidth={2} fill="var(--color-v)" fillOpacity={0.1} isAnimationActive={false} dot={false} />
        </AreaChart>
      </ChartContainer>
      <span className="text-[11px] text-muted-foreground">{hint}</span>
    </div>
  )
}

// A small heading that groups the cards below it.
function Section({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex items-baseline gap-2 px-4 pt-2 lg:px-6">
      <h2 className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">{title}</h2>
      <span className="text-xs text-muted-foreground/80">· {hint}</span>
    </div>
  )
}

// One colour dot per traffic source, in the chart palette order.
const SOURCE_TONE = ["bg-chart-1", "bg-chart-2", "bg-chart-3", "bg-chart-4", "bg-chart-5", "bg-muted-foreground/60", "bg-muted-foreground/30"]

export function TrafficReport({ days, products }: { days: TrafficDay[]; products: { id: string; name: string; image?: string; category: string | null }[] }) {
  const [period, setPeriod] = useState<Period>("30d")
  const [metric, setMetric] = useState<Metric>("visitors")
  const [timing, setTiming] = useState<"hour" | "weekday">("hour")
  const range = periodRange(period, days[0]?.at)
  // Demo days are stored at midnight, so start the window at midnight too or the first day drops out.
  const startDay = new Date(range.start)
  startDay.setHours(0, 0, 0, 0)
  const start = startDay.getTime()
  const end = range.end
  // Whole days back, so the earlier window starts at midnight as well.
  const previousStart = start - Math.ceil((end - start) / 86_400_000) * 86_400_000
  const now = total(days.filter((d) => within(d.at, start, end)))
  const before = total(days.filter((d) => within(d.at, previousStart, start)))

  const conversion = pct(now.orders, now.sessions)
  const conversionBefore = pct(before.orders, before.sessions)
  const bounce = pct(now.bounces, now.sessions)
  const avgTime = now.sessions ? now.seconds / now.sessions : 0
  const avgTimeBefore = before.sessions ? before.seconds / before.sessions : 0

  // The chart: the period in buckets, the one before matched by position.
  const current = buckets(start, end)
  const previous = buckets(previousStart, start)
  const series = current.list.map((b) => ({ label: b.label, key: b.key, current: 0, previous: 0 }))
  const byKey = new Map(series.map((s) => [s.key, s]))
  const byPreviousKey = new Map(previous.list.map((b, index) => [b.key, series[index]]))
  for (const d of days) {
    if (within(d.at, start, end)) {
      const row = byKey.get(current.keyOf(d.at))
      if (row) row.current += d[metric]
    } else if (within(d.at, previousStart, start)) {
      const row = byPreviousKey.get(previous.keyOf(d.at))
      if (row) row.previous += d[metric]
    }
  }
  // Per-bucket sums for the KPI sparklines.
  const spark = (pick: (d: TrafficDay) => number, per?: (d: TrafficDay) => number) =>
    current.list.map((b) => {
      const inBucket = days.filter((d) => within(d.at, start, end) && current.keyOf(d.at) === b.key)
      const top = inBucket.reduce((s, d) => s + pick(d), 0)
      if (!per) return top
      const bottom = inBucket.reduce((s, d) => s + per(d), 0)
      return bottom ? top / bottom : 0
    })
  const chartConfig = {
    current: { label: "This period", color: "var(--chart-1)" },
    previous: { label: "Period before", color: "var(--chart-2)" },
  } satisfies ChartConfig
  const metricTotal = now[metric]

  const funnel = [
    { label: "Visited the store", value: now.sessions, icon: UsersIcon },
    { label: "Viewed a product", value: now.productViews, icon: EyeIcon },
    { label: "Added to cart", value: now.carts, icon: ShoppingCartIcon },
    { label: "Reached checkout", value: now.checkouts, icon: MousePointerClickIcon },
    { label: "Placed an order", value: now.orders, icon: PackageIcon },
  ]
  const sources = SOURCES.map((name, k) => ({ name, sessions: now.sources[k], orders: now.sourceOrders[k], before: before.sources[k] })).sort((a, b) => b.sessions - a.sessions)
  const peakHour = now.hours.indexOf(Math.max(...now.hours))
  // Demo product views: a fixed share per product so the same products lead every time.
  const weight = (id: string) => [...id].reduce((s, c) => (s * 31 + c.charCodeAt(0)) % 997, 7) + 50
  const weightSum = products.reduce((s, p) => s + weight(p.id), 0)
  const viewed = products
    .map((p) => ({ ...p, views: Math.round((weight(p.id) / (weightSum || 1)) * now.productViews) }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 6)
  const live = Math.max(3, Math.round((days.at(-1)?.visitors ?? 0) / 40))
  const returning = now.visitors - now.newVisitors
  const searchTotal = now.searches.reduce((s, v) => s + v, 0)
  const unfound = SEARCHES.reduce((s, t, k) => (t.found ? s : s + now.searches[k]), 0)
  const weekdays = WEEKDAYS.map((label, k) => ({
    label,
    sessions: days.filter((d) => within(d.at, start, end) && (new Date(d.at).getDay() + 6) % 7 === k).reduce((sum, d) => sum + d.sessions, 0),
  }))
  const busiestWeekday = weekdays.reduce((best, w) => (w.sessions > best.sessions ? w : best), weekdays[0])
  const avgOrder = now.orders ? now.revenue / now.orders : 0

  return (
    <>
      <DemoNote what="store traffic" live="The storefront doesn't record visits yet; product names and pictures are real." />

      <div className="flex flex-wrap items-center justify-between gap-3 px-4 lg:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <PeriodPicker value={period} onChange={setPeriod} />
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarIcon className="size-3.5" />
            {new Date(start).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} – today · compared with the same length before
          </span>
        </div>
        <span className="flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
          </span>
          <RadioIcon className="size-3.5 text-muted-foreground" />
          <span className="font-semibold tabular-nums">{live}</span> people on the store now
        </span>
      </div>

      <section className="grid grid-cols-2 gap-3 px-4 md:grid-cols-3 lg:px-6 xl:grid-cols-6">
        <Kpi icon={UsersIcon} label="Visitors" value={compact(now.visitors)} delta={change(now.visitors, before.visitors)} hint={`${pct0(now.newVisitors, now.visitors)}% new`} spark={spark((d) => d.visitors)} />
        <Kpi icon={MonitorSmartphoneIcon} label="Sessions" value={compact(now.sessions)} delta={change(now.sessions, before.sessions)} hint={`${(now.sessions / (now.visitors || 1)).toFixed(2)} per visitor`} spark={spark((d) => d.sessions)} />
        <Kpi icon={FileTextIcon} label="Page views" value={compact(now.pageViews)} delta={change(now.pageViews, before.pageViews)} hint={`${(now.pageViews / (now.sessions || 1)).toFixed(1)} per session`} spark={spark((d) => d.pageViews)} />
        <Kpi icon={ClockIcon} label="Time on site" value={duration(avgTime)} delta={change(avgTime, avgTimeBefore)} hint="average per session" spark={spark((d) => d.seconds, (d) => d.sessions)} />
        <Kpi icon={LogOutIcon} label="Bounce rate" value={`${bounce.toFixed(0)}%`} delta={change(bounce, pct(before.bounces, before.sessions))} invert hint="left after one page" spark={spark((d) => d.bounces, (d) => d.sessions)} />
        <Kpi icon={ShoppingCartIcon} label="Conversion" value={`${conversion.toFixed(2)}%`} delta={change(conversion, conversionBefore)} hint={`${n0(now.orders)} orders from ${compact(now.sessions)} sessions`} spark={spark((d) => d.orders, (d) => d.sessions)} />
      </section>

      <section className="mx-4 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border bg-border md:grid-cols-3 lg:mx-6 xl:grid-cols-6">
        {[
          { label: "Revenue per visitor", value: taka0(now.revenue / (now.visitors || 1)), hint: `${taka0(now.revenue / (now.sessions || 1))} per session` },
          { label: "Average order", value: taka0(avgOrder), hint: `${compact(now.revenue)} from visits` },
          { label: "Carts abandoned", value: `${pct0(now.carts - now.orders, now.carts)}%`, hint: `${n0(now.carts - now.orders)} of ${n0(now.carts)} carts`, warn: true },
          { label: "Checkout completed", value: `${pct0(now.orders, now.checkouts)}%`, hint: `${n0(now.checkouts - now.orders)} left at checkout` },
          { label: "Returning visitors", value: `${pct0(returning, now.visitors)}%`, hint: `${compact(returning)} came back` },
          { label: "Used search", value: `${pct0(searchTotal, now.sessions)}%`, hint: `${compact(searchTotal)} searches` },
        ].map((f) => (
          <div key={f.label} className="bg-card px-4 py-3">
            <div className="text-xs text-muted-foreground">{f.label}</div>
            <div className={cn("text-lg font-bold tracking-tight tabular-nums", f.warn && "text-amber-700 dark:text-amber-400")}>{f.value}</div>
            <div className="truncate text-[11px] text-muted-foreground">{f.hint}</div>
          </div>
        ))}
      </section>

      <div className="grid gap-4 px-4 md:gap-6 lg:px-6 xl:grid-cols-3">
        <section className="overflow-hidden rounded-2xl border bg-card xl:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3 px-4 pt-4">
            <div>
              <div className="text-sm text-muted-foreground">{METRICS.find((m) => m.value === metric)!.label}</div>
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-3xl font-bold tracking-tight tabular-nums">{n0(metricTotal)}</span>
                <Change value={change(metricTotal, before[metric])} />
              </div>
              <div className="text-xs text-muted-foreground">by {current.size}</div>
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
            <ChartContainer config={chartConfig} className="aspect-auto h-[280px] w-full">
              <AreaChart data={series} margin={{ left: 4, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="traffic-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-current)" stopOpacity={0.18} />
                    <stop offset="100%" stopColor="var(--color-current)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} />
                <YAxis tickLine={false} axisLine={false} width={44} allowDecimals={false} tickFormatter={(v: number) => compact(v)} />
                <ChartTooltip cursor={{ stroke: "var(--border)", strokeWidth: 1 }} content={<ChartTooltipContent indicator="line" />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Area dataKey="previous" type="monotone" fill="none" stroke="var(--color-previous)" strokeWidth={2} strokeDasharray="4 4" />
                <Area dataKey="current" type="monotone" fill="url(#traffic-fill)" stroke="var(--color-current)" strokeWidth={2} />
              </AreaChart>
            </ChartContainer>
          </div>
        </section>

        <Card title="From visit to order" action={<span className="text-xs text-muted-foreground">{conversion.toFixed(2)}% convert</span>}>
          <ol className="flex flex-col gap-1 px-4 pb-4">
            {funnel.map((step, index) => {
              const next = funnel[index + 1]
              return (
                <li key={step.label} className="flex flex-col">
                  <div className="flex items-center gap-2.5 py-1">
                    <span className="grid size-7 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                      <step.icon className="size-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2 text-sm">
                        <span className="truncate">{step.label}</span>
                        <span className="font-semibold tabular-nums">{n0(step.value)}</span>
                      </div>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-chart-1" style={{ width: `${Math.max(pct(step.value, funnel[0].value), 1)}%` }} />
                      </div>
                    </div>
                  </div>
                  {next && (
                    <span className="ml-9 text-[11px] text-muted-foreground">
                      ↓ {pct0(next.value, step.value)}% go on · <span className="text-red-700 dark:text-red-400">{n0(step.value - next.value)} drop off</span>
                    </span>
                  )}
                </li>
              )
            })}
          </ol>
        </Card>
      </div>

      <Section title="Acquisition" hint="where visits come from and which links bring buyers" />
      <div className="grid gap-4 px-4 md:gap-6 lg:px-6 xl:grid-cols-3">
        <Card title="Where visitors come from" className="flex flex-col xl:col-span-2">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:font-medium [&>th:first-child]:pl-4 [&>th:last-child]:pr-4">
                <th>Source</th>
                <th className="text-right">Sessions</th>
                <th className="hidden w-40 md:table-cell">Share</th>
                <th className="text-right">Orders</th>
                <th className="text-right">Conversion</th>
                <th className="hidden text-right sm:table-cell">Vs previous</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {sources.map((s) => {
                const rate = pct(s.orders, s.sessions)
                return (
                  <tr key={s.name} className="border-t border-border/60 [&>td]:px-3 [&>td]:py-2 [&>td:first-child]:pl-4 [&>td:last-child]:pr-4">
                    <td className="font-medium">
                      <span className="flex items-center gap-2">
                        <span className={cn("size-2.5 shrink-0 rounded-full", SOURCE_TONE[SOURCES.indexOf(s.name)])} />
                        {s.name}
                      </span>
                    </td>
                    <td className="text-right">{n0(s.sessions)}</td>
                    <td className="hidden md:table-cell">
                      <span className="flex items-center gap-2">
                        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                          <span className="block h-full rounded-full bg-chart-1" style={{ width: `${pct(s.sessions, now.sessions)}%` }} />
                        </span>
                        <span className="w-8 text-right text-[11px] text-muted-foreground">{pct0(s.sessions, now.sessions)}%</span>
                      </span>
                    </td>
                    <td className="text-right">{n0(s.orders)}</td>
                    <td className={cn("text-right font-medium", rate >= conversion ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground")}>{rate.toFixed(2)}%</td>
                    <td className="hidden text-right sm:table-cell">
                      <Change value={change(s.sessions, s.before)} bare />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p className="mt-auto border-t px-4 py-2.5 text-[11px] text-muted-foreground">Green conversion beats the store average of {conversion.toFixed(2)}%.</p>
        </Card>
        <Card className="flex flex-col" title="Campaigns" action={<MegaphoneIcon className="size-4 text-muted-foreground" />}>
          <ul className="flex flex-col">
            {CAMPAIGNS.map((name, k) => ({ name, sessions: now.campaignSessions[k], orders: now.campaignOrders[k] }))
              .sort((a, b) => b.orders - a.orders)
              .map((c) => (
                <li key={c.name} className="flex items-center gap-3 border-t border-border/60 px-4 py-2.5 text-sm">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{c.name.split(" · ")[0]}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {c.name.split(" · ")[1]} · {compact(c.sessions)} visits
                    </span>
                  </span>
                  <span className="text-right tabular-nums">
                    <span className="block font-semibold">{n0(c.orders)} orders</span>
                    <span className="text-[11px] text-muted-foreground">{pct(c.orders, c.sessions).toFixed(2)}% convert</span>
                  </span>
                </li>
              ))}
          </ul>
          <p className="mt-auto border-t px-4 py-2.5 text-[11px] text-muted-foreground">From the utm_campaign on the links people clicked.</p>
        </Card>
      </div>

      <Section title="Audience" hint="who visits and on what" />
      <div className="grid gap-4 px-4 md:gap-6 lg:px-6 md:grid-cols-2 xl:grid-cols-4">
        <Card className="flex flex-col" title="New vs returning">
          <div className="flex flex-1 flex-col gap-3 px-4 pb-4 text-sm">
            <div className="flex h-3 gap-0.5 overflow-hidden rounded-full">
              <span className="rounded-full bg-chart-1" style={{ width: `${pct(now.newVisitors, now.visitors)}%` }} />
              <span className="rounded-full bg-chart-2" style={{ width: `${pct(returning, now.visitors)}%` }} />
            </div>
            {[
              { label: "New visitors", tone: "bg-chart-1", visitors: now.newVisitors, orders: now.newOrders },
              { label: "Returning visitors", tone: "bg-chart-2", visitors: returning, orders: now.orders - now.newOrders },
            ].map((row) => (
              <div key={row.label} className="flex items-center gap-2">
                <span className={cn("size-2.5 shrink-0 rounded-sm", row.tone)} />
                <span className="flex-1">
                  {row.label}
                  <span className="block text-[11px] text-muted-foreground">
                    {n0(row.orders)} orders · {pct(row.orders, row.visitors).toFixed(2)}% buy
                  </span>
                </span>
                <span className="text-right tabular-nums">
                  <span className="block font-semibold">{compact(row.visitors)}</span>
                  <span className="text-[11px] text-muted-foreground">{pct0(row.visitors, now.visitors)}%</span>
                </span>
              </div>
            ))}
            <p className="mt-auto border-t pt-2.5 text-[11px] text-muted-foreground">
              A returning visitor is {(pct(now.orders - now.newOrders, returning) / (pct(now.newOrders, now.newVisitors) || 1)).toFixed(1)}× as likely to buy as a new one.
            </p>
          </div>
        </Card>
        <Card className="flex flex-col" title="Devices" action={<MonitorSmartphoneIcon className="size-4 text-muted-foreground" />}>
          <div className="flex flex-1 flex-col gap-3 px-4 pb-4">
            <div className="flex h-3 gap-0.5 overflow-hidden rounded-full">
              {DEVICES.map((d, k) => (
                <span key={d} className={cn("rounded-full", DEVICE_TONE[k])} style={{ width: `${pct(now.devices[k], now.sessions)}%` }} />
              ))}
            </div>
            {DEVICES.map((d, k) => {
              const Icon = DEVICE_ICON[k]
              return (
                <div key={d} className="flex items-center gap-2.5 text-sm">
                  <span className={cn("size-2.5 shrink-0 rounded-sm", DEVICE_TONE[k])} />
                  <Icon className="size-4 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    {d}
                    <span className="block text-[11px] whitespace-nowrap text-muted-foreground">
                      {compact(now.devices[k])} · {pct(now.deviceOrders[k], now.devices[k]).toFixed(2)}% buy
                    </span>
                  </span>
                  <span className="font-semibold tabular-nums">{pct0(now.devices[k], now.sessions)}%</span>
                </div>
              )
            })}
            <p className="mt-auto border-t pt-2.5 text-[11px] text-muted-foreground">
              Most visitors shop on their phone but desktop converts {(pct(now.deviceOrders[1], now.devices[1]) / (pct(now.deviceOrders[0], now.devices[0]) || 1)).toFixed(1)}× better, so check
              the mobile checkout first.
            </p>
          </div>
        </Card>
        <Card className="flex flex-col" title="Browsers">
          <ShareBars
            rows={BROWSERS.map((name, k) => ({ label: name, value: now.browsers[k], note: `${pct0(now.browsers[k], now.sessions)}%` }))}
            total={Math.max(...now.browsers)}
            format={(v) => compact(v)}
          />
        </Card>
        <Card className="flex flex-col" title="Visitors by district" action={<MapPinIcon className="size-4 text-muted-foreground" />}>
          <ShareBars
            rows={DISTRICTS.map((name, k) => ({ label: name, value: now.districts[k], note: `${pct0(now.districts[k], now.visitors)}%` }))
              .sort((a, b) => b.value - a.value)
              .slice(0, 6)}
            total={Math.max(...now.districts)}
            format={(v) => n0(v)}
          />
        </Card>
      </div>

      <Section title="Behaviour" hint="what they look at, search for and leave from" />
      <div className="grid gap-4 px-4 md:gap-6 lg:px-6 xl:grid-cols-3">
        <Card className="flex flex-col" title="Top pages">
          <ul className="flex flex-col">
            {PAGES.map((p, k) => ({ ...p, views: now.pages[k], exits: now.exits[k] }))
              .sort((a, b) => b.views - a.views)
              .map((p) => (
                <li key={p.path} className="flex items-center gap-3 border-t border-border/60 px-4 py-2 text-sm">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{p.title}</span>
                    <span className="block truncate font-mono text-[11px] text-muted-foreground">{p.path}</span>
                  </span>
                  <span className="text-right tabular-nums">
                    <span className="block font-semibold">{n0(p.views)}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {pct0(p.views, now.pages.reduce((s, v) => s + v, 0))}% of views ·{" "}
                      <span className={cn(pct(p.exits, p.views) >= 40 && "font-medium text-amber-700 dark:text-amber-400")}>{pct0(p.exits, p.views)}% exit</span>
                    </span>
                  </span>
                </li>
              ))}
          </ul>
        </Card>
        <Card className="flex flex-col" title="Most viewed products" action={<Link href="/analytics/products" className="text-xs font-medium text-primary hover:underline">Sales by product</Link>}>
          <ul className="flex flex-col">
            {viewed.map((p) => (
              <li key={p.id}>
                <Link href={`/products/${p.id}`} className="group flex items-center gap-3 border-t border-border/60 px-4 py-2 text-sm hover:bg-muted/40">
                  <span className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-lg border bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element -- any image host is allowed */}
                    {p.image && <img src={p.image} alt="" className="size-full object-cover" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium group-hover:text-primary">{p.name}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">{p.category ?? "—"}</span>
                  </span>
                  <span className="shrink-0 text-right tabular-nums">
                    <span className="block font-semibold">{n0(p.views)}</span>
                    <span className="text-[11px] text-muted-foreground">views</span>
                  </span>
                </Link>
              </li>
            ))}
            {viewed.length === 0 && <li className="px-4 pb-4 text-sm text-muted-foreground">No products yet.</li>}
          </ul>
        </Card>
        <Card className="flex flex-col" title="What shoppers search for" action={<span className="text-xs text-muted-foreground">{pct0(unfound, searchTotal)}% found nothing</span>}>
          <ul className="flex flex-col">
            {SEARCHES.map((t, k) => ({ ...t, count: now.searches[k] }))
              .sort((a, b) => b.count - a.count)
              .map((t) => (
                <li key={t.term} className="flex items-center gap-2 border-t border-border/60 px-4 py-2 text-sm">
                  <SearchIcon className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate font-medium">&ldquo;{t.term}&rdquo;</span>
                  {!t.found && <span className="rounded-md bg-amber-50 px-1.5 py-px text-[10px] font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">No results</span>}
                  <span className="w-12 text-right tabular-nums">{n0(t.count)}</span>
                </li>
              ))}
          </ul>
          <p className="mt-auto border-t px-4 py-2.5 text-[11px] text-muted-foreground">Searches with no results are products people want that the store doesn&apos;t sell yet.</p>
        </Card>
      </div>

      <Section title="When they visit" hint="plan posts, ads and staff around the busy times" />
      <div className="grid gap-4 px-4 md:gap-6 lg:px-6 xl:grid-cols-3">
        <Card className="flex flex-col" title="How deep they go">
          <div className="flex flex-col gap-4 px-4 pb-4 text-sm">
            {[
              { title: "Pages per session", labels: DEPTHS, values: now.depth },
              { title: "Time on site", labels: TIMES, values: now.time },
            ].map((group) => (
              <div key={group.title} className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">{group.title}</span>
                {group.labels.map((label, k) => (
                  <div key={label} className="grid grid-cols-[5.5rem_1fr_2.5rem] items-center gap-2 text-xs">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="h-2 overflow-hidden rounded-full bg-muted">
                      <span className="block h-full rounded-full bg-chart-1" style={{ width: `${pct(group.values[k], Math.max(...group.values))}%` }} />
                    </span>
                    <span className="text-right font-medium tabular-nums">{pct0(group.values[k], now.sessions)}%</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </Card>
        <Card
          title="Busiest times"
          className="flex flex-col xl:col-span-2"
          action={
            <span className="flex items-center gap-3">
              <span className="hidden text-xs text-muted-foreground sm:inline">
                busiest {timing === "hour" ? `around ${hourText(peakHour)}` : `on ${busiestWeekday.label}`} · your timezone
              </span>
              <ToggleGroup multiple={false} value={[timing]} onValueChange={(v) => v[0] && setTiming(v[0] as "hour" | "weekday")} variant="outline" size="sm" spacing={0} aria-label="Group visits by">
                <ToggleGroupItem value="hour" className="h-7 px-2.5 text-xs data-pressed:bg-muted data-pressed:font-semibold">
                  By hour
                </ToggleGroupItem>
                <ToggleGroupItem value="weekday" className="h-7 px-2.5 text-xs data-pressed:bg-muted data-pressed:font-semibold">
                  By weekday
                </ToggleGroupItem>
              </ToggleGroup>
            </span>
          }
        >
          <div className="px-2 pb-4 sm:px-4">
            <ChartContainer config={{ sessions: { label: "Sessions", color: "var(--chart-1)" } }} className="aspect-auto h-[280px] w-full">
              <BarChart
                data={timing === "hour" ? now.hours.map((sessions, h) => ({ label: hourText(h), sessions })) : weekdays}
                margin={{ left: 0, right: 4, top: 8 }}
              >
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} interval={timing === "hour" ? 2 : 0} />
                <YAxis tickLine={false} axisLine={false} width={40} tickFormatter={(v: number) => compact(v)} />
                <ChartTooltip cursor={{ fill: "var(--muted)" }} content={<ChartTooltipContent hideIndicator />} />
                <Bar dataKey="sessions" fill="var(--color-sessions)" radius={[4, 4, 0, 0]} maxBarSize={24} />
              </BarChart>
            </ChartContainer>
          </div>
        </Card>
      </div>
    </>
  )
}
