"use client"

import Link from "next/link"
import { useState } from "react"
import { toast } from "sonner"
import {
  BanknoteIcon,
  ChevronRightIcon,
  CircleCheckIcon,
  ExternalLinkIcon,
  PackageCheckIcon,
  PackageOpenIcon,
  ReceiptIcon,
  TriangleAlertIcon,
  TruckIcon,
} from "lucide-react"

import { updateShipmentStatus } from "@/app/actions/order.actions"
import { Card, fmtDate, Kpis, label, n0, Pill, rel, taka } from "@/components/inventory/inventory-ui"
import { ListTable, type ListColumn } from "@/components/list-table"
import { SHIPMENT_DONE, shipmentStatusItems, TONE } from "@/components/orders/order-detail"
import { CARRIER_LABEL, ORDER_STATUS_LABEL } from "@/components/orders/orders-table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import type { CourierCarrier, Order, Shipment, ShipmentStatus } from "@/types/order.type"

const DAY = 86_400_000
const TO_PACK = ["CONFIRMED", "PROCESSING"]
const ON_THE_ROAD: ShipmentStatus[] = ["SHIPPED", "IN_TRANSIT", "OUT_FOR_DELIVERY"]
const PROBLEM: ShipmentStatus[] = ["FAILED", "RETURNED"]
// Booked but not yet with the courier, or on the way: the courier may still collect cash.
const COLLECTING: ShipmentStatus[] = ["PENDING", "PROCESSING", ...ON_THE_ROAD]
const CARRIERS = Object.keys(CARRIER_LABEL) as CourierCarrier[]
// The parcel's road from booking to the door.
const PIPELINE: { text: string; statuses: ShipmentStatus[] }[] = [
  { text: "Booked", statuses: ["PENDING", "PROCESSING"] },
  { text: "Picked up", statuses: ["SHIPPED"] },
  { text: "In transit", statuses: ["IN_TRANSIT"] },
  { text: "Out for delivery", statuses: ["OUT_FOR_DELIVERY"] },
  { text: "Delivered", statuses: ["DELIVERED"] },
]

type Parcel = { shipment: Shipment; order: Order }

const units = (o: Order) => o.items.reduce((s, i) => s + i.quantity, 0)
const isCod = (o: Order) => o.payments.some((p) => p.provider === "COD") && !o.payments.some((p) => p.status === "PAID")
const deliveryDays = (s: Shipment) =>
  s.shippedAt && s.deliveredAt ? (new Date(s.deliveredAt).getTime() - new Date(s.shippedAt).getTime()) / DAY : null

function average(values: number[]) {
  if (values.length === 0) return null
  return values.reduce((s, v) => s + v, 0) / values.length
}

function daysText(days: number | null) {
  if (days === null) return "—"
  return `${days.toFixed(1)} days`
}

