"use client"

import Link from "next/link"
import { useState } from "react"
import { toast } from "sonner"
import {
  ArrowLeftIcon,
  CheckIcon,
  CircleXIcon,
  CopyIcon,
  ExternalLinkIcon,
  MailIcon,
  MapPinIcon,
  PackageIcon,
  PhoneIcon,
  TruckIcon,
} from "lucide-react"

import { cancelOrder, createShipment, markPaymentPaid, updateOrderStatus } from "@/app/actions/order.actions"
import { Card, fmtDate, fmtDateTime, Kpis, label, n0, Pill, RackTag, rel, taka, type Tone, WarehouseTag } from "@/components/inventory/inventory-ui"
import { MovementQuantity, MovementTag, movementRacks } from "@/components/inventory/movements-table"
import { ORDER_STATUS_LABEL, PAYMENT_LABEL } from "@/components/orders/orders-table"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import type { LedgerMovement, StockLevel, VariantStockDetail } from "@/types/inventory.type"
import type { Order, OrderAddress, OrderDetail, OrderStatus } from "@/types/order.type"

// The next step on the happy path, as the backend allows it (ORDER_STATUS_TRANSITIONS).
const NEXT: Partial<Record<OrderStatus, { status: OrderStatus; text: string }>> = {
  PENDING: { status: "CONFIRMED", text: "Confirm order" },
  CONFIRMED: { status: "PROCESSING", text: "Start processing" },
  PROCESSING: { status: "READY_TO_SHIP", text: "Ready to ship" },
  READY_TO_SHIP: { status: "SHIPPED", text: "Mark shipped" },
  SHIPPED: { status: "DELIVERED", text: "Mark delivered" },
  DELIVERED: { status: "COMPLETED", text: "Complete order" },
}
const STEPS: OrderStatus[] = ["PENDING", "CONFIRMED", "PROCESSING", "READY_TO_SHIP", "SHIPPED", "DELIVERED", "COMPLETED"]
const STEP_LABEL: Partial<Record<OrderStatus, string>> = { PENDING: "Placed" }
const CANCELLABLE: OrderStatus[] = ["PENDING", "CONFIRMED", "PROCESSING", "READY_TO_SHIP"]
const STOPPED: OrderStatus[] = ["CANCELLED", "FAILED", "REFUNDED"]
const OPEN_PAYMENT = ["PENDING", "PROCESSING"]
// Shipment, payment and refund statuses that finished well or badly; the rest are in progress.
const TONE: Record<string, Tone> = {
  DELIVERED: "green", PAID: "green", APPROVED: "green",
  FAILED: "red", RETURNED: "red", CANCELLED: "red", REJECTED: "red",
}

const sumPaid = (o: Pick<Order, "payments">) => o.payments.filter((p) => p.status === "PAID").reduce((s, p) => s + Number(p.amount), 0)

function stockTone(l: StockLevel, threshold: number) {
  if (l.available <= 0) return "bad"
  if (l.available <= threshold) return "warn"
  return undefined
}

function Address({ address }: { address: OrderAddress }) {
  const name = [address.firstName, address.lastName].filter(Boolean).join(" ")
  return (
    <address className="text-sm leading-relaxed not-italic">
      {name && <div className="font-medium">{name}</div>}
      {address.company && <div>{address.company}</div>}
      <div className="text-muted-foreground">
        {address.addressLine1}
        {address.addressLine2 && <>, {address.addressLine2}</>}
        <br />
        {[address.city, address.state, address.postalCode].filter(Boolean).join(", ")} · {address.country}
      </div>
      {address.phone && <div className="text-muted-foreground">{address.phone}</div>}
    </address>
  )
}

