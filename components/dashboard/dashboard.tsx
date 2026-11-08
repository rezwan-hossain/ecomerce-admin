"use client"

import Link from "next/link"
import { useState } from "react"
import {
  AlertTriangleIcon,
  ArrowRightIcon,
  BanknoteIcon,
  ClipboardCheckIcon,
  PackageIcon,
  PackageOpenIcon,
  PercentIcon,
  PlusIcon,
  ReceiptIcon,
  ShoppingCartIcon,
  StarIcon,
  TrendingUpIcon,
  TruckIcon,
  UsersIcon,
  WalletIcon,
  XCircleIcon,
} from "lucide-react"
import { Area, AreaChart, CartesianGrid, Line, XAxis, YAxis } from "recharts"

import { buckets, change, type Period, periodRange, type SalesData, type SaleOrder, within } from "@/components/analytics/analytics-utils"
import { OrderHeatmap, PeriodPicker, ShareBars, short, SparkStat } from "@/components/analytics/sales-report"
import { Card, n0, rel, taka } from "@/components/inventory/inventory-ui"
import { CARRIER_LABEL, CourierLogo, localPhone, ORDER_STATUS_LABEL, paidSoFar, PROVIDER_LABEL, RefreshButton } from "@/components/orders/orders-table"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { cn } from "@/lib/utils"
import type { VariantStock } from "@/types/inventory.type"
import type { Order } from "@/types/order.type"
import type { Review } from "@/types/review.type"

const LIVE_PARCEL = ["PENDING", "PROCESSING", "SHIPPED", "IN_TRANSIT", "OUT_FOR_DELIVERY"]
const STATUS_GROUPS = [
  { label: "Delivered", statuses: ["DELIVERED", "COMPLETED"], color: "bg-emerald-500" },
  { label: "In progress", statuses: ["PENDING", "CONFIRMED", "PROCESSING", "READY_TO_SHIP", "SHIPPED"], color: "bg-blue-500" },
  { label: "Returned", statuses: ["RETURNED", "PARTIALLY_RETURNED", "REFUNDED"], color: "bg-amber-500" },
  { label: "Cancelled", statuses: ["CANCELLED", "FAILED"], color: "bg-red-500" },
]
const chartConfig = {
  now: { label: "This period", color: "var(--chart-1)" },
  before: { label: "Period before", color: "var(--chart-2)" },
} satisfies ChartConfig

// Net sales follow the Sales report: list price less discounts and returns.
const net = (o: SaleOrder) => o.gross - o.discount - o.returned
const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0)
const placed = (o: Order) => o.placedAt ?? o.createdAt

function totals(list: SaleOrder[], lines: SalesData["lines"]) {
  const ok = list.filter((o) => !o.cancelled)
  const netSales = ok.reduce((s, o) => s + net(o), 0)
  const ids = new Set(ok.map((o) => o.id))
  // Profit only where the unit cost is known.
  const costed = lines.filter((l) => ids.has(l.orderId) && l.cost !== null)
  const costedRevenue = costed.reduce((s, l) => s + l.revenue, 0)
  const profit = costed.reduce((s, l) => s + l.revenue - (l.cost ?? 0), 0)
  return {
    net: netSales,
    orders: ok.length,
    aov: ok.length ? netSales / ok.length : 0,
    customers: new Set(ok.map((o) => o.customer)).size,
    newCustomers: ok.filter((o) => o.firstOrder).length,
    cancelRate: list.length ? (list.filter((o) => o.cancelled).length / list.length) * 100 : 0,
    profit,
    margin: costedRevenue ? (profit / costedRevenue) * 100 : null,
  }
}

