"use client"

import Link from "next/link"
import { useState } from "react"
import { DownloadIcon, MessageCircleIcon, PhoneIcon } from "lucide-react"

import { Kpis, n0, Pill, rel, taka, type Tone } from "@/components/inventory/inventory-ui"
import { ListTable, type ListColumn, type ListFilter } from "@/components/list-table"
import { customerKey, FINISHED, localPhone, paidSoFar, whatsApp } from "@/components/orders/orders-table"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import type { Order, OrderAddress } from "@/types/order.type"

export const DAY = 86_400_000
const DELIVERED = ["DELIVERED", "COMPLETED"]
// Orders that never turned into a sale.
const LOST = ["CANCELLED", "FAILED"]

const SORTS = [
  { value: "recent", label: "Last ordered" },
  { value: "spent", label: "Most spent" },
  { value: "orders", label: "Most orders" },
  { value: "newest", label: "Newest customers" },
  { value: "name", label: "Name A–Z" },
]

export type Customer = {
  key: string
  name: string
  email: string
  phone: string | null
  account: boolean
  address: OrderAddress | null
  orders: number
  delivered: number
  finished: number
  lost: number
  ordered: number // value of orders that weren't cancelled or failed
  spent: number // money actually received
  first: string
  last: string
  lastOrder: Order
  tags: { label: string; tone: Tone; title: string }[]
}

const placed = (o: Order) => o.placedAt ?? o.createdAt

// One row per person across their orders.
export function buildCustomers(orders: Order[], addresses: Record<string, OrderAddress>) {
  // Oldest first, so the newest order's name, email and address win.
  const byKey = new Map<string, Customer>()
  for (const o of [...orders].sort((a, b) => placed(a).localeCompare(placed(b)))) {
    const key = customerKey(o)
    const c = byKey.get(key) ?? {
      key,
      name: "",
      email: "",
      phone: null,
      account: false,
      address: null,
      orders: 0,
      delivered: 0,
      finished: 0,
      lost: 0,
      ordered: 0,
      spent: 0,
      first: placed(o),
      last: placed(o),
      lastOrder: o,
      tags: [],
    }
    c.name = o.customerName || c.name || o.customerEmail
    c.email = o.customerEmail
    c.phone = o.customerPhone ?? c.phone
    c.account ||= o.userId !== null
    c.address = addresses[o.id] ?? c.address
    c.orders += 1
    if (FINISHED.includes(o.status)) c.finished += 1
    if (DELIVERED.includes(o.status)) c.delivered += 1
    if (LOST.includes(o.status)) c.lost += 1
    else c.ordered += Number(o.totalAmount)
    c.spent += paidSoFar(o)
    c.last = placed(o)
    c.lastOrder = o
    byKey.set(key, c)
  }
  return [...byKey.values()]
}