export function OrderDetailPage({
  order,
  images,
  stock,
  movements,
  history,
}: {
  order: OrderDetail
  images: Record<string, string>
  stock: Record<string, VariantStockDetail>
  movements: LedgerMovement[]
  history: Order[]
}) {
  const [busy, setBusy] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [shipping, setShipping] = useState(false)

  const next = NEXT[order.status]
  const stopped = STOPPED.includes(order.status)
  const units = order.items.reduce((s, i) => s + i.quantity, 0)
  const total = Number(order.totalAmount)
  const paid = sumPaid(order)
  const due = total - paid
  const logs = [...order.statusLogs].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const reachedAt = new Map(logs.map((l) => [l.toStatus, l.createdAt]))
  const lastLog = logs.at(-1)
  const canShip = ["CONFIRMED", "PROCESSING", "READY_TO_SHIP"].includes(order.status)
  const payment = order.payments.find((p) => p.status === "PAID") ?? order.payments.at(-1)
  const placedAt = order.placedAt ?? order.createdAt
  // Item promotions live on each line; order-level discounts (codes) in `discounts`.
  const promotions = [
    ...new Set([
      ...order.items.flatMap((i) => (i.metadata?.appliedPromotion ? [i.metadata.appliedPromotion.name] : [])),
      ...order.discounts.map((d) => d.promotionName),
    ]),
  ]

  const shippingAddress = order.addresses.find((a) => a.type === "SHIPPING")
  const billing = order.addresses.find((a) => a.type === "BILLING")
  // Checkout copies the shipping address into billing when the customer gives only one.
  const sameAddress = (a: OrderAddress, b: OrderAddress) =>
    a.addressLine1 === b.addressLine1 && a.addressLine2 === b.addressLine2 && a.city === b.city && a.postalCode === b.postalCode && a.firstName === b.firstName
  let billingAddress = billing
  if (billing && shippingAddress && sameAddress(billing, shippingAddress)) billingAddress = undefined

  // What the goods cost us, from each variant's unit cost where its stock was valued.
  let cost = 0
  let costKnown = true
  for (const i of order.items) {
    const level = i.variantId ? stock[i.variantId]?.levels.find((l) => Number(l.unitCost) > 0) : undefined
    if (level) cost += Number(level.unitCost) * i.quantity
    else costKnown = false
  }
  const net = Number(order.subtotalAmount) - Number(order.discountAmount)
  let costHint = "unit cost not recorded"
  if (costKnown && net > 0) costHint = `${Math.round(((net - cost) / net) * 100)}% margin · ${taka(net - cost)} profit`

  // The customer's orders, matched by email; cancelled ones don't count as spent.
  const others = history.filter((o) => o.id !== order.id)
  const kept = history.filter((o) => !STOPPED.includes(o.status))
  const spent = kept.reduce((s, o) => s + Number(o.totalAmount), 0)
  const firstOrder = history.reduce((first, o) => (o.createdAt < first ? o.createdAt : first), order.createdAt)

  async function advance() {
    if (!next) return
    setBusy(true)
    const res = await updateOrderStatus(order.id, next.status)
    setBusy(false)
    if (!res.success) return toast.error(res.error)
    toast.success(`Order is now ${ORDER_STATUS_LABEL[next.status].toLowerCase()}`)
  }

  async function markPaid(paymentId: string) {
    setBusy(true)
    const res = await markPaymentPaid(order.id, paymentId)
    setBusy(false)
    if (!res.success) return toast.error(res.error)
    toast.success("Payment marked as paid")
  }

  async function copyNumber() {
    await navigator.clipboard.writeText(order.orderNumber)
    toast.success("Order number copied")
  }

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <header className="flex flex-wrap items-center gap-4 px-4 lg:px-6">
        <Button variant="ghost" size="icon" className="size-8 text-muted-foreground" nativeButton={false} render={<Link href="/orders" />}>
          <ArrowLeftIcon />
          <span className="sr-only">All orders</span>
        </Button>
        <div className="flex min-w-0 flex-1 basis-64 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{order.orderNumber}</h1>
            <Button variant="ghost" size="icon-sm" className="text-muted-foreground" onClick={copyNumber}>
              <CopyIcon />
              <span className="sr-only">Copy order number</span>
            </Button>
            <StatusBadge status={ORDER_STATUS_LABEL[order.status]} />
            {payment && <Pill tone={TONE[payment.status] ?? "amber"}>{payment.status === "PAID" ? "Paid" : `Payment ${PAYMENT_LABEL[payment.status].toLowerCase()}`}</Pill>}
          </div>
          <p className="text-sm text-muted-foreground">
            Placed {fmtDateTime(placedAt)} ({rel(placedAt)}){payment && ` · ${label(payment.method)}`} · {order.userId ? "Account" : "Guest checkout"}
          </p>
        </div>
        <div className="flex gap-2">
          {CANCELLABLE.includes(order.status) && (
            <Button variant="outline" size="sm" className="text-destructive" onClick={() => setCancelling(true)} disabled={busy}>
              Cancel order
            </Button>
          )}
          {next && (
            <Button size="sm" onClick={advance} disabled={busy}>
              {next.text}
            </Button>
          )}
        </div>
      </header>

      {stopped ? (
        <div className="mx-4 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 lg:mx-6 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          <CircleXIcon className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-semibold">
              {ORDER_STATUS_LABEL[order.status]} on {fmtDateTime(order.cancelledAt ?? lastLog?.createdAt ?? order.updatedAt)}
            </p>
            {lastLog?.note && <p>Reason: {lastLog.note}</p>}
          </div>
        </div>
      ) : (
        <section className="mx-4 overflow-x-auto rounded-2xl border bg-card px-4 py-4 lg:mx-6">
          <ol className="flex min-w-[640px] items-start">
            {STEPS.map((step, index) => {
              const at = reachedAt.get(step)
              const current = order.status === step
              const done = at !== undefined || STEPS.indexOf(order.status) >= index
              return (
                <li key={step} className="relative flex flex-1 flex-col items-center gap-1.5 text-center">
                  {index > 0 && <span className={cn("absolute top-3 right-1/2 h-0.5 w-full -translate-y-1/2", done ? "bg-primary" : "bg-border")} aria-hidden />}
                  <span
                    className={cn(
                      "relative z-10 grid size-6 place-items-center rounded-full border-2 bg-card text-[11px] font-bold",
                      done && "border-primary bg-primary text-primary-foreground",
                      current && "ring-4 ring-primary/20",
                      !done && "border-border text-muted-foreground"
                    )}
                  >
                    {done ? <CheckIcon className="size-3.5" strokeWidth={3} /> : index + 1}
                  </span>
                  <span className={cn("text-xs font-medium", !done && "text-muted-foreground")}>{STEP_LABEL[step] ?? ORDER_STATUS_LABEL[step]}</span>
                  <span className="text-[11px] text-muted-foreground">{at ? fmtDateTime(at) : "—"}</span>
                </li>
              )
            })}
          </ol>
        </section>
      )}

      <Kpis
        items={[
          { label: "Order total", value: taka(total), hint: `${n0(units)} ${units === 1 ? "unit" : "units"} in ${order.items.length} ${order.items.length === 1 ? "line" : "lines"}` },
          { label: "Paid", value: taka(paid), hint: due > 0 && !stopped ? `${taka(due)} still due` : "nothing due", warn: due > 0 && !stopped },
          { label: "Discount", value: taka(Number(order.discountAmount)), hint: promotions.join(", ") || "no promotion" },
          { label: "Cost of goods", value: costKnown ? taka(cost) : "—", hint: costHint },
          { label: "Customer orders", value: n0(history.length), hint: `${taka(spent)} spent in total` },
          { label: "Shipments", value: n0(order.shipments.length), hint: order.shipments[0] ? label(order.shipments[0].status) : "not shipped yet" },
        ]}
      />

      <div className="grid gap-4 px-4 md:gap-6 lg:px-6 xl:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-4 md:gap-6 xl:col-span-2">
          <Card title="Items" action={<span className="hidden text-xs text-muted-foreground sm:inline">Available stock and pick rack right now</span>}>
            <ul className="flex flex-col">
              {order.items.map((i) => {
                const image = i.productId ? images[i.productId] : undefined
                const discount = Number(i.discountAmount)
                const variant = i.variantId ? stock[i.variantId] : undefined
                return (
                  <li key={i.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border/60 px-4 py-3.5">
                    <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-xl border bg-muted/60 text-muted-foreground">
                      {image ? (
                        // eslint-disable-next-line @next/next/no-img-element -- any image host is allowed
                        <img src={image} alt="" className="size-full object-cover" />
                      ) : (
                        <PackageIcon className="size-4" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1 basis-48">
                      {i.productId ? (
                        <Link href={`/products/${i.productId}`} className="font-medium hover:text-primary hover:underline">
                          {i.productName}
                        </Link>
                      ) : (
                        <span className="font-medium">{i.productName}</span>
                      )}
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                        {/* Single-variant products snapshot the SKU as the variant name. */}
                        {i.variantName && i.variantName !== i.sku && <span className="font-medium text-foreground">{i.variantName}</span>}
                        <span className="font-mono">{i.sku}</span>
                        {i.metadata?.appliedPromotion && <Pill tone="blue">{i.metadata.appliedPromotion.name}</Pill>}
                      </div>
                      {variant && (
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          {variant.levels.map((l) => (
                            <span key={l.warehouseId} className="inline-flex items-center gap-1">
                              <WarehouseTag code={l.warehouse.code} count={l.available} tone={stockTone(l, variant.lowStockThreshold)} />
                              {l.defaultLocation && <RackTag code={l.defaultLocation.code} title="Default pick rack" />}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="ml-auto text-right text-sm tabular-nums">
                      <div className="text-muted-foreground">
                        {taka(Number(i.unitPrice), 2)} × {n0(i.quantity)}
                      </div>
                      <div className="font-semibold">{taka(Number(i.totalAmount), 2)}</div>
                      {discount > 0 && <div className="text-xs text-emerald-700 dark:text-emerald-400">−{taka(discount, 2)} off</div>}
                    </div>
                  </li>
                )
              })}
            </ul>
            <dl className="flex flex-col gap-2 border-t bg-muted/30 px-4 py-3 text-sm tabular-nums">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd>{taka(Number(order.subtotalAmount), 2)}</dd>
              </div>
              {Number(order.discountAmount) > 0 && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">
                    Discount
                    {promotions.length > 0 && <span> · {promotions.join(", ")}</span>}
                  </dt>
                  <dd className="text-emerald-700 dark:text-emerald-400">−{taka(Number(order.discountAmount), 2)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Shipping</dt>
                <dd>{Number(order.shippingAmount) > 0 ? taka(Number(order.shippingAmount), 2) : "Free"}</dd>
              </div>
              <div className="flex justify-between border-t pt-2 text-base font-semibold">
                <dt>Total</dt>
                <dd>{taka(total, 2)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Paid</dt>
                <dd>{taka(paid, 2)}</dd>
              </div>
              {due > 0 && !stopped && (
                <div className="flex justify-between font-medium text-amber-700 dark:text-amber-400">
                  <dt>Balance due</dt>
                  <dd>{taka(due, 2)}</dd>
                </div>
              )}
            </dl>
          </Card>

          <Card
            title="Shipments"
            action={
              canShip && (
                <Button size="sm" variant="outline" onClick={() => setShipping(true)}>
                  <TruckIcon />
                  Add shipment
                </Button>
              )
            }
          >
            {order.shipments.length === 0 ? (
              <p className="px-4 pb-4 text-sm text-muted-foreground">Not shipped yet.</p>
            ) : (
              <ul className="flex flex-col">
                {order.shipments.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center gap-3 border-t border-border/60 px-4 py-3 text-sm">
                    <span className="grid size-9 place-items-center rounded-lg bg-muted text-muted-foreground">
                      <TruckIcon className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{[s.carrier, s.service].filter(Boolean).join(" · ") || "Carrier not set"}</div>
                      <div className="text-xs text-muted-foreground">
                        {s.trackingNumber ? <span className="font-mono">{s.trackingNumber}</span> : "No tracking number"}
                        {s.shippedAt && ` · shipped ${fmtDate(s.shippedAt)}`}
                        {s.deliveredAt && ` · delivered ${fmtDate(s.deliveredAt)}`}
                      </div>
                    </div>
                    <Pill tone={TONE[s.status] ?? "grey"}>{label(s.status)}</Pill>
                    {s.trackingUrl && (
                      <a href={s.trackingUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                        Track <ExternalLinkIcon className="size-3" />
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Stock movements" action={<span className="hidden text-xs text-muted-foreground sm:inline">Ledger rows written for this order</span>}>
            {movements.length === 0 ? (
              <p className="px-4 pb-4 text-sm text-muted-foreground">No stock has moved for this order yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                    <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:font-medium [&>th:first-child]:pl-4 [&>th:last-child]:pr-4">
                      <th>When</th>
                      <th>Type</th>
                      <th className="hidden md:table-cell">SKU</th>
                      <th>Where</th>
                      <th className="text-right">Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements.map((m) => (
                      <tr key={m.id} className="border-t border-border/60 [&>td]:px-3 [&>td]:py-2.5 [&>td:first-child]:pl-4 [&>td:last-child]:pr-4">
                        <td className="whitespace-nowrap text-muted-foreground">{fmtDateTime(m.createdAt)}</td>
                        <td>
                          <MovementTag movement={m} />
                        </td>
                        <td className="hidden font-mono text-xs text-muted-foreground md:table-cell">{m.inventoryLevel.variant.sku}</td>
                        <td>
                          <span className="inline-flex items-center gap-1">
                            <WarehouseTag code={m.inventoryLevel.warehouse.code} />
                            {movementRacks(m) && <RackTag code={movementRacks(m)} />}
                          </span>
                        </td>
                        <td className="text-right">
                          <MovementQuantity movement={m} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card title="Timeline">
            <ol className="flex flex-col px-4 pb-4">
              {[...logs].reverse().map((log, index) => (
                <li key={log.id} className="relative flex gap-3 pb-4 last:pb-0">
                  {index < logs.length - 1 && <span className="absolute top-3 left-[4.5px] h-full w-px bg-border" aria-hidden />}
                  <span className={cn("relative mt-1.5 size-2.5 shrink-0 rounded-full", index === 0 ? "bg-primary ring-4 ring-primary/15" : "bg-muted-foreground/40")} />
                  <div className="min-w-0 flex-1 text-sm">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <span className="font-medium">
                        {log.fromStatus ? `${ORDER_STATUS_LABEL[log.fromStatus]} → ${ORDER_STATUS_LABEL[log.toStatus]}` : "Order placed"}
                      </span>
                      <span className="text-xs text-muted-foreground">{fmtDateTime(log.createdAt)}</span>
                    </div>
                    {log.note && log.note !== "Order placed" && <p className="text-muted-foreground">{log.note}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-4 md:gap-6">
          <Card title="Customer" action={<Pill tone={order.userId ? "blue" : "grey"}>{order.userId ? "Account" : "Guest"}</Pill>}>
            <div className="flex flex-col gap-3 px-4 pb-4 text-sm">
              <div className="flex items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 font-semibold text-primary uppercase">
                  {(order.customerName ?? order.customerEmail).slice(0, 2)}
                </span>
                <div className="min-w-0">
                  <div className="truncate font-medium">{order.customerName ?? "No name given"}</div>
                  <div className="text-xs text-muted-foreground">First order {fmtDate(firstOrder)}</div>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <a href={`mailto:${order.customerEmail}`} className="flex items-center gap-2 truncate text-primary hover:underline">
                  <MailIcon className="size-3.5 shrink-0 text-muted-foreground" />
                  {order.customerEmail}
                </a>
                {order.customerPhone && (
                  <a href={`tel:${order.customerPhone}`} className="flex items-center gap-2 hover:underline">
                    <PhoneIcon className="size-3.5 shrink-0 text-muted-foreground" />
                    {order.customerPhone}
                  </a>
                )}
              </div>
              <div className="grid grid-cols-3 divide-x rounded-xl border bg-muted/30 text-center">
                <div className="px-2 py-2">
                  <div className="font-semibold tabular-nums">{n0(history.length)}</div>
                  <div className="text-[11px] text-muted-foreground">Orders</div>
                </div>
                <div className="min-w-0 px-2 py-2">
                  <div className="truncate font-semibold tabular-nums">{taka(spent)}</div>
                  <div className="text-[11px] text-muted-foreground">Spent</div>
                </div>
                <div className="min-w-0 px-2 py-2">
                  <div className="truncate font-semibold tabular-nums">{taka(kept.length ? spent / kept.length : 0)}</div>
                  <div className="text-[11px] text-muted-foreground">Avg order</div>
                </div>
              </div>
              {order.customerNote && (
                <p className="rounded-lg border border-dashed px-3 py-2 text-muted-foreground">
                  <span className="block text-xs font-medium text-foreground">Note from customer</span>“{order.customerNote}”
                </p>
              )}
              {others.length > 0 && (
                <div className="flex flex-col">
                  <span className="mb-1 text-xs font-medium text-muted-foreground">Other orders</span>
                  {others.slice(0, 5).map((o) => (
                    <Link key={o.id} href={`/orders/${o.id}`} className="-mx-2 flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-muted">
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-medium">{o.orderNumber}</span>
                        <span className="block text-[11px] text-muted-foreground">
                          {fmtDate(o.placedAt ?? o.createdAt)} · {ORDER_STATUS_LABEL[o.status]}
                        </span>
                      </span>
                      <span className="text-xs tabular-nums">{taka(Number(o.totalAmount))}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </Card>

          <Card title="Addresses">
            <div className="flex flex-col gap-4 px-4 pb-4">
              <div className="flex gap-3">
                <MapPinIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div>
                  <div className="mb-0.5 text-xs font-medium text-muted-foreground">Ship to</div>
                  {shippingAddress ? <Address address={shippingAddress} /> : <p className="text-sm text-muted-foreground">None given.</p>}
                </div>
              </div>
              <div className="flex gap-3 border-t pt-4">
                <MapPinIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div>
                  <div className="mb-0.5 text-xs font-medium text-muted-foreground">Bill to</div>
                  {billingAddress ? <Address address={billingAddress} /> : <p className="text-sm text-muted-foreground">Same as shipping.</p>}
                </div>
              </div>
            </div>
          </Card>

          <Card title="Payments">
            {order.payments.length === 0 ? (
              <p className="px-4 pb-4 text-sm text-muted-foreground">No payment attempts.</p>
            ) : (
              <ul className="flex flex-col gap-2 px-4 pb-4">
                {order.payments.map((p) => (
                  <li key={p.id} className="flex flex-col gap-2 rounded-xl border px-3 py-2.5 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">
                        {p.provider} <span className="font-normal text-muted-foreground">· {label(p.method)}</span>
                      </span>
                      <Pill tone={TONE[p.status] ?? "amber"}>{PAYMENT_LABEL[p.status]}</Pill>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span className="text-sm font-semibold text-foreground tabular-nums">{taka(Number(p.amount), 2)}</span>
                      <span>{p.paidAt ? `Paid ${fmtDateTime(p.paidAt)}` : `Started ${fmtDateTime(p.createdAt)}`}</span>
                    </div>
                    {p.transactionId && <div className="truncate font-mono text-xs text-muted-foreground">Txn {p.transactionId}</div>}
                    {p.failureMessage && <div className="text-xs text-destructive">{p.failureMessage}</div>}
                    {OPEN_PAYMENT.includes(p.status) && !stopped && (
                      <Button size="sm" variant="outline" onClick={() => markPaid(p.id)} disabled={busy}>
                        Mark as paid
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {order.refundRequests.length > 0 && (
            <Card title="Refund requests">
              <ul className="flex flex-col gap-2 px-4 pb-4 text-sm">
                {order.refundRequests.map((r) => (
                  <li key={r.id} className="flex flex-col gap-1 rounded-xl border px-3 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium tabular-nums">{taka(Number(r.amount), 2)}</span>
                      <Pill tone={TONE[r.status] ?? "amber"}>{label(r.status)}</Pill>
                    </div>
                    <p className="text-muted-foreground">{r.reason}</p>
                    {r.adminNote && <p className="text-xs text-muted-foreground">Note: {r.adminNote}</p>}
                    <span className="text-xs text-muted-foreground">{fmtDate(r.createdAt)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card title="Details">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 px-4 pb-4 text-sm">
              <dt className="text-muted-foreground">Currency</dt>
              <dd>{order.currency}</dd>
              <dt className="text-muted-foreground">Created</dt>
              <dd>{fmtDateTime(order.createdAt)}</dd>
              <dt className="text-muted-foreground">Updated</dt>
              <dd>{fmtDateTime(order.updatedAt)}</dd>
              {order.completedAt && (
                <>
                  <dt className="text-muted-foreground">Completed</dt>
                  <dd>{fmtDateTime(order.completedAt)}</dd>
                </>
              )}
              {order.cancelledAt && (
                <>
                  <dt className="text-muted-foreground">Cancelled</dt>
                  <dd>{fmtDateTime(order.cancelledAt)}</dd>
                </>
              )}
              <dt className="text-muted-foreground">ID</dt>
              <dd className="truncate font-mono text-xs leading-5" title={order.id}>
                {order.id}
              </dd>
            </dl>
          </Card>
        </div>
      </div>

      {cancelling && <CancelDialog orderId={order.id} orderNumber={order.orderNumber} onClose={() => setCancelling(false)} />}
      {shipping && <ShipmentDialog orderId={order.id} onClose={() => setShipping(false)} />}
    </div>
  )
}

function CancelDialog({ orderId, orderNumber, onClose }: { orderId: string; orderNumber: string; onClose: () => void }) {
  const [reason, setReason] = useState("")
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)

  async function cancel() {
    if (!reason.trim()) return setError("Give a reason; the customer may see it.")
    setSaving(true)
    const res = await cancelOrder(orderId, reason.trim())
    setSaving(false)
    if (!res.success) return setError(res.error)
    toast.success(`${orderNumber} cancelled`, { description: "Held stock was released." })
    onClose()
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cancel {orderNumber}?</DialogTitle>
          <DialogDescription>The order stops here and the stock it held goes back on sale. This can’t be undone.</DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor="cancel-reason">Reason</FieldLabel>
          <Textarea id="cancel-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Customer asked to cancel" />
        </Field>
        <DialogFooter className="items-center">
          {error && <p className="mr-auto text-sm text-destructive">{error}</p>}
          <Button variant="outline" onClick={onClose}>Keep order</Button>
          <Button variant="destructive" onClick={cancel} disabled={saving}>{saving ? "Cancelling..." : "Cancel order"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ShipmentDialog({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const [carrier, setCarrier] = useState("")
  const [trackingNumber, setTrackingNumber] = useState("")
  const [trackingUrl, setTrackingUrl] = useState("")
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    // The API rejects empty strings (trackingUrl must be a URL), so blanks are left out.
    const res = await createShipment(orderId, {
      carrier: carrier.trim() || undefined,
      trackingNumber: trackingNumber.trim() || undefined,
      trackingUrl: trackingUrl.trim() || undefined,
    })
    setSaving(false)
    if (!res.success) return setError(res.error)
    toast.success("Shipment added")
    onClose()
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add shipment</DialogTitle>
          <DialogDescription>Record the parcel. Use “Mark shipped” on the order once it leaves the warehouse.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <Field>
            <FieldLabel htmlFor="ship-carrier">Carrier</FieldLabel>
            <Input id="ship-carrier" value={carrier} onChange={(e) => setCarrier(e.target.value)} placeholder="Pathao, Steadfast, RedX..." />
          </Field>
          <Field>
            <FieldLabel htmlFor="ship-tracking">Tracking number</FieldLabel>
            <Input id="ship-tracking" value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} className="font-mono" />
          </Field>
          <Field>
            <FieldLabel htmlFor="ship-url">Tracking link</FieldLabel>
            <Input id="ship-url" type="url" value={trackingUrl} onChange={(e) => setTrackingUrl(e.target.value)} placeholder="https://" />
          </Field>
        </div>
        <DialogFooter className="items-center">
          {error && <p className="mr-auto text-sm text-destructive">{error}</p>}
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Add shipment"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
