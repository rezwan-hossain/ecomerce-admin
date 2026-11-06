"use client"

import Link from "next/link"
import { useState } from "react"
import { ArrowDownRightIcon, ArrowUpRightIcon, PackageIcon, PackageXIcon, TrophyIcon } from "lucide-react"
import { Bar, BarChart, LabelList, XAxis, YAxis } from "recharts"

import { change, periodRange, PERIODS, type Period, type ProductInfo, type SalesData, within } from "@/components/analytics/analytics-utils"
import { Change, PeriodPicker, ShareBars } from "@/components/analytics/sales-report"
import { Card, n0, taka } from "@/components/inventory/inventory-ui"
import { ListTable, type ListColumn, type ListFilter } from "@/components/list-table"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { cn } from "@/lib/utils"

const DAY = 86_400_000
const METRICS = [
  { value: "revenue", label: "Revenue" },
  { value: "units", label: "Units" },
  { value: "profit", label: "Profit" },
] as const
type Metric = (typeof METRICS)[number]["value"]

type Row = ProductInfo & {
  units: number
  revenue: number
  profit: number | null // null when no unit cost is recorded
  orders: number
  returned: number
  before: number // the picked metric in the previous period
  rank: number
  rankBefore: number | null
  cover: number | null // days the stock lasts at this period's pace
}

function Thumb({ src, className }: { src?: string; className?: string }) {
  return (
    <span className={cn("grid size-10 shrink-0 place-items-center overflow-hidden rounded-lg border bg-muted", className)}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- any image host is allowed
        <img src={src} alt="" className="size-full object-cover" />
      ) : (
        <PackageIcon className="size-4 text-muted-foreground" />
      )}
    </span>
  )
}

const chartConfig = { value: { label: "Value", color: "var(--chart-1)" } } satisfies ChartConfig