export function CustomersTable({ orders, addresses }: { orders: Order[]; addresses: Record<string, OrderAddress> }) {
  const [sort, setSort] = useState("recent")
  const now = Date.now()
  const customers = buildCustomers(orders, addresses)

  // Top tenth by money received, with at least one paid order.
  const spends = customers.map((c) => c.spent).sort((a, b) => b - a)
  const vipFrom = Math.max(1, spends[Math.floor(customers.length / 10)] ?? 0)

  const isNew = (c: Customer) => now - new Date(c.first).getTime() <= 30 * DAY
  const isLapsed = (c: Customer) => now - new Date(c.last).getTime() > 90 * DAY
  // Two or more finished orders and fewer than half of them delivered.
  const isRisky = (c: Customer) => c.finished >= 2 && c.delivered / c.finished < 0.5
  const isVip = (c: Customer) => c.spent >= vipFrom

  for (const c of customers) {
    if (isVip(c)) c.tags.push({ label: "VIP", tone: "blue", title: "Top 10% by money paid" })
    if (isNew(c)) c.tags.push({ label: "New", tone: "green", title: "First order in the last 30 days" })
    if (isRisky(c)) c.tags.push({ label: "Risky", tone: "red", title: "Fewer than half of their finished orders were delivered" })
    if (isLapsed(c)) c.tags.push({ label: "Lapsed", tone: "grey", title: "No order in 90 days" })
  }

  const sorted = [...customers].sort((a, b) => {
    if (sort === "spent") return b.spent - a.spent
    if (sort === "orders") return b.orders - a.orders || b.last.localeCompare(a.last)
    if (sort === "newest") return b.first.localeCompare(a.first)
    if (sort === "name") return a.name.localeCompare(b.name)
    return b.last.localeCompare(a.last)
  })

  const repeat = customers.filter((c) => c.orders >= 2).length
  const newCount = customers.filter(isNew).length
  const totalSpent = customers.reduce((s, c) => s + c.spent, 0)
  const paidOrders = orders.filter((o) => paidSoFar(o) > 0).length
  const finished = customers.reduce((s, c) => s + c.finished, 0)
  const delivered = customers.reduce((s, c) => s + c.delivered, 0)
  const guests = customers.filter((c) => !c.account).length
  const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0)

  function exportCsv() {
    const cell = (v: string | number) => `"${String(v).replaceAll('"', '""')}"`
    const rows = [
      ["Name", "Phone", "Email", "Account", "City", "Thana", "Orders", "Delivered", "Cancelled", "Paid", "First order", "Last order", "Tags"],
      ...sorted.map((c) => [
        c.name,
        c.phone ? localPhone(c.phone) : "",
        c.email,
        c.account ? "Account" : "Guest",
        c.address?.city ?? "",
        c.address?.thana ?? "",
        c.orders,
        c.delivered,
        c.lost,
        Math.round(c.spent),
        c.first.slice(0, 10),
        c.last.slice(0, 10),
        c.tags.map((t) => t.label).join(" "),
      ]),
    ]
    const blob = new Blob([rows.map((r) => r.map(cell).join(",")).join("\n")], { type: "text/csv" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `customers-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const columns: ListColumn<Customer>[] = [
    {
      key: "customer",
      header: "Customer",
      cell: (c) => (
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary uppercase">
            {c.name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2)}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="truncate font-medium">{c.name}</span>
              <span className="text-[11px] text-muted-foreground">{c.account ? "Account" : "Guest"}</span>
              {c.tags.map((t) => (
                <span key={t.label} title={t.title}>
                  <Pill tone={t.tone}>{t.label}</Pill>
                </span>
              ))}
            </div>
            {c.name !== c.email && <div className="truncate text-xs text-muted-foreground">{c.email}</div>}
          </div>
        </div>
      ),
    },
    {
      key: "phone",
      header: "Phone",
      className: "hidden md:table-cell",
      cell: (c) =>
        c.phone ? (
          <div className="flex items-center gap-1">
            <span className="font-mono text-xs">{localPhone(c.phone)}</span>
            <Button variant="ghost" size="icon-xs" className="text-muted-foreground" nativeButton={false} render={<a href={`tel:${localPhone(c.phone)}`} />} aria-label="Call">
              <PhoneIcon />
            </Button>
            <Button variant="ghost" size="icon-xs" className="text-muted-foreground" nativeButton={false} render={<a href={whatsApp(c.phone)} target="_blank" rel="noreferrer" />} aria-label="WhatsApp">
              <MessageCircleIcon />
            </Button>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">No phone</span>
        ),
    },
    {
      key: "location",
      header: "Location",
      className: "hidden lg:table-cell",
      cell: (c) =>
        c.address ? (
          <div className="text-sm">
            <div className="capitalize">{c.address.city}</div>
            {c.address.thana && <div className="text-xs text-muted-foreground capitalize">{c.address.thana}</div>}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      key: "orders",
      header: "Orders",
      cell: (c) => (
        <div className="text-sm">
          <div className="font-medium tabular-nums">{n0(c.orders)}</div>
          <div className="text-xs whitespace-nowrap text-muted-foreground">
            last{" "}
            <Link href={`/orders/${c.lastOrder.id}`} className="hover:text-primary hover:underline">
              {rel(c.last)}
            </Link>
          </div>
        </div>
      ),
    },
    {
      key: "delivery",
      header: "Delivered",
      className: "hidden sm:table-cell",
      cell: (c) => {
        if (c.finished === 0) return <span className="text-xs text-muted-foreground">Nothing finished yet</span>
        const rate = pct(c.delivered, c.finished)
        let bar = "bg-emerald-500"
        if (rate < 50) bar = "bg-destructive"
        else if (rate < 80) bar = "bg-amber-500"
        return (
          <div className="w-28">
            <div className="flex items-baseline justify-between text-xs">
              <span className={cn("font-semibold tabular-nums", rate < 50 && "text-destructive")}>{rate}%</span>
              <span className="text-muted-foreground tabular-nums">
                {c.delivered} of {c.finished}
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className={cn("h-full rounded-full", bar)} style={{ width: `${rate}%` }} />
            </div>
          </div>
        )
      },
    },
    {
      key: "spent",
      header: "Paid",
      className: "text-right",
      cell: (c) => (
        <div className="text-right">
          <div className="font-semibold tabular-nums">{taka(c.spent)}</div>
          {c.ordered > c.spent && <div className="text-xs text-muted-foreground tabular-nums">of {taka(c.ordered)} ordered</div>}
        </div>
      ),
    },
  ]

  return (
    <>
      <Kpis
        items={[
          { label: "Customers", value: n0(customers.length), hint: `${n0(newCount)} new in 30 days` },
          { label: "Repeat customers", value: `${pct(repeat, customers.length)}%`, hint: `${n0(repeat)} ordered twice or more` },
          { label: "Paid per customer", value: taka(customers.length ? totalSpent / customers.length : 0), hint: `${taka(totalSpent)} in all` },
          { label: "Average order", value: taka(paidOrders ? totalSpent / paidOrders : 0), hint: `over ${n0(paidOrders)} paid orders` },
          { label: "Delivery success", value: `${pct(delivered, finished)}%`, hint: `${n0(delivered)} of ${n0(finished)} finished orders`, warn: pct(delivered, finished) < 70 },
          { label: "Guests", value: `${pct(guests, customers.length)}%`, hint: `${n0(guests)} without an account` },
        ]}
      />
      <ListTable
        rows={sorted}
        columns={columns}
        getRowId={(c) => c.key}
        searchText={(c) => `${c.name} ${c.email} ${c.phone ? localPhone(c.phone) : ""} ${c.address?.city ?? ""} ${c.address?.thana ?? ""}`}
        searchPlaceholder="Search name, phone, email, city..."
        filters={([
          { label: "All", value: "all", match: () => true },
          { label: "Repeat", value: "repeat", match: (c) => c.orders >= 2 },
          { label: "VIP", value: "vip", match: isVip },
          { label: "New", value: "new", match: isNew },
          { label: "Lapsed", value: "lapsed", match: isLapsed },
          { label: "Risky", value: "risky", match: isRisky },
          { label: "Guests", value: "guests", match: (c) => !c.account },
        ] as ListFilter<Customer>[]).filter((f, index) => index === 0 || customers.some(f.match))}
        emptyText={customers.length === 0 ? "No customers yet. They appear here after their first order." : "No customers match your search."}
        toolbar={
          <>
            <Select value={sort} items={SORTS} onValueChange={(v) => setSort(v as string)}>
              <SelectTrigger size="sm" aria-label="Sort customers" className="hidden w-40 sm:flex"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SORTS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={exportCsv} disabled={customers.length === 0}>
              <DownloadIcon data-icon="inline-start" />
              Export
            </Button>
          </>
        }
      />
    </>
  )
}