export function Dashboard({
  sales,
  orders,
  stock,
  reviews,
  openAlerts,
}: {
  sales: SalesData
  orders: Order[]
  stock: VariantStock[]
  reviews: Review[]
  openAlerts: number
}) {
  const [period, setPeriod] = useState<Period>("30d")
  const first = sales.orders.map((o) => o.at).sort()[0]
  const { start, end, previousStart } = periodRange(period, first)
  const current = sales.orders.filter((o) => within(o.at, start, end))
  const previous = sales.orders.filter((o) => within(o.at, previousStart, start))
  const now = totals(current, sales.lines)
  const before = totals(previous, sales.lines)

  // One point per day, week or month; the period before is shifted onto the same points.
  const b = buckets(start, end)
  const series = b.list.map((x) => ({ label: x.label, now: 0, before: 0, orders: 0, profit: 0, customers: new Set<string>(), cancelled: 0 }))
  const index = new Map(b.list.map((x, i) => [x.key, i]))
  const pointOf = new Map<string, (typeof series)[number]>()
  for (const o of current) {
    const point = series[index.get(b.keyOf(o.at)) ?? -1]
    if (!point) continue
    if (o.cancelled) {
      point.cancelled++
      continue
    }
    point.now += net(o)
    point.orders++
    point.customers.add(o.customer)
    pointOf.set(o.id, point)
  }
  for (const l of sales.lines) {
    const point = pointOf.get(l.orderId)
    if (point && l.cost !== null) point.profit += l.revenue - l.cost
  }
  for (const o of previous) {
    if (o.cancelled) continue
    const shifted = new Date(new Date(o.at).getTime() + (start - previousStart)).toISOString()
    const point = series[index.get(b.keyOf(shifted)) ?? -1]
    if (point) point.before += net(o)
  }
  const chartData = series.map((s) => ({ label: s.label, now: Math.round(s.now), before: Math.round(s.before) }))

  // What needs doing right now, whatever the period.
  const toConfirm = orders.filter((o) => o.status === "PENDING")
  const toPack = orders.filter((o) => o.status === "CONFIRMED" || o.status === "PROCESSING")
  const toBook = orders.filter((o) => o.status === "READY_TO_SHIP" && !o.shipments.some((s) => LIVE_PARCEL.includes(s.status)))
  const onTheRoad = orders.filter((o) => o.shipments.some((s) => ["SHIPPED", "IN_TRANSIT", "OUT_FOR_DELIVERY"].includes(s.status)))
  const codHeld = orders
    .filter((o) => ["DELIVERED", "COMPLETED"].includes(o.status))
    .flatMap((o) => o.payments.filter((p) => p.provider === "COD" && p.status === "PENDING"))
    .reduce((s, p) => s + Number(p.amount), 0)
  const sellable = stock.filter((v) => v.isActive)
  const outOfStock = sellable.filter((v) => v.stock <= 0)
  const lowStock = sellable.filter((v) => v.stock > 0 && v.stock <= v.lowStockThreshold)
  const pendingReviews = reviews.filter((r) => r.status === "PENDING")
  const oldest = (list: Order[]) => list.map(placed).sort()[0]

  const attention = [
    {
      label: "To confirm",
      value: toConfirm.length,
      hint: toConfirm.length ? `oldest ${rel(oldest(toConfirm))}` : "all confirmed",
      href: "/orders/pending",
      icon: ClipboardCheckIcon,
    },
    { label: "To pack", value: toPack.length, hint: toPack.length ? `oldest ${rel(oldest(toPack))}` : "nothing waiting", href: "/orders/pending", icon: PackageOpenIcon },
    { label: "To book a courier", value: toBook.length, hint: `${n0(onTheRoad.length)} on the road`, href: "/shipping", icon: TruckIcon },
    { label: "Cash with couriers", value: codHeld, money: true, hint: "delivered, not settled", href: "/shipping", icon: WalletIcon },
    {
      label: "Out of stock",
      value: outOfStock.length,
      hint: `${n0(lowStock.length)} running low · ${n0(openAlerts)} alerts`,
      href: "/inventory/alerts",
      icon: AlertTriangleIcon,
    },
    { label: "Reviews waiting", value: pendingReviews.length, hint: pendingReviews.length ? `oldest ${rel(pendingReviews.map((r) => r.createdAt).sort()[0])}` : "all caught up", href: "/reviews", icon: StarIcon },
  ]

  // Products and categories in the period.
  const currentIds = new Set(current.filter((o) => !o.cancelled).map((o) => o.id))
  const byProduct = new Map<string, { units: number; revenue: number }>()
  for (const l of sales.lines) {
    if (!currentIds.has(l.orderId)) continue
    const p = byProduct.get(l.productId) ?? { units: 0, revenue: 0 }
    p.units += l.units
    p.revenue += l.revenue
    byProduct.set(l.productId, p)
  }
  const productInfo = new Map(sales.products.map((p) => [p.id, p]))
  const topProducts = [...byProduct.entries()]
    .map(([id, t]) => ({ id, ...t, info: productInfo.get(id) }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5)
  const byCategory = new Map<string, number>()
  for (const [id, t] of byProduct) {
    const category = productInfo.get(id)?.category ?? "Uncategorised"
    byCategory.set(category, (byCategory.get(category) ?? 0) + t.revenue)
  }
  const categoryRevenue = [...byCategory.values()].reduce((s, v) => s + v, 0)
  const categories = [...byCategory.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)

  const groups = STATUS_GROUPS.map((g) => ({ ...g, count: current.filter((o) => g.statuses.includes(o.status)).length }))
  const kept = current.filter((o) => !o.cancelled)
  const received = kept.reduce((s, o) => s + o.received, 0)
  const codShare = pct(kept.filter((o) => o.cod).length, kept.length)

  // Who bought in the period.
  const returning = now.orders - now.newCustomers
  const spenders = new Map<string, { name: string; net: number; orders: number }>()
  for (const o of kept) {
    const c = spenders.get(o.customer) ?? { name: o.customerName, net: 0, orders: 0 }
    c.net += net(o)
    c.orders++
    spenders.set(o.customer, c)
  }
  const topSpenders = [...spenders.values()].sort((a, b) => b.net - a.net).slice(0, 3)

  const recent = [...orders].sort((a, b) => placed(b).localeCompare(placed(a))).slice(0, 8)
  const watch = [...outOfStock, ...lowStock.sort((a, b) => a.stock - b.stock)].slice(0, 6)
  const latestReviews = [...reviews]
    .sort((a, b) => Number(b.status === "PENDING") - Number(a.status === "PENDING") || b.createdAt.localeCompare(a.createdAt))
    .slice(0, 4)

  const hour = new Date().getHours()
  let greeting = "Good evening"
  if (hour < 12) greeting = "Good morning"
  else if (hour < 17) greeting = "Good afternoon"
  const periodLabel = period === "all" ? "all time" : `the last ${period === "12m" ? "12 months" : `${period.replace("d", "")} days`}`

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <header className="flex flex-wrap items-end justify-between gap-3 px-4 lg:px-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" suppressHydrationWarning>
            {greeting}, Store Admin
          </h1>
          <p className="text-sm text-muted-foreground" suppressHydrationWarning>
            {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })} · {n0(toConfirm.length + toPack.length + toBook.length)} orders
            waiting on you
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PeriodPicker value={period} onChange={setPeriod} />
          <RefreshButton iconOnly />
          <Button size="sm" nativeButton={false} render={<Link href="/products/new" />}>
            <PlusIcon data-icon="inline-start" />
            Add product
          </Button>
        </div>
      </header>

      <section className="flex flex-col gap-2 px-4 lg:px-6">
        <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Needs attention</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {attention.map((a) => {
            const busy = a.value > 0
            return (
              <Link
                key={a.label}
                href={a.href}
                className={cn(
                  "group flex flex-col gap-1 rounded-2xl border bg-card p-3.5 transition-colors hover:border-foreground/20",
                  busy && "border-amber-300 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-950/30"
                )}
              >
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <a.icon className={cn("size-3.5", busy && "text-amber-600 dark:text-amber-400")} />
                    {a.label}
                  </span>
                  <ArrowRightIcon className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
                <strong className="text-2xl font-bold tracking-tight tabular-nums">{a.money ? short(a.value) : n0(a.value)}</strong>
                <span className="truncate text-[11px] text-muted-foreground">{a.hint}</span>
              </Link>
            )
          })}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 px-4 md:grid-cols-3 lg:px-6 xl:grid-cols-6">
        <SparkStat label="Net sales" icon={BanknoteIcon} value={taka(now.net)} delta={change(now.net, before.net)} spark={series.map((s) => s.now)} hint={`over ${periodLabel}`} />
        <SparkStat label="Orders" icon={ShoppingCartIcon} value={n0(now.orders)} delta={change(now.orders, before.orders)} spark={series.map((s) => s.orders)} />
        <SparkStat
          label="Average order"
          icon={ReceiptIcon}
          value={taka(now.aov)}
          delta={change(now.aov, before.aov)}
          spark={series.map((s) => (s.orders ? s.now / s.orders : 0))}
        />
        <SparkStat
          label="Customers"
          icon={UsersIcon}
          value={n0(now.customers)}
          delta={change(now.customers, before.customers)}
          spark={series.map((s) => s.customers.size)}
          hint={`${n0(now.newCustomers)} new`}
        />
        <SparkStat
          label="Gross profit"
          icon={TrendingUpIcon}
          value={taka(now.profit)}
          delta={change(now.profit, before.profit)}
          spark={series.map((s) => s.profit)}
          hint={now.margin === null ? "no unit costs recorded" : `${Math.round(now.margin)}% margin where cost is known`}
        />
        <SparkStat
          label="Cancelled"
          icon={PercentIcon}
          value={`${Math.round(now.cancelRate)}%`}
          delta={change(now.cancelRate, before.cancelRate)}
          invert
          spark={series.map((s) => s.cancelled)}
          hint="of orders placed"
        />
      </section>

      <div className="px-4 lg:px-6">
        <OrderHeatmap orders={kept} compact />
      </div>

      <div className="grid gap-4 px-4 md:gap-6 lg:px-6 xl:grid-cols-3">
        <Card
          title="Net sales"
          className="xl:col-span-2"
          action={
            <Link href="/analytics/sales" className="text-xs font-medium text-primary hover:underline">
              Sales report
            </Link>
          }
        >
          <div className="px-4 pb-4">
            <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-2xl font-bold tracking-tight tabular-nums">{taka(now.net)}</span>
              <span className="text-sm text-muted-foreground">vs {taka(before.net)} the period before</span>
            </div>
            <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full">
              <AreaChart data={chartData} margin={{ top: 4, left: 4, right: 4, bottom: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={28} fontSize={11} />
                <YAxis tickLine={false} axisLine={false} width={48} fontSize={11} tickFormatter={(v) => short(Number(v))} />
                <ChartTooltip content={<ChartTooltipContent formatter={(v, name) => `${chartConfig[name as keyof typeof chartConfig].label}: ${taka(Number(v))}`} />} />
                <Area dataKey="now" type="monotone" stroke="var(--color-now)" strokeWidth={2} fill="var(--color-now)" fillOpacity={0.1} />
                <Line dataKey="before" type="monotone" stroke="var(--color-before)" strokeWidth={2} strokeDasharray="4 4" dot={false} />
                <ChartLegend content={<ChartLegendContent />} />
              </AreaChart>
            </ChartContainer>
          </div>
        </Card>

        <Card title="How orders ended up" action={<span className="text-xs text-muted-foreground">{n0(current.length)} placed</span>}>
          <div className="flex flex-col gap-4 px-4 pb-4">
            <div className="flex h-3 overflow-hidden rounded-full bg-muted">
              {groups.map((g) => (
                <div key={g.label} className={g.color} style={{ width: `${pct(g.count, current.length)}%` }} title={`${g.label}: ${g.count}`} />
              ))}
            </div>
            <ul className="flex flex-col gap-2 text-sm">
              {groups.map((g) => (
                <li key={g.label} className="flex items-center gap-2">
                  <span className={cn("size-2.5 rounded-full", g.color)} />
                  <span className="flex-1">{g.label}</span>
                  <span className="font-semibold tabular-nums">{n0(g.count)}</span>
                  <span className="w-10 text-right text-xs text-muted-foreground tabular-nums">{pct(g.count, current.length)}%</span>
                </li>
              ))}
            </ul>
            <div className="grid grid-cols-2 gap-2 border-t pt-4 text-xs">
              <div className="rounded-lg bg-muted/50 px-3 py-2">
                <div className="text-muted-foreground">Money collected</div>
                <div className="text-base font-semibold tabular-nums">{short(received)}</div>
                <div className="text-muted-foreground">{pct(received, now.net)}% of net sales</div>
              </div>
              <div className="rounded-lg bg-muted/50 px-3 py-2">
                <div className="text-muted-foreground">Cash on delivery</div>
                <div className="text-base font-semibold tabular-nums">{codShare}%</div>
                <div className="text-muted-foreground">of orders</div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 px-4 md:gap-6 lg:px-6 xl:grid-cols-2">
        <Card
          title="Top products"
          action={
            <Link href="/analytics/products" className="text-xs font-medium text-primary hover:underline">
              See all
            </Link>
          }
        >
          {topProducts.length === 0 ? (
            <p className="px-4 pb-4 text-sm text-muted-foreground">No sales in this period.</p>
          ) : (
            <ul className="flex flex-col gap-3 px-4 pb-4">
              {topProducts.map((p, i) => (
                <li key={p.id} className="flex items-center gap-3">
                  <span className="w-3 text-center text-xs font-semibold text-muted-foreground tabular-nums">{i + 1}</span>
                  <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-lg border bg-muted/60 text-muted-foreground">
                    {p.info?.image ? (
                      // eslint-disable-next-line @next/next/no-img-element -- any image host is allowed
                      <img src={p.info.image} alt="" className="size-full object-cover" />
                    ) : (
                      <PackageIcon className="size-4" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <Link href={`/products/${p.id}`} className="truncate text-sm font-medium hover:text-primary hover:underline">
                        {p.info?.name ?? "Deleted product"}
                      </Link>
                      <span className="shrink-0 text-sm font-semibold tabular-nums">{short(p.revenue)}</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-chart-1" style={{ width: `${pct(p.revenue, topProducts[0].revenue)}%` }} />
                    </div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                      {n0(p.units)} {p.units === 1 ? "unit" : "units"} · {n0(p.info?.stock ?? 0)} in stock
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          title="Stock to watch"
          action={
            <Link href="/inventory/stock" className="text-xs font-medium text-primary hover:underline">
              Stock levels
            </Link>
          }
        >
          {watch.length === 0 ? (
            <p className="px-4 pb-4 text-sm text-muted-foreground">Everything is above its alert level.</p>
          ) : (
            <ul className="flex flex-col">
              {watch.map((v) => {
                const out = v.stock <= 0
                return (
                  <li key={v.variantId} className="flex items-center gap-3 border-t border-border/60 px-4 py-2.5 text-sm first:border-t-0">
                    <span className={cn("size-2 shrink-0 rounded-full", out ? "bg-red-500" : "bg-amber-500")} />
                    <div className="min-w-0 flex-1">
                      <Link href={`/products/${v.product.id}`} className="block truncate font-medium hover:text-primary hover:underline">
                        {v.product.name}
                      </Link>
                      <div className="truncate text-xs text-muted-foreground">
                        {v.name === v.sku ? v.sku : `${v.name} · ${v.sku}`}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={cn("font-semibold tabular-nums", out ? "text-destructive" : "text-amber-700 dark:text-amber-400")}>{out ? "Out" : n0(v.stock)}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {v.incoming > 0 ? `${n0(v.incoming)} incoming` : `alert at ${n0(v.lowStockThreshold)}`}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
          {outOfStock.length + lowStock.length > watch.length && (
            <p className="border-t border-border/60 px-4 py-2 text-xs text-muted-foreground">
              and {n0(outOfStock.length + lowStock.length - watch.length)} more
            </p>
          )}
        </Card>
      </div>

      <div className="grid gap-4 px-4 md:gap-6 lg:px-6 xl:grid-cols-3">
        <Card title="Sales by category" action={<span className="text-xs text-muted-foreground">{periodLabel}</span>}>
          {categories.length === 0 ? (
            <p className="px-4 pb-4 text-sm text-muted-foreground">No sales in this period.</p>
          ) : (
            <ShareBars
              rows={categories.map(([label, value]) => ({ label, value, note: `${pct(value, categoryRevenue)}%` }))}
              total={categories[0][1]}
              format={short}
            />
          )}
        </Card>

        <Card title="Customers" action={<Link href="/customers" className="text-xs font-medium text-primary hover:underline">All customers</Link>}>
          <div className="flex flex-col gap-4 px-4 pb-4">
            <div>
              <div className="flex items-baseline justify-between text-sm">
                <span>
                  <span className="font-semibold tabular-nums">{n0(now.newCustomers)}</span> new
                </span>
                <span>
                  <span className="font-semibold tabular-nums">{n0(Math.max(0, returning))}</span> repeat orders
                </span>
              </div>
              <div className="mt-1.5 flex h-2.5 overflow-hidden rounded-full bg-muted">
                <div className="bg-chart-1" style={{ width: `${pct(now.newCustomers, now.orders)}%` }} />
                <div className="bg-chart-2" style={{ width: `${pct(Math.max(0, returning), now.orders)}%` }} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Orders from first-time and returning customers</p>
            </div>
            <ul className="flex flex-col gap-2 border-t pt-3">
              {topSpenders.map((c) => (
                <li key={c.name} className="flex items-center gap-2.5 text-sm">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary uppercase">
                    {c.name
                      .split(/\s+/)
                      .map((w) => w[0])
                      .join("")
                      .slice(0, 2)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{c.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {n0(c.orders)} {c.orders === 1 ? "order" : "orders"}
                    </span>
                  </span>
                  <span className="font-semibold tabular-nums">{short(c.net)}</span>
                </li>
              ))}
              {topSpenders.length === 0 && <li className="text-sm text-muted-foreground">No orders in this period.</li>}
            </ul>
          </div>
        </Card>

        <Card
          title="Latest reviews"
          action={
            <Link href="/reviews" className="text-xs font-medium text-primary hover:underline">
              Reviews
            </Link>
          }
        >
          {latestReviews.length === 0 ? (
            <p className="px-4 pb-4 text-sm text-muted-foreground">No reviews yet.</p>
          ) : (
            <ul className="flex flex-col">
              {latestReviews.map((r) => {
                let chip = "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                if (r.rating === 3) chip = "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                if (r.rating <= 2) chip = "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
                return (
                  <li key={r.id} className="flex flex-col gap-1 border-t border-border/60 px-4 py-2.5 first:border-t-0">
                    <div className="flex items-center gap-2">
                      <span className={cn("inline-flex h-5 items-center gap-0.5 rounded-md px-1.5 text-xs font-semibold tabular-nums", chip)}>
                        <StarIcon className="size-3 fill-current" />
                        {r.rating}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{r.title ?? r.body ?? "No text"}</span>
                      {r.status === "PENDING" && <span className="text-[11px] font-medium text-amber-700 dark:text-amber-400">To moderate</span>}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {r.product ? (
                        <Link href={`/products/${r.product.id}`} className="hover:text-primary hover:underline">
                          {r.product.name}
                        </Link>
                      ) : (
                        "A product"
                      )}{" "}
                      · {[r.user?.firstName, r.user?.lastName].filter(Boolean).join(" ") || "Anonymous"} · {rel(r.createdAt)}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      </div>

      <div className="px-4 lg:px-6">
        <Card
          title="Recent orders"
          action={
            <Link href="/orders" className="text-xs font-medium text-primary hover:underline">
              All orders
            </Link>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:font-medium [&>th]:whitespace-nowrap [&>th:first-child]:pl-4 [&>th:last-child]:pr-4">
                  <th>Order</th>
                  <th>Customer</th>
                  <th className="hidden md:table-cell">Items</th>
                  <th className="hidden lg:table-cell">Payment</th>
                  <th className="hidden lg:table-cell">Courier</th>
                  <th>Status</th>
                  <th className="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((o) => {
                  const units = o.items.reduce((s, i) => s + i.quantity, 0)
                  const paid = paidSoFar(o)
                  const total = Number(o.totalAmount)
                  const parcel = o.shipments.at(-1)
                  const provider = o.payments.at(-1)?.provider
                  let payment = { text: "Unpaid", className: "text-amber-700 dark:text-amber-400" }
                  if (paid >= total) payment = { text: "Paid", className: "text-emerald-700 dark:text-emerald-400" }
                  else if (paid > 0) payment = { text: `${taka(total - paid)} due`, className: "text-amber-700 dark:text-amber-400" }
                  return (
                    <tr key={o.id} className="border-t border-border/60 hover:bg-muted/30 [&>td]:px-3 [&>td]:py-2.5 [&>td:first-child]:pl-4 [&>td:last-child]:pr-4">
                      <td>
                        <Link href={`/orders/${o.id}`} className="font-medium whitespace-nowrap hover:text-primary hover:underline">
                          {o.orderNumber}
                        </Link>
                        <div className="text-xs text-muted-foreground">{rel(placed(o))}</div>
                      </td>
                      <td className="max-w-52">
                        <div className="truncate font-medium">{o.customerName ?? o.customerEmail}</div>
                        <div className="truncate text-xs text-muted-foreground">{o.customerPhone ? localPhone(o.customerPhone) : o.customerEmail}</div>
                      </td>
                      <td className="hidden max-w-64 md:table-cell">
                        <div className="truncate">{o.items[0]?.productName ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">
                          {o.items.length > 1 ? `+${o.items.length - 1} more · ` : ""}
                          {n0(units)} {units === 1 ? "unit" : "units"}
                        </div>
                      </td>
                      <td className="hidden whitespace-nowrap lg:table-cell">
                        <div>{provider ? PROVIDER_LABEL[provider] : "—"}</div>
                        <div className={cn("text-xs font-medium", payment.className)}>{payment.text}</div>
                      </td>
                      <td className="hidden lg:table-cell">
                        {parcel ? (
                          <div className="flex items-center gap-2">
                            <CourierLogo carrier={parcel.carrier} className="size-6 rounded-md" />
                            <div>
                              <div className="whitespace-nowrap">{CARRIER_LABEL[parcel.carrier]}</div>
                              <div className="text-xs whitespace-nowrap text-muted-foreground capitalize">{parcel.status.replaceAll("_", " ").toLowerCase()}</div>
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Not shipped</span>
                        )}
                      </td>
                      <td>
                        <StatusBadge status={ORDER_STATUS_LABEL[o.status]} />
                      </td>
                      <td className="text-right font-semibold whitespace-nowrap tabular-nums">{taka(total)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {now.orders === 0 && current.length === 0 && (
        <p className="flex items-center justify-center gap-2 px-4 text-sm text-muted-foreground">
          <XCircleIcon className="size-4" />
          No orders in {periodLabel}. Try a longer period.
        </p>
      )}
    </div>
  )
}