export function TopProducts({ data }: { data: SalesData }) {
  const [period, setPeriod] = useState<Period>("90d")
  const [metric, setMetric] = useState<Metric>("revenue")
  const firstAt = data.orders.reduce<string | undefined>((first, o) => (!first || o.at < first ? o.at : first), undefined)
  const { start, end, previousStart } = periodRange(period, firstAt)
  const days = Math.max(1, (end - start) / DAY)

  // Sum one window's lines per product.
  function totals(from: number, to: number) {
    const map = new Map<string, { units: number; revenue: number; cost: number; costKnown: boolean; orders: Set<string>; returned: number }>()
    for (const l of data.lines) {
      if (!within(l.at, from, to)) continue
      const t = map.get(l.productId) ?? { units: 0, revenue: 0, cost: 0, costKnown: true, orders: new Set<string>(), returned: 0 }
      t.units += l.units
      t.revenue += l.revenue
      t.returned += l.returned
      if (l.cost === null) t.costKnown = false
      else t.cost += l.cost
      if (l.units > 0) t.orders.add(l.orderId)
      map.set(l.productId, t)
    }
    return map
  }
  const now = totals(start, end)
  const prev = totals(previousStart, start)
  const value = (t: { units: number; revenue: number; cost: number; costKnown: boolean } | undefined) => {
    if (!t) return 0
    if (metric === "units") return t.units
    if (metric === "profit") return t.costKnown ? t.revenue - t.cost : 0
    return t.revenue
  }

  const productById = new Map(data.products.map((p) => [p.id, p]))
  const rankedBefore = [...prev.entries()].filter(([, t]) => t.units > 0).sort((a, b) => value(b[1]) - value(a[1])).map(([id]) => id)
  const rows: Row[] = [...now.entries()]
    .filter(([, t]) => t.units > 0)
    .sort((a, b) => value(b[1]) - value(a[1]))
    .map(([id, t], index) => {
      const info = productById.get(id) ?? { id, name: "Deleted product", brand: null, category: null, status: "ARCHIVED", stock: 0 }
      const before = rankedBefore.indexOf(id)
      return {
        ...info,
        units: t.units,
        revenue: t.revenue,
        profit: t.costKnown ? t.revenue - t.cost : null,
        orders: t.orders.size,
        returned: t.returned,
        before: value(prev.get(id)),
        rank: index + 1,
        rankBefore: before === -1 ? null : before + 1,
        cover: t.units > 0 ? info.stock / (t.units / days) : null,
      }
    })

  const metricOf = (r: Row) => {
    if (metric === "units") return r.units
    if (metric === "profit") return r.profit ?? 0
    return r.revenue
  }
  const total = rows.reduce((s, r) => s + metricOf(r), 0)
  const format = (n: number) => (metric === "units" ? n0(n) : taka(n))
  const metricLabel = METRICS.find((m) => m.value === metric)!.label.toLowerCase()

  const top10 = rows.slice(0, 10).map((r) => ({ name: r.name.length > 20 ? `${r.name.slice(0, 19)}…` : r.name, value: metricOf(r) }))
  const movers = rows.map((r) => ({ row: r, delta: metricOf(r) - r.before }))
  const rising = [...movers].filter((m) => m.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, 5)
  // Products that sold before but less now, including ones that stopped selling.
  const slowing = [...prev.entries()]
    .map(([id, t]) => ({ id, before: value(t), now: rows.find((r) => r.id === id) }))
    .map((m) => ({ ...m, delta: (m.now ? metricOf(m.now) : 0) - m.before }))
    .filter((m) => m.delta < 0)
    .sort((a, b) => a.delta - b.delta)
    .slice(0, 5)
  const unsold = data.products.filter((p) => p.status === "ACTIVE" && p.stock > 0 && !now.has(p.id))

  const group = (key: "category" | "brand") => {
    const map = new Map<string, number>()
    for (const r of rows) map.set(r[key] ?? "None", (map.get(r[key] ?? "None") ?? 0) + metricOf(r))
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
  }
  const categories = group("category")
  const brands = group("brand")

  const tabs: ListFilter<Row>[] = [
    { label: "All sellers", value: "all", match: () => true },
    { label: "Running low", value: "low", match: (r) => r.stock === 0 || (r.cover !== null && r.cover < 30) },
    { label: "Returned often", value: "returns", match: (r) => r.returned / (r.units + r.returned) >= 0.1 },
    { label: "No unit cost", value: "nocost", match: (r) => r.profit === null },
  ]

  const columns: ListColumn<Row>[] = [
    { key: "rank", header: "#", className: "w-10 text-muted-foreground tabular-nums", cell: (r) => r.rank },
    {
      key: "product",
      header: "Product",
      cell: (r) => (
        <Link href={`/products/${r.id}`} className="group flex max-w-64 items-center gap-2.5">
          <Thumb src={r.image} className="size-9" />
          <span className="min-w-0">
            <span className="block truncate font-medium group-hover:text-primary group-hover:underline">{r.name}</span>
            <span className="block truncate text-[11px] text-muted-foreground">{[r.brand, r.category].filter(Boolean).join(" · ") || "—"}</span>
          </span>
        </Link>
      ),
    },
    {
      key: "units",
      header: "Units",
      className: "text-right tabular-nums",
      cell: (r) => (
        <span className="flex flex-col items-end">
          {n0(r.units)}
          <span className="text-[11px] text-muted-foreground">
            {n0(r.orders)} {r.orders === 1 ? "order" : "orders"}
          </span>
        </span>
      ),
    },
    {
      key: "revenue",
      header: "Revenue",
      className: "text-right tabular-nums",
      cell: (r) => (
        <span className="flex flex-col items-end">
          <span className="font-medium">{taka(r.revenue)}</span>
          <span className="text-[11px] text-muted-foreground">avg {taka(r.revenue / r.units)}</span>
        </span>
      ),
    },
    {
      key: "share",
      header: `Share of ${metricLabel}`,
      className: "hidden lg:table-cell",
      cell: (r) => (
        <span className="flex w-28 items-center gap-2">
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <span className="block h-full rounded-full bg-chart-1" style={{ width: `${total > 0 ? (metricOf(r) / total) * 100 : 0}%` }} />
          </span>
          <span className="w-8 text-right text-[11px] text-muted-foreground tabular-nums">{total > 0 ? Math.round((metricOf(r) / total) * 100) : 0}%</span>
        </span>
      ),
    },
    {
      key: "profit",
      header: "Profit",
      className: "hidden text-right tabular-nums md:table-cell",
      cell: (r) =>
        r.profit === null ? (
          <span className="text-[11px] text-muted-foreground">no cost</span>
        ) : (
          <span className="flex flex-col items-end">
            {taka(r.profit)}
            <span className="text-[11px] text-muted-foreground">{Math.round((r.profit / r.revenue) * 100)}% margin</span>
          </span>
        ),
    },
    {
      key: "returns",
      header: "Returns",
      className: "hidden text-right tabular-nums xl:table-cell",
      cell: (r) => {
        const rate = (r.returned / (r.units + r.returned)) * 100
        if (r.returned === 0) return <span className="text-muted-foreground">—</span>
        return <span className={cn(rate >= 10 && "font-medium text-amber-700 dark:text-amber-400")}>{rate.toFixed(0)}%</span>
      },
    },
    { key: "change", header: "Vs previous", className: "hidden whitespace-nowrap lg:table-cell", cell: (r) => <Change value={change(metricOf(r), r.before)} bare /> },
    {
      key: "stock",
      header: "Stock",
      className: "text-right tabular-nums",
      cell: (r) => {
        let tone = "text-muted-foreground"
        if (r.cover !== null && r.cover < 30) tone = "font-medium text-amber-700 dark:text-amber-400"
        if (r.stock === 0) tone = "font-medium text-destructive"
        return (
          <span className="flex flex-col items-end">
            {n0(r.stock)}
            <span className={cn("text-[11px]", tone)}>
              {r.stock === 0 && "sold out"}
              {r.stock > 0 && r.cover !== null && r.cover > 365 && "over a year left"}
              {r.stock > 0 && r.cover !== null && r.cover <= 365 && `~${n0(Math.round(r.cover))} days left`}
            </span>
          </span>
        )
      },
    },
  ]

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 lg:px-6">
        <PeriodPicker value={period} onChange={setPeriod} />
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          Rank by
          <ToggleGroup multiple={false} value={[metric]} onValueChange={(v) => v[0] && setMetric(v[0] as Metric)} variant="outline" size="sm" spacing={0} aria-label="Rank by">
            {METRICS.map((m) => (
              <ToggleGroupItem key={m.value} value={m.value} className="bg-card px-3 text-xs data-pressed:bg-primary data-pressed:text-primary-foreground">
                {m.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="mx-4 rounded-2xl border border-dashed bg-card px-4 py-8 text-center text-sm text-muted-foreground lg:mx-6">
          Nothing sold in the last {PERIODS.find((p) => p.value === period)!.label.toLowerCase()}. Try a longer period.
        </p>
      ) : (
        <section className="grid gap-4 px-4 md:grid-cols-3 lg:px-6">
          {rows.slice(0, 3).map((r) => (
            <Link key={r.id} href={`/products/${r.id}`} className="group relative flex items-center gap-4 rounded-2xl border bg-card p-4 transition-shadow hover:shadow-md">
              <span
                className={cn(
                  "absolute top-3 right-3 grid size-7 place-items-center rounded-full text-xs font-bold",
                  r.rank === 1 && "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
                  r.rank === 2 && "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
                  r.rank === 3 && "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300"
                )}
              >
                {r.rank === 1 ? <TrophyIcon className="size-3.5" /> : r.rank}
              </span>
              <Thumb src={r.image} className="size-16 rounded-xl" />
              <div className="min-w-0 flex-1">
                <div className="truncate pr-8 font-semibold group-hover:text-primary">{r.name}</div>
                <div className="truncate text-[11px] text-muted-foreground">{[r.brand, r.category].filter(Boolean).join(" · ") || "—"}</div>
                <div className="mt-1.5 text-xl font-bold tracking-tight tabular-nums">{format(metricOf(r))}</div>
                <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                  <span>
                    {metric === "units" ? taka(r.revenue) : `${n0(r.units)} units`} · {total > 0 ? Math.round((metricOf(r) / total) * 100) : 0}% of {metricLabel}
                  </span>
                  <Change value={change(metricOf(r), r.before)} />
                </div>
              </div>
            </Link>
          ))}
        </section>
      )}

      <div className="grid items-start gap-4 px-4 md:gap-6 lg:px-6 xl:grid-cols-3">
        <Card title={`Top 10 by ${metricLabel}`} className="xl:col-span-2">
          <div className="px-2 pb-4 sm:px-4">
            <ChartContainer config={chartConfig} className="aspect-auto w-full" style={{ height: Math.max(top10.length, 1) * 34 + 8 }}>
              <BarChart data={top10} layout="vertical" margin={{ left: 0, right: 72 }} barCategoryGap={6}>
                <XAxis type="number" dataKey="value" hide />
                <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={170} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
                <ChartTooltip cursor={{ fill: "var(--muted)" }} content={<ChartTooltipContent hideIndicator formatter={(v) => format(Number(v))} />} />
                <Bar dataKey="value" fill="var(--color-value)" radius={[0, 4, 4, 0]} maxBarSize={24}>
                  <LabelList dataKey="value" position="right" offset={8} className="fill-foreground" fontSize={12} formatter={(v) => format(Number(v))} />
                </Bar>
              </BarChart>
            </ChartContainer>
          </div>
        </Card>
        <div className="flex flex-col gap-4 md:gap-6">
          <Card title="Rising" action={<ArrowUpRightIcon className="size-4 text-emerald-600" />}>
            <MoverList items={rising.map((m) => ({ id: m.row.id, name: m.row.name, image: m.row.image, text: `+${format(m.delta)}` }))} empty="Nothing grew against the previous period." tone="up" />
          </Card>
          <Card title="Slowing down" action={<ArrowDownRightIcon className="size-4 text-red-500" />}>
            <MoverList
              items={slowing.map((m) => {
                const info = productById.get(m.id)
                return { id: m.id, name: info?.name ?? "Deleted product", image: info?.image, text: `−${format(Math.abs(m.delta))}` }
              })}
              empty="Nothing sold less than in the previous period."
              tone="down"
            />
          </Card>
        </div>
      </div>

      <div className="grid items-start gap-4 px-4 md:gap-6 lg:px-6 xl:grid-cols-3">
        <Card title="Top categories" action={<span className="text-xs text-muted-foreground">by {metricLabel}</span>}>
          <ShareBarsFor rows={categories} total={total} format={format} />
        </Card>
        <Card title="Top brands" action={<span className="text-xs text-muted-foreground">by {metricLabel}</span>}>
          <ShareBarsFor rows={brands} total={total} format={format} />
        </Card>
        <Card title="In stock, no sales" action={<PackageXIcon className="size-4 text-muted-foreground" />}>
          {unsold.length === 0 ? (
            <p className="px-4 pb-4 text-sm text-muted-foreground">Every active product with stock sold at least once.</p>
          ) : (
            <>
              <p className="px-4 pb-2 text-xs text-muted-foreground">
                {n0(unsold.length)} active {unsold.length === 1 ? "product" : "products"} with {n0(unsold.reduce((s, p) => s + p.stock, 0))} units on the shelf, not sold in this period.
              </p>
              <MoverList items={[...unsold].sort((a, b) => b.stock - a.stock).slice(0, 5).map((p) => ({ id: p.id, name: p.name, image: p.image, text: `${n0(p.stock)} in stock` }))} empty="" />
            </>
          )}
        </Card>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="px-4 font-semibold lg:px-6">Every product sold</h2>
        <ListTable
          rows={rows}
          columns={columns}
          getRowId={(r) => r.id}
          searchText={(r) => `${r.name} ${r.brand ?? ""} ${r.category ?? ""}`}
          searchPlaceholder="Search products…"
          filters={tabs.filter((f, index) => index === 0 || rows.some(f.match))}
          emptyText="No products sold in this period."
        />
      </div>
    </>
  )
}

function ShareBarsFor({ rows, total, format }: { rows: [string, number][]; total: number; format: (n: number) => string }) {
  return (
    <ShareBars
      rows={rows.map(([label, value]) => ({ label, value, note: `${total > 0 ? Math.round((value / total) * 100) : 0}%` }))}
      total={rows[0]?.[1] ?? 0}
      format={format}
    />
  )
}

function MoverList({ items, empty, tone }: { items: { id: string; name: string; image?: string; text: string }[]; empty: string; tone?: "up" | "down" }) {
  if (items.length === 0) return <p className="px-4 pb-4 text-sm text-muted-foreground">{empty}</p>
  return (
    <ul className="flex flex-col">
      {items.map((m) => (
        <li key={m.id}>
          <Link href={`/products/${m.id}`} className="group flex items-center gap-3 border-t border-border/60 px-4 py-2 hover:bg-muted/40">
            <Thumb src={m.image} className="size-8" />
            <span className="min-w-0 flex-1 truncate text-sm group-hover:text-primary">{m.name}</span>
            <span
              className={cn(
                "shrink-0 text-xs font-medium tabular-nums",
                tone === "up" && "text-emerald-700 dark:text-emerald-400",
                tone === "down" && "text-red-700 dark:text-red-400",
                !tone && "text-muted-foreground"
              )}
            >
              {m.text}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
