"use client"

import Link from "next/link"
import { ArrowRightIcon, BanknoteIcon, GaugeIcon, PercentIcon, TruckIcon, Undo2Icon, UsersIcon } from "lucide-react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

import type { SaleLine, SaleOrder, SalesData } from "@/components/analytics/analytics-utils"
import { ShareBars, short } from "@/components/analytics/sales-report"
import { Card, n0, taka } from "@/components/inventory/inventory-ui"
import { CARRIER_LABEL, CourierLogo } from "@/components/orders/orders-table"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { cn } from "@/lib/utils"

const DAY = 86_400_000
const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0)
const netOf = (o: SaleOrder) => o.gross - o.discount - o.returned
// Order sizes in taka, sized for a Bangladeshi store: small basket to big-ticket.
const SIZES = [
  { label: "Under ৳1k", max: 1_000 },
  { label: "৳1k–5k", max: 5_000 },
  { label: "৳5k–20k", max: 20_000 },
  { label: "৳20k–50k", max: 50_000 },
  { label: "৳50k–1L", max: 100_000 },
  { label: "৳1L+", max: Infinity },
]
const sizeConfig = { orders: { label: "Orders", color: "var(--chart-1)" } } satisfies ChartConfig

function Fact({ label, value, hint, warn }: { label: string; value: string; hint?: string; warn?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn("truncate font-semibold tabular-nums", warn && "text-amber-700 dark:text-amber-400")}>{value}</div>
      {hint && <div className="truncate text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  )
}

function Thumb({ src }: { src?: string }) {
  return (
    <span className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-lg border bg-muted">
      {/* eslint-disable-next-line @next/next/no-img-element -- any image host is allowed */}
      {src && <img src={src} alt="" className="size-full object-cover" />}
    </span>
  )
}

// The second half of the sales report: pace, order sizes, money in, products, returns, couriers, discounts and customers.
export function SalesDetails({
  data,
  inPeriod,
  sold,
  lines,
  start,
  end,
}: {
  data: SalesData
  inPeriod: SaleOrder[]
  sold: SaleOrder[]
  lines: SaleLine[]
  start: number
  end: number
}) {
  const net = sold.reduce((s, o) => s + netOf(o), 0)
  const days = Math.max(1, Math.round((end - start) / DAY))
  const products = new Map(data.products.map((p) => [p.id, p]))

  // ── Pace ─────────────────────────────────────
  const salesDays = new Set(sold.map((o) => new Date(o.at).toDateString())).size
  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)
  const monthNet = data.orders.filter((o) => !o.cancelled && new Date(o.at).getTime() >= monthStart.getTime()).reduce((s, o) => s + netOf(o), 0)
  const monthDaysGone = Math.max(1, (Date.now() - monthStart.getTime()) / DAY)
  const monthDays = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate()
  const values = sold.map(netOf).sort((a, b) => a - b)
  const median = values.length ? values[Math.floor(values.length / 2)] : 0

  // ── Order sizes ─────────────────────────────────
  const sizes = SIZES.map((s, index) => {
    const min = index === 0 ? 0 : SIZES[index - 1].max
    const inRange = sold.filter((o) => netOf(o) >= min && netOf(o) < s.max)
    return { label: s.label, orders: inRange.length, value: inRange.reduce((sum, o) => sum + netOf(o), 0) }
  })
  const topSize = sizes.reduce((best, s) => (s.value > best.value ? s : best), sizes[0])

  // ── Money in ─────────────────────────────────
  const received = sold.reduce((s, o) => s + Math.min(o.received, netOf(o) + o.shipping), 0)
  const billed = sold.reduce((s, o) => s + netOf(o) + o.shipping, 0)
  const open = sold.filter((o) => !["RETURNED", "REFUNDED"].includes(o.status) && o.received < netOf(o) + o.shipping - 1)
  const codOut = open.filter((o) => o.cod && o.parcel && !["DELIVERED", "RETURNED", "CANCELLED", "FAILED"].includes(o.parcel))
  const codHeld = open.filter((o) => o.cod && o.parcel === "DELIVERED")
  const notShipped = open.filter((o) => !o.parcel)
  const owed = (list: SaleOrder[]) => list.reduce((s, o) => s + netOf(o) + o.shipping - o.received, 0)

  // ── Products ─────────────────────────────────
  const byProduct = new Map<string, { units: number; revenue: number; returned: number; orders: Set<string> }>()
  for (const l of lines) {
    const row = byProduct.get(l.productId) ?? { units: 0, revenue: 0, returned: 0, orders: new Set<string>() }
    row.units += l.units
    row.revenue += l.revenue
    row.returned += l.returned
    if (l.units > 0) row.orders.add(l.orderId)
    byProduct.set(l.productId, row)
  }
  const topProducts = [...byProduct.entries()].sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 6)
  const productRevenue = lines.reduce((s, l) => s + l.revenue, 0)
  const brands = new Map<string, number>()
  for (const l of lines) {
    const brand = products.get(l.productId)?.brand ?? "No brand"
    brands.set(brand, (brands.get(brand) ?? 0) + l.revenue)
  }
  const topBrands = [...brands.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)

  // ── Returns ─────────────────────────────────
  const unitsOut = lines.reduce((s, l) => s + l.units + l.returned, 0)
  const unitsBack = lines.reduce((s, l) => s + l.returned, 0)
  const returnedValue = sold.reduce((s, o) => s + o.returned, 0)
  const ordersWithReturns = sold.filter((o) => o.returned > 0).length
  const mostReturned = [...byProduct.entries()].filter(([, r]) => r.returned > 0).sort((a, b) => b[1].returned - a[1].returned).slice(0, 4)

  // ── Couriers ─────────────────────────────────
  const shipped = sold.filter((o) => o.carrier)
  const couriers = Object.keys(CARRIER_LABEL)
    .map((carrier) => {
      const mine = shipped.filter((o) => o.carrier === carrier)
      const finished = mine.filter((o) => o.parcel && ["DELIVERED", "RETURNED", "FAILED"].includes(o.parcel))
      const delivered = mine.filter((o) => o.parcel === "DELIVERED")
      const timed = mine.filter((o) => o.deliveryDays !== null)
      return {
        carrier,
        parcels: mine.length,
        rate: finished.length ? pct(delivered.length, finished.length) : null,
        days: timed.length ? timed.reduce((s, o) => s + (o.deliveryDays ?? 0), 0) / timed.length : null,
        fees: mine.reduce((s, o) => s + o.courierFee, 0),
        charged: mine.reduce((s, o) => s + o.shipping, 0),
        cod: mine.filter((o) => o.cod).length,
      }
    })
    .filter((c) => c.parcels > 0)
    .sort((a, b) => b.parcels - a.parcels)
  const fees = couriers.reduce((s, c) => s + c.fees, 0)
  const charged = sold.reduce((s, o) => s + o.shipping, 0)
  const freeDelivery = sold.filter((o) => o.shipping === 0).length

  // ── Discounts ─────────────────────────────────
  const discounted = sold.filter((o) => o.discount > 0)
  const discountTotal = discounted.reduce((s, o) => s + o.discount, 0)
  const grossTotal = sold.reduce((s, o) => s + o.gross, 0)
  const avgDiscounted = discounted.length ? discounted.reduce((s, o) => s + netOf(o), 0) / discounted.length : 0
  const plain = sold.filter((o) => o.discount === 0)
  const avgPlain = plain.length ? plain.reduce((s, o) => s + netOf(o), 0) / plain.length : 0

  // ── Customers ─────────────────────────────────
  const spend = new Map<string, { name: string; orders: number; value: number; first: boolean; city: string | null; last: string }>()
  for (const o of sold) {
    const c = spend.get(o.customer) ?? { name: o.customerName, orders: 0, value: 0, first: false, city: o.city, last: o.at }
    c.orders += 1
    c.value += netOf(o)
    if (o.firstOrder) c.first = true
    if (o.at > c.last) c.last = o.at
    spend.set(o.customer, c)
  }
  const topCustomers = [...spend.values()].sort((a, b) => b.value - a.value).slice(0, 6)
  const topShare = pct(
    topCustomers.slice(0, 3).reduce((s, c) => s + c.value, 0),
    net
  )
  const cancelled = inPeriod.filter((o) => o.cancelled)

  return (
    <>
      <section className="mx-4 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border bg-border md:grid-cols-3 lg:mx-6 xl:grid-cols-6">
        {[
          { label: "Per day", value: short(net / days), hint: `average over ${n0(days)} days` },
          { label: "Days with a sale", value: `${pct(salesDays, days)}%`, hint: `${n0(salesDays)} of ${n0(days)} days` },
          { label: "Typical order", value: short(median), hint: "median, half are bigger" },
          { label: "This month so far", value: short(monthNet), hint: `on pace for ${short((monthNet / monthDaysGone) * monthDays)}` },
          { label: "Items per order", value: sold.length ? (sold.reduce((s, o) => s + o.units, 0) / sold.length).toFixed(1) : "—", hint: "units in an average basket" },
          { label: "Lost to cancels", value: short(cancelled.reduce((s, o) => s + o.gross - o.discount, 0)), hint: `${n0(cancelled.length)} cancelled or failed orders` },
        ].map((f) => (
          <div key={f.label} className="bg-card px-4 py-3">
            <Fact label={f.label} value={f.value} hint={f.hint} />
          </div>
        ))}
      </section>

      <div className="grid items-start gap-4 px-4 md:gap-6 lg:px-6 xl:grid-cols-3">
        <Card title="Order sizes" className="xl:col-span-2" action={<span className="text-xs text-muted-foreground">orders by value · most money from {topSize.label}</span>}>
          <div className="grid gap-4 px-4 pb-4 md:grid-cols-[1fr_15rem]">
            <ChartContainer config={sizeConfig} className="aspect-auto h-[220px] w-full">
              <BarChart data={sizes} margin={{ left: 0, right: 4, top: 8 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} fontSize={11} />
                <YAxis tickLine={false} axisLine={false} width={24} allowDecimals={false} />
                <ChartTooltip cursor={{ fill: "var(--muted)" }} content={<ChartTooltipContent hideIndicator />} />
                <Bar dataKey="orders" fill="var(--color-orders)" radius={[4, 4, 0, 0]} maxBarSize={24} />
              </BarChart>
            </ChartContainer>
            <ul className="flex flex-col justify-center gap-2 text-sm">
              {sizes.map((s) => (
                <li key={s.label} className="flex items-baseline justify-between gap-2">
                  <span className="text-muted-foreground">{s.label}</span>
                  <span className="tabular-nums">
                    <span className="font-medium">{short(s.value)}</span>
                    <span className="ml-1 text-[11px] text-muted-foreground">{pct(s.value, net)}%</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Card>

        <Card title="Money in" action={<BanknoteIcon className="size-4 text-muted-foreground" />}>
          <div className="flex flex-col gap-3 px-4 pb-4 text-sm">
            <div>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-bold tabular-nums">{pct(received, billed)}%</span>
                <span className="text-xs text-muted-foreground">
                  {short(received)} of {short(billed)} collected
                </span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct(received, billed)}%` }} />
              </div>
            </div>
            {[
              { label: "With couriers, on the way", list: codOut, hint: "cash on delivery not yet delivered" },
              { label: "Delivered, cash not settled", list: codHeld, hint: "mark paid once the courier pays out", warn: codHeld.length > 0 },
              { label: "Not shipped yet", list: notShipped, hint: "to be collected or paid" },
            ].map((row) => (
              <div key={row.label} className="flex items-start justify-between gap-2 border-t pt-2.5">
                <span className="min-w-0">
                  <span className="block">{row.label}</span>
                  <span className="block text-[11px] text-muted-foreground">{row.hint}</span>
                </span>
                <span className={cn("shrink-0 text-right tabular-nums", row.warn && "text-amber-700 dark:text-amber-400")}>
                  <span className="block font-semibold">{short(owed(row.list))}</span>
                  <span className="block text-[11px] text-muted-foreground">
                    {n0(row.list.length)} {row.list.length === 1 ? "order" : "orders"}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid items-start gap-4 px-4 md:gap-6 lg:px-6 xl:grid-cols-3">
        <Card
          title="Best sellers"
          className="xl:col-span-2"
          action={
            <Link href="/analytics/products" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
              All products <ArrowRightIcon className="size-3.5" />
            </Link>
          }
        >
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:font-medium [&>th:first-child]:pl-4 [&>th:last-child]:pr-4">
                <th>Product</th>
                <th className="text-right">Units</th>
                <th className="hidden text-right sm:table-cell">Orders</th>
                <th className="text-right">Revenue</th>
                <th className="hidden w-36 md:table-cell">Share</th>
                <th className="hidden text-right lg:table-cell">Stock left</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {topProducts.map(([id, row]) => {
                const p = products.get(id)
                return (
                  <tr key={id} className="border-t border-border/60 [&>td]:px-3 [&>td]:py-2 [&>td:first-child]:pl-4 [&>td:last-child]:pr-4">
                    <td>
                      <Link href={`/products/${id}`} className="group flex min-w-0 items-center gap-2.5">
                        <Thumb src={p?.image} />
                        <span className="min-w-0">
                          <span className="block max-w-56 truncate font-medium group-hover:text-primary">{p?.name ?? "Deleted product"}</span>
                          <span className="block truncate text-[11px] text-muted-foreground">{[p?.brand, p?.category].filter(Boolean).join(" · ") || "—"}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="text-right">{n0(row.units)}</td>
                    <td className="hidden text-right sm:table-cell">{n0(row.orders.size)}</td>
                    <td className="text-right font-medium">{taka(row.revenue)}</td>
                    <td className="hidden md:table-cell">
                      <span className="flex items-center gap-2">
                        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                          <span className="block h-full rounded-full bg-chart-1" style={{ width: `${pct(row.revenue, productRevenue)}%` }} />
                        </span>
                        <span className="w-8 text-right text-[11px] text-muted-foreground">{pct(row.revenue, productRevenue)}%</span>
                      </span>
                    </td>
                    <td className={cn("hidden text-right lg:table-cell", p && p.stock === 0 && "font-medium text-destructive")}>{p ? n0(p.stock) : "—"}</td>
                  </tr>
                )
              })}
              {topProducts.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                    Nothing sold in this period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>

        <Card title="Top brands">
          <ShareBars rows={topBrands.map(([label, value]) => ({ label, value, note: `${pct(value, productRevenue)}%` }))} total={topBrands[0]?.[1] ?? 0} format={short} />
        </Card>
      </div>

      <div className="grid items-start gap-4 px-4 md:gap-6 lg:px-6 xl:grid-cols-3">
        <Card title="Couriers" className="xl:col-span-2" action={<TruckIcon className="size-4 text-muted-foreground" />}>
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:font-medium [&>th:first-child]:pl-4 [&>th:last-child]:pr-4">
                <th>Courier</th>
                <th className="text-right">Parcels</th>
                <th className="text-right">Delivered</th>
                <th className="hidden text-right sm:table-cell">Avg days</th>
                <th className="hidden text-right md:table-cell">Cash on delivery</th>
                <th className="text-right">Fees paid</th>
                <th className="hidden text-right md:table-cell">Charged to customers</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {couriers.map((c) => {
                let tone = "text-emerald-700 dark:text-emerald-400"
                if (c.rate !== null && c.rate < 90) tone = "text-amber-700 dark:text-amber-400"
                if (c.rate !== null && c.rate < 70) tone = "text-destructive"
                return (
                  <tr key={c.carrier} className="border-t border-border/60 [&>td]:px-3 [&>td]:py-2 [&>td:first-child]:pl-4 [&>td:last-child]:pr-4">
                    <td className="font-medium">
                      <span className="flex items-center gap-2">
                        <CourierLogo carrier={c.carrier as keyof typeof CARRIER_LABEL} className="size-5" />
                        {CARRIER_LABEL[c.carrier as keyof typeof CARRIER_LABEL]}
                      </span>
                    </td>
                    <td className="text-right">{n0(c.parcels)}</td>
                    <td className={cn("text-right font-medium", c.rate !== null && tone)}>{c.rate === null ? "—" : `${c.rate}%`}</td>
                    <td className="hidden text-right sm:table-cell">{c.days === null ? "—" : c.days.toFixed(1)}</td>
                    <td className="hidden text-right md:table-cell">{pct(c.cod, c.parcels)}%</td>
                    <td className="text-right">{taka(c.fees)}</td>
                    <td className="hidden text-right md:table-cell">{taka(c.charged)}</td>
                  </tr>
                )
              })}
              {couriers.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">
                    No parcels in this period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="grid grid-cols-3 gap-3 border-t px-4 py-3 text-sm">
            <Fact label="Shipped" value={`${pct(shipped.length, sold.length)}%`} hint={`${n0(shipped.length)} of ${n0(sold.length)} orders`} />
            <Fact label="Free delivery" value={`${pct(freeDelivery, sold.length)}%`} hint={`${n0(freeDelivery)} orders`} />
            <Fact
              label={charged - fees >= 0 ? "Shipping profit" : "Shipping cost to you"}
              value={taka(Math.abs(charged - fees))}
              hint={`${taka(charged)} charged · ${taka(fees)} paid`}
              warn={charged - fees < 0}
            />
          </div>
        </Card>

        <div className="flex flex-col gap-4 md:gap-6">
          <Card title="Returns" action={<Undo2Icon className="size-4 text-muted-foreground" />}>
            <div className="flex flex-col gap-3 px-4 pb-4 text-sm">
              <div className="grid grid-cols-3 gap-2">
                <Fact label="Return rate" value={`${pct(unitsBack, unitsOut)}%`} hint="of units" warn={pct(unitsBack, unitsOut) >= 10} />
                <Fact label="Value back" value={short(returnedValue)} hint={`${pct(returnedValue, grossTotal)}% of gross`} />
                <Fact label="Orders" value={n0(ordersWithReturns)} hint="with a return" />
              </div>
              {mostReturned.length > 0 && (
                <ul className="flex flex-col gap-1.5 border-t pt-2.5">
                  {mostReturned.map(([id, row]) => (
                    <li key={id} className="flex items-center gap-2">
                      <Thumb src={products.get(id)?.image} />
                      <span className="min-w-0 flex-1 truncate">{products.get(id)?.name ?? "Deleted product"}</span>
                      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                        {n0(row.returned)} of {n0(row.units + row.returned)} back
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>

          <Card title="Discounts" action={<PercentIcon className="size-4 text-muted-foreground" />}>
            <div className="grid grid-cols-2 gap-3 px-4 pb-4 text-sm">
              <Fact label="Orders with a discount" value={`${pct(discounted.length, sold.length)}%`} hint={`${n0(discounted.length)} of ${n0(sold.length)}`} />
              <Fact label="Given away" value={short(discountTotal)} hint={`${((discountTotal / (grossTotal || 1)) * 100).toFixed(1)}% of gross`} />
              <Fact label="Avg with discount" value={short(avgDiscounted)} hint="order value" />
              <Fact label="Avg without" value={short(avgPlain)} hint="order value" />
            </div>
          </Card>
        </div>
      </div>

      <Card
        title="Top customers"
        className="mx-4 lg:mx-6"
        action={
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <UsersIcon className="size-3.5" />
            top 3 bring {topShare}% of sales
          </span>
        }
      >
        <div className="grid gap-px bg-border sm:grid-cols-2 xl:grid-cols-3">
          {topCustomers.map((c, index) => (
            <div key={`${c.name}-${index}`} className="flex items-center gap-3 bg-card px-4 py-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary uppercase">{c.name.slice(0, 2)}</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="truncate font-medium">{c.name}</span>
                  {c.first && <span className="shrink-0 rounded bg-sky-50 px-1 text-[10px] font-medium text-sky-700 dark:bg-sky-950 dark:text-sky-300">New</span>}
                </span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {n0(c.orders)} {c.orders === 1 ? "order" : "orders"}
                  {c.city && ` · ${c.city}`} · last {new Date(c.last).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                </span>
              </span>
              <span className="shrink-0 text-right tabular-nums">
                <span className="block font-semibold">{short(c.value)}</span>
                <span className="block text-[11px] text-muted-foreground">{pct(c.value, net)}%</span>
              </span>
            </div>
          ))}
          {topCustomers.length === 0 && <p className="bg-card px-4 py-6 text-sm text-muted-foreground">No customers in this period.</p>}
        </div>
      </Card>

      <p className="flex items-center gap-1.5 px-4 text-xs text-muted-foreground lg:px-6">
        <GaugeIcon className="size-3.5" />
        &ldquo;On pace for&rdquo; spreads this month&apos;s sales so far over the whole month. Money in counts payments received, even if refunded later.
      </p>
    </>
  )
}