export function ShippingBoard({ orders, destinations }: { orders: Order[]; destinations: Record<string, string> }) {
  const [busy, setBusy] = useState<string | null>(null)

  const waiting = orders.filter((o) => TO_PACK.includes(o.status) || o.status === "READY_TO_SHIP")
  const parcels: Parcel[] = orders
    .flatMap((order) => order.shipments.map((shipment) => ({ shipment, order })))
    .sort((a, b) => b.shipment.createdAt.localeCompare(a.shipment.createdAt))

  const since = Date.now() - 30 * DAY
  const delivered30 = parcels.filter((p) => p.shipment.deliveredAt && new Date(p.shipment.deliveredAt).getTime() >= since)
  const onTheRoad = parcels.filter((p) => ON_THE_ROAD.includes(p.shipment.status))
  const problems = parcels.filter((p) => PROBLEM.includes(p.shipment.status))
  const collecting = parcels.filter((p) => COLLECTING.includes(p.shipment.status) && Number(p.shipment.codAmount) > 0)
  const cashToCollect = collecting.reduce((s, p) => s + Number(p.shipment.codAmount), 0)
  const age = (iso: string) => (Date.now() - new Date(iso).getTime()) / DAY

  // Delivered cash-on-delivery parcels: the courier has the money until the order's payment is marked paid.
  const deliveredCod = parcels.filter((p) => p.shipment.status === "DELIVERED" && Number(p.shipment.codAmount) > 0)
  const withCouriers = deliveredCod.filter((p) => !p.order.payments.some((pay) => pay.status === "PAID"))
  const settled = deliveredCod.filter((p) => p.order.payments.some((pay) => pay.status === "PAID"))
  const sumCod = (list: Parcel[]) => list.reduce((s, p) => s + Number(p.shipment.codAmount), 0)

  // Shipping money over the last 30 days: what customers paid for delivery and what couriers charged.
  const booked30 = parcels.filter((p) => new Date(p.shipment.createdAt).getTime() >= since)
  const courierCost = booked30.reduce((s, p) => s + Number(p.shipment.shippingAmount), 0)
  const charged = [...new Set(booked30.map((p) => p.order))].reduce((s, o) => s + Number(o.shippingAmount), 0)

  const attention: { text: string; detail: string; href: string; tone: "red" | "amber" }[] = [
    ...waiting
      .filter((o) => o.status === "READY_TO_SHIP" && o.shipments.length === 0)
      .map((o) => ({ text: `${o.orderNumber} is ready but has no parcel`, detail: "Book it with a courier", href: `/orders/${o.id}`, tone: "amber" as const })),
    ...waiting
      .filter((o) => TO_PACK.includes(o.status) && age(o.placedAt ?? o.createdAt) > 2)
      .map((o) => ({ text: `${o.orderNumber} waiting ${rel(o.placedAt ?? o.createdAt).replace(" ago", "")}`, detail: "Not packed yet", href: `/orders/${o.id}`, tone: "amber" as const })),
    ...parcels
      .filter((p) => ["PENDING", "PROCESSING"].includes(p.shipment.status) && age(p.shipment.createdAt) > 1)
      .map((p) => ({ text: `${p.order.orderNumber} not picked up`, detail: `Booked with ${CARRIER_LABEL[p.shipment.carrier]} ${rel(p.shipment.createdAt)}`, href: `/orders/${p.order.id}`, tone: "amber" as const })),
    ...onTheRoad
      .filter((p) => p.shipment.shippedAt && age(p.shipment.shippedAt) > 3)
      .map((p) => ({ text: `${p.order.orderNumber} on the road ${rel(p.shipment.shippedAt!).replace(" ago", "")}`, detail: `${CARRIER_LABEL[p.shipment.carrier]} · ${label(p.shipment.status)}`, href: `/orders/${p.order.id}`, tone: "amber" as const })),
    ...problems.map((p) => ({ text: `${p.order.orderNumber} ${label(p.shipment.status).toLowerCase()}`, detail: `${CARRIER_LABEL[p.shipment.carrier]} · follow up with the customer`, href: `/orders/${p.order.id}`, tone: "red" as const })),
  ]

  async function setStatus(p: Parcel, status: ShipmentStatus) {
    setBusy(p.shipment.id)
    const res = await updateShipmentStatus(p.order.id, p.shipment.id, status)
    setBusy(null)
    if (!res.success) return toast.error(res.error)
    toast.success(`${p.order.orderNumber}: parcel is now ${label(status).toLowerCase()}`)
  }

  const queueColumns: ListColumn<Order>[] = [
    {
      key: "order",
      header: "Order",
      cell: (o) => (
        <Link href={`/orders/${o.id}`} className="group block">
          <span className="font-medium group-hover:text-primary group-hover:underline">{o.orderNumber}</span>
          <span className="block text-xs text-muted-foreground">{o.customerName ?? o.customerEmail}</span>
        </Link>
      ),
    },
    { key: "to", header: "Ship to", className: "hidden md:table-cell", cell: (o) => destinations[o.id] ?? <span className="text-muted-foreground">No address</span> },
    {
      key: "items",
      header: "Items",
      className: "hidden lg:table-cell",
      cell: (o) => (
        <span className="text-muted-foreground">
          {o.items[0]?.productName}
          {o.items.length > 1 && ` +${o.items.length - 1}`} · {n0(units(o))} {units(o) === 1 ? "unit" : "units"}
        </span>
      ),
    },
    {
      key: "payment",
      header: "Payment",
      cell: (o) => (isCod(o) ? <Pill tone="amber">Collect {taka(Number(o.totalAmount))}</Pill> : <Pill tone="green">Paid</Pill>),
    },
    { key: "status", header: "Stage", cell: (o) => <Pill tone={o.status === "READY_TO_SHIP" ? "blue" : "grey"}>{ORDER_STATUS_LABEL[o.status]}</Pill> },
    {
      key: "parcel",
      header: "Parcel",
      className: "hidden sm:table-cell",
      cell: (o) => {
        const s = o.shipments.at(-1)
        if (!s) return <span className="text-muted-foreground">Not booked</span>
        return (
          <span className="flex flex-col">
            <span className="font-medium">{CARRIER_LABEL[s.carrier] ?? s.carrier}</span>
            <span className="font-mono text-[11px] text-muted-foreground">{s.trackingNumber ?? s.consignmentId ?? "No tracking yet"}</span>
          </span>
        )
      },
    },
    {
      key: "waiting",
      header: "Waiting",
      className: "text-right whitespace-nowrap",
      cell: (o) => {
        const placed = o.placedAt ?? o.createdAt
        const old = Date.now() - new Date(placed).getTime() > 2 * DAY
        return <span className={cn("text-muted-foreground", old && "font-medium text-amber-700 dark:text-amber-400")}>{rel(placed).replace(" ago", "")}</span>
      },
    },
  ]

  const parcelColumns: ListColumn<Parcel>[] = [
    {
      key: "parcel",
      header: "Parcel",
      cell: ({ shipment: s }) => (
        <span className="flex items-center gap-2.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-[11px] font-bold text-muted-foreground">
            {(CARRIER_LABEL[s.carrier] ?? s.carrier).slice(0, 2).toUpperCase()}
          </span>
          <span className="min-w-0">
            <span className="block font-medium">
              {CARRIER_LABEL[s.carrier] ?? s.carrier}
              {s.service && <span className="font-normal text-muted-foreground"> · {s.service}</span>}
            </span>
            {s.trackingUrl ? (
              <a href={s.trackingUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono text-[11px] text-primary hover:underline">
                {s.trackingNumber ?? "Track"} <ExternalLinkIcon className="size-3" />
              </a>
            ) : (
              <span className="block font-mono text-[11px] text-muted-foreground">{s.trackingNumber ?? s.consignmentId ?? "No tracking"}</span>
            )}
          </span>
        </span>
      ),
    },
    {
      key: "order",
      header: "Order",
      cell: ({ order: o }) => (
        <Link href={`/orders/${o.id}`} className="group block">
          <span className="font-medium group-hover:text-primary group-hover:underline">{o.orderNumber}</span>
          <span className="block text-xs text-muted-foreground">{o.customerName ?? o.customerEmail}</span>
        </Link>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (p) => {
        if (SHIPMENT_DONE.includes(p.shipment.status)) return <Pill tone={TONE[p.shipment.status] ?? "grey"}>{label(p.shipment.status)}</Pill>
        return (
          <Select value={p.shipment.status} items={shipmentStatusItems} onValueChange={(v) => setStatus(p, v as ShipmentStatus)} disabled={busy !== null}>
            <SelectTrigger size="sm" aria-label={`Status of ${p.order.orderNumber}'s parcel`} className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {shipmentStatusItems.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        )
      },
    },
    {
      key: "cod",
      header: "Collect",
      className: "hidden text-right tabular-nums md:table-cell",
      cell: ({ shipment: s }) => (Number(s.codAmount) > 0 ? taka(Number(s.codAmount)) : <span className="text-muted-foreground">—</span>),
    },
    { key: "charge", header: "Charge", className: "hidden text-right tabular-nums lg:table-cell", cell: ({ shipment: s }) => <span className="text-muted-foreground">{taka(Number(s.shippingAmount))}</span> },
    {
      key: "dates",
      header: "Timeline",
      className: "hidden whitespace-nowrap xl:table-cell",
      cell: ({ shipment: s }) => (
        <span className="flex flex-col text-xs text-muted-foreground">
          <span>Booked {fmtDate(s.createdAt)}</span>
          {s.shippedAt && <span>Shipped {fmtDate(s.shippedAt)}</span>}
          {s.deliveredAt && <span className="text-emerald-700 dark:text-emerald-400">Delivered {fmtDate(s.deliveredAt)}</span>}
        </span>
      ),
    },
  ]

  return (
    <>
      {parcels.length === 0 && (
        <p className="mx-4 flex items-start gap-2.5 rounded-xl border border-dashed bg-card px-4 py-3 text-[13px] text-muted-foreground lg:mx-6">
          <PackageCheckIcon className="mt-0.5 size-4 shrink-0" />
          <span>
            Parcels are booked on each order: open an order that’s confirmed, use <strong className="font-semibold text-foreground">Add shipment</strong> to record
            the courier and tracking, then follow it here.
          </span>
        </p>
      )}
      <Kpis
        items={[
          { label: "To pack", value: n0(waiting.filter((o) => TO_PACK.includes(o.status)).length), hint: "confirmed or being packed" },
          { label: "Ready to hand over", value: n0(waiting.filter((o) => o.status === "READY_TO_SHIP").length), hint: "waiting for the courier" },
          { label: "On the road", value: n0(onTheRoad.length), hint: `${n0(onTheRoad.filter((p) => p.shipment.status === "OUT_FOR_DELIVERY").length)} out for delivery` },
          { label: "Delivered", value: n0(delivered30.length), hint: `last 30 days · avg ${daysText(average(delivered30.flatMap((p) => deliveryDays(p.shipment) ?? [])))}` },
          { label: "Cash to collect", value: taka(cashToCollect), hint: `on ${n0(collecting.length)} ${collecting.length === 1 ? "parcel" : "parcels"}` },
          { label: "Problems", value: n0(problems.length), hint: "failed or returned", warn: problems.length > 0 },
        ]}
      />

      <section className="mx-4 lg:mx-6">
        {/* The 1px gap over a border-colored background draws the dividers. */}
        <ol className="grid grid-cols-3 gap-px overflow-hidden rounded-2xl border bg-border md:grid-cols-6">
          {PIPELINE.map((stage, index) => {
            const count = parcels.filter((p) => stage.statuses.includes(p.shipment.status)).length
            return (
              <li key={stage.text} className="flex items-center gap-3 bg-card px-4 py-3.5">
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-muted-foreground">
                    <span className="mr-1.5 font-mono text-[10px] text-muted-foreground/70">{index + 1}</span>
                    {stage.text}
                  </div>
                  <div className={cn("text-xl font-bold tabular-nums", count === 0 && "text-muted-foreground/50")}>{n0(count)}</div>
                </div>
                {index < PIPELINE.length - 1 && <ChevronRightIcon className="hidden size-4 shrink-0 text-muted-foreground/40 md:block" />}
              </li>
            )
          })}
          <li className="flex items-center gap-3 bg-red-50 px-4 py-3.5 dark:bg-red-950">
            <div>
              <div className="text-xs text-red-700 dark:text-red-300">Failed or returned</div>
              <div className={cn("text-xl font-bold tabular-nums", problems.length ? "text-red-700 dark:text-red-300" : "text-muted-foreground/50")}>{n0(problems.length)}</div>
            </div>
          </li>
        </ol>
      </section>

      <div className="grid items-start gap-4 px-4 md:gap-6 lg:px-6 xl:grid-cols-3">
        <Card title="Needs attention" className="xl:col-span-2" action={attention.length > 0 && <Pill tone="amber">{n0(attention.length)} to check</Pill>}>
          {attention.length === 0 ? (
            <p className="flex items-center gap-2 px-4 pb-4 text-sm text-muted-foreground">
              <CircleCheckIcon className="size-4 text-emerald-600" />
              Nothing is stuck: every order is moving.
            </p>
          ) : (
            <ul className="flex flex-col">
              {attention.slice(0, 8).map((a) => (
                <li key={a.text}>
                  <Link href={a.href} className="flex items-center gap-3 border-t border-border/60 px-4 py-2.5 text-sm hover:bg-muted/40">
                    <TriangleAlertIcon className={cn("size-4 shrink-0", a.tone === "red" ? "text-destructive" : "text-amber-600")} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{a.text}</span>
                      <span className="block truncate text-xs text-muted-foreground">{a.detail}</span>
                    </span>
                    <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              ))}
              {attention.length > 8 && <li className="border-t px-4 py-2 text-xs text-muted-foreground">And {n0(attention.length - 8)} more.</li>}
            </ul>
          )}
        </Card>

        <div className="flex flex-col gap-4 md:gap-6">
          <Card title="Cash on delivery" action={<BanknoteIcon className="size-4 text-muted-foreground" />}>
            <dl className="flex flex-col gap-2.5 px-4 pb-4 text-sm">
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-muted-foreground">To collect</dt>
                <dd className="font-semibold tabular-nums">
                  {taka(cashToCollect)} <span className="text-xs font-normal text-muted-foreground">· {n0(collecting.length)}</span>
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-muted-foreground">Held by couriers</dt>
                <dd className={cn("font-semibold tabular-nums", withCouriers.length > 0 && "text-amber-700 dark:text-amber-400")}>
                  {taka(sumCod(withCouriers))} <span className="text-xs font-normal text-muted-foreground">· {n0(withCouriers.length)}</span>
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-muted-foreground">Settled</dt>
                <dd className="font-semibold text-emerald-700 tabular-nums dark:text-emerald-400">
                  {taka(sumCod(settled))} <span className="text-xs font-normal text-muted-foreground">· {n0(settled.length)}</span>
                </dd>
              </div>
              <p className="border-t pt-2.5 text-xs text-muted-foreground">
                Held by couriers = delivered, but the order’s payment isn’t marked paid yet. Mark it paid on the order once the courier pays out.
              </p>
            </dl>
          </Card>

          <Card title="Shipping costs" action={<span className="text-xs text-muted-foreground">last 30 days</span>}>
            <dl className="flex flex-col gap-2.5 px-4 pb-4 text-sm">
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-muted-foreground">Charged to customers</dt>
                <dd className="font-semibold tabular-nums">{taka(charged)}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-muted-foreground">Paid to couriers</dt>
                <dd className="font-semibold tabular-nums">{taka(courierCost)}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-2 border-t pt-2.5">
                <dt className="flex items-center gap-1.5 font-medium">
                  <ReceiptIcon className="size-3.5 text-muted-foreground" />
                  {charged - courierCost >= 0 ? "Shipping profit" : "Shipping cost to you"}
                </dt>
                <dd className={cn("font-bold tabular-nums", charged - courierCost < 0 && "text-destructive")}>{taka(Math.abs(charged - courierCost))}</dd>
              </div>
              <p className="text-xs text-muted-foreground">
                {n0(booked30.length)} {booked30.length === 1 ? "parcel" : "parcels"} booked · avg {taka(booked30.length ? courierCost / booked30.length : 0)} each
              </p>
            </dl>
          </Card>
        </div>
      </div>

      <section className="grid gap-4 px-4 sm:grid-cols-2 lg:px-6 xl:grid-cols-4">
        {CARRIERS.map((carrier) => {
          const mine = parcels.filter((p) => p.shipment.carrier === carrier)
          const road = mine.filter((p) => ON_THE_ROAD.includes(p.shipment.status)).length
          const done = mine.filter((p) => p.shipment.status === "DELIVERED")
          const bad = mine.filter((p) => PROBLEM.includes(p.shipment.status)).length
          const cod = mine.filter((p) => COLLECTING.includes(p.shipment.status)).reduce((s, p) => s + Number(p.shipment.codAmount ?? 0), 0)
          const success = done.length + bad > 0 ? Math.round((done.length / (done.length + bad)) * 100) : null
          return (
            <div key={carrier} className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
              <div className="flex items-center gap-2.5">
                <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-xs font-bold text-primary">{CARRIER_LABEL[carrier].slice(0, 2).toUpperCase()}</span>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{CARRIER_LABEL[carrier]}</div>
                  <div className="text-xs text-muted-foreground">
                    {n0(mine.length)} {mine.length === 1 ? "parcel" : "parcels"}
                    {success !== null && (
                      <span className={cn("font-medium", success >= 90 ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400")}>
                        {" "}· {success}% delivered
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">On the road</dt>
                  <dd className="font-semibold tabular-nums">{n0(road)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Delivered</dt>
                  <dd className="font-semibold tabular-nums">{n0(done.length)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Cash to collect</dt>
                  <dd className="font-semibold tabular-nums">{taka(cod)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Avg delivery</dt>
                  <dd className="font-semibold tabular-nums">{daysText(average(done.flatMap((p) => deliveryDays(p.shipment) ?? [])))}</dd>
                </div>
              </dl>
              {bad > 0 && (
                <p className="flex items-center gap-1.5 text-xs font-medium text-destructive">
                  <TriangleAlertIcon className="size-3.5" />
                  {n0(bad)} failed or returned
                </p>
              )}
            </div>
          )
        })}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2 px-4 lg:px-6">
          <PackageOpenIcon className="size-4 text-muted-foreground" />
          <h2 className="font-semibold">Fulfilment queue</h2>
          <Pill tone="grey">{n0(waiting.length)}</Pill>
          <span className="hidden text-sm text-muted-foreground sm:inline">Orders to pack and hand to a courier, oldest waiting first</span>
        </div>
        <ListTable
          rows={[...waiting].sort((a, b) => (a.placedAt ?? a.createdAt).localeCompare(b.placedAt ?? b.createdAt))}
          columns={queueColumns}
          getRowId={(o) => o.id}
          searchText={(o) => `${o.orderNumber} ${o.customerName ?? ""} ${o.customerEmail} ${destinations[o.id] ?? ""}`}
          searchPlaceholder="Search orders..."
          filters={[
            { label: "All", value: "all", match: () => true },
            { label: "To pack", value: "pack", match: (o) => TO_PACK.includes(o.status) },
            { label: "Ready to ship", value: "ready", match: (o) => o.status === "READY_TO_SHIP" },
            { label: "No parcel booked", value: "unbooked", match: (o) => o.shipments.length === 0 },
          ]}
          emptyText="Nothing to pack. New orders show up here once they're confirmed."
        />
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2 px-4 lg:px-6">
          <TruckIcon className="size-4 text-muted-foreground" />
          <h2 className="font-semibold">Shipments</h2>
          <Pill tone="grey">{n0(parcels.length)}</Pill>
          <span className="hidden text-sm text-muted-foreground sm:inline">Every parcel booked with a courier</span>
        </div>
        <ListTable
          rows={parcels}
          columns={parcelColumns}
          getRowId={(p) => p.shipment.id}
          searchText={({ shipment: s, order: o }) =>
            `${o.orderNumber} ${o.customerName ?? ""} ${o.customerEmail} ${s.trackingNumber ?? ""} ${s.consignmentId ?? ""} ${CARRIER_LABEL[s.carrier] ?? ""}`
          }
          searchPlaceholder="Search tracking, order or customer..."
          filters={[
            { label: "Active", value: "active", match: (p) => !SHIPMENT_DONE.includes(p.shipment.status) && p.shipment.status !== "FAILED" },
            { label: "Delivered", value: "delivered", match: (p) => p.shipment.status === "DELIVERED" },
            { label: "Problems", value: "problems", match: (p) => PROBLEM.includes(p.shipment.status) },
            { label: "All", value: "all", match: () => true },
          ]}
          emptyText="No parcels here. Book one from an order's Shipments card."
        />
      </section>

    </>
  )
}
