"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import {
  ArrowLeftIcon,
  CheckIcon,
  CircleXIcon,
  CopyIcon,
  ExternalLinkIcon,
  FileTextIcon,
  MailIcon,
  MapPinIcon,
  PackageIcon,
  PencilIcon,
  PhoneIcon,
  PrinterIcon,
  RefreshCwIcon,
  StickyNoteIcon,
  StoreIcon,
  TruckIcon,
  Undo2Icon,
  UserIcon,
  XIcon,
  ZapIcon,
} from "lucide-react"

import {
  createRefundRequest,
  createShipment,
  updateOrderAddress,
  markPaymentFailed,
  markPaymentPaid,
  reviewRefund,
  updateOrderStatus,
  updateShipmentStatus,
} from "@/app/actions/order.actions"
import { bookPathaoShipment, getPathaoStores, syncPathaoShipment } from "@/app/actions/pathao.actions"
import { Card, fmtDate, fmtDateTime, Kpis, label, n0, Pill, RackTag, rel, taka, type Tone, WarehouseTag } from "@/components/inventory/inventory-ui"
import { MovementQuantity, MovementTag, movementRacks } from "@/components/inventory/movements-table"
import { CANCELLABLE, CancelDialog, CARRIER_LABEL, NEXT, ORDER_STATUS_LABEL, PAYMENT_LABEL } from "@/components/orders/orders-table"
import { PrintInvoice } from "@/components/orders/print-invoice"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { cn } from "@/lib/utils"
import type { LedgerMovement, StockLevel, VariantStockDetail } from "@/types/inventory.type"
import { formatAddress, type CourierCarrier, type Order, type OrderAddress, type OrderAddressBody, type OrderDetail, type OrderStatus, type Shipment, type ShipmentStatus } from "@/types/order.type"
import type { PathaoDeliveryType, PathaoItemType, PathaoStore } from "@/types/pathao.type"

// The next step on the happy path, as the backend allows it (ORDER_STATUS_TRANSITIONS).
const STEPS: OrderStatus[] = ["PENDING", "CONFIRMED", "PROCESSING", "READY_TO_SHIP", "SHIPPED", "DELIVERED", "COMPLETED"]
const STEP_LABEL: Partial<Record<OrderStatus, string>> = { PENDING: "Placed" }
const STOPPED: OrderStatus[] = ["CANCELLED", "FAILED", "REFUNDED"]
const OPEN_PAYMENT = ["PENDING", "PROCESSING"]
// Shipment, payment and refund statuses that finished well or badly; the rest are in progress.
export const TONE: Record<string, Tone> = {
  DELIVERED: "green", PAID: "green", APPROVED: "blue", PROCESSED: "green",
  FAILED: "red", RETURNED: "red", CANCELLED: "red", REJECTED: "red",
}
const carrierItems = Object.entries(CARRIER_LABEL).map(([value, text]) => ({ value, label: text }))
const SHIPMENT_STATUSES: ShipmentStatus[] = ["PENDING", "PROCESSING", "SHIPPED", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED", "FAILED", "RETURNED", "CANCELLED"]
export const shipmentStatusItems = SHIPMENT_STATUSES.map((value) => ({ value, label: label(value) }))
// The backend refuses status changes once a shipment ends.
export const SHIPMENT_DONE: ShipmentStatus[] = ["DELIVERED", "CANCELLED", "RETURNED"]

const sumPaid = (o: Pick<Order, "payments">) => o.payments.filter((p) => p.status === "PAID").reduce((s, p) => s + Number(p.amount), 0)

function stockTone(l: StockLevel, threshold: number) {
  if (l.available <= 0) return "bad"
  if (l.available <= threshold) return "warn"
  return undefined
}

function Address({ address }: { address: OrderAddress }) {
  return (
    <address className="text-sm leading-relaxed not-italic">
      <div className="font-medium">{address.fullName}</div>
      {address.company && <div>{address.company}</div>}
      <div className="text-muted-foreground">{formatAddress(address)}</div>
      <div className="text-muted-foreground">{address.phone}</div>
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
  const [bookingPathao, setBookingPathao] = useState(false)
  const [pathaoLog, setPathaoLog] = useState<{ ok: boolean; reply: unknown; at: string } | null>(null)
  const [refunding, setRefunding] = useState(false)

  const next = NEXT[order.status]
  const stopped = STOPPED.includes(order.status)
  const units = order.items.reduce((s, i) => s + i.quantity, 0)
  const total = Number(order.totalAmount)
  const paid = sumPaid(order)
  const due = total - paid
  const refunded = order.refundRequests.filter((r) => r.status === "PROCESSED").reduce((s, r) => s + Number(r.amount), 0)
  // Paid money not yet refunded or promised in an open request.
  const refundable = paid - order.refundRequests.filter((r) => r.status !== "REJECTED").reduce((s, r) => s + Number(r.amount), 0)
  const codOpen = order.payments.some((p) => p.method === "CASH_ON_DELIVERY" && OPEN_PAYMENT.includes(p.status))
  const logs = [...order.statusLogs].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const reachedAt = new Map(logs.map((l) => [l.toStatus, l.createdAt]))
  const lastLog = logs.at(-1)
  const canShip = ["CONFIRMED", "PROCESSING", "READY_TO_SHIP"].includes(order.status)
  // The backend refuses a second Pathao parcel while one is still on the way.
  const hasOpenPathao = order.shipments.some((s) => s.carrier === "PATHAO" && !SHIPMENT_DONE.includes(s.status) && s.status !== "FAILED")
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
    a.fullName === b.fullName && a.phone === b.phone && a.fullAddress === b.fullAddress && a.city === b.city
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

  async function markFailed(paymentId: string) {
    setBusy(true)
    const res = await markPaymentFailed(order.id, paymentId, "Marked failed by admin")
    setBusy(false)
    if (!res.success) return toast.error(res.error)
    toast.success("Payment marked as failed")
  }

  async function setShipmentStatus(shipmentId: string, status: ShipmentStatus) {
    setBusy(true)
    const res = await updateShipmentStatus(order.id, shipmentId, status)
    setBusy(false)
    if (!res.success) return toast.error(res.error)
    toast.success(`Shipment is now ${label(status).toLowerCase()}`)
  }

  // One click books with the usual settings; the backend fills in the item count and the cash still due.
  async function bookPathao() {
    setBusy(true)
    const res = await bookPathaoShipment(order.id, { deliveryType: "NORMAL", itemType: "PARCEL", itemWeight: 0.5 })
    setBusy(false)
    setPathaoLog({ ok: res.success, reply: res.reply, at: new Date().toISOString() })
    if (!res.success) return toast.error(res.error)
    toast.success(`${order.orderNumber} booked with Pathao`, { description: "The rider will pick it up from your store." })
  }

  async function syncPathao(shipmentId: string) {
    setBusy(true)
    const res = await syncPathaoShipment(order.id, shipmentId)
    setBusy(false)
    const reply = <ApiReply reply={res.reply} />
    if (!res.success) return toast.error(res.error, { description: reply, duration: 15000 })
    const title = res.data.updated ? `Shipment is now ${label(res.data.status).toLowerCase()}` : `No change · Pathao says: ${pathaoText(res.data.pathaoStatus)}`
    toast.success(title, { description: reply, duration: 15000 })
  }

  async function review(refundId: string, action: "approve" | "reject" | "process") {
    setBusy(true)
    const res = await reviewRefund(order.id, refundId, action)
    setBusy(false)
    if (!res.success) return toast.error(res.error)
    toast.success(`Refund ${action === "process" ? "processed" : `${action}d`}`)
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
        <div className="flex gap-2 print:hidden">
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => window.print()}>
            <PrinterIcon />
            Print
          </Button>
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
                      {variant?.activeReservations
                        .filter((h) => h.order?.orderNumber === order.orderNumber)
                        .map((h) => (
                          <div key={h.id} className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                            {n0(h.quantity)} held for this order, released {rel(h.expiresAt)}
                          </div>
                        ))}
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
              {refunded > 0 && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Refunded</dt>
                  <dd className="text-red-700 dark:text-red-400">−{taka(refunded, 2)}</dd>
                </div>
              )}
              {due > 0 && !stopped && (
                <div className="flex justify-between font-medium text-amber-700 dark:text-amber-400">
                  <dt>{codOpen ? "To collect on delivery" : "Balance due"}</dt>
                  <dd>{taka(due, 2)}</dd>
                </div>
              )}
            </dl>
          </Card>

          <Card
            title="Shipments"
            action={
              canShip && (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setShipping(true)}>
                    <TruckIcon />
                    Add shipment
                  </Button>
                  <span className="flex" title={hasOpenPathao ? "This order already has a Pathao parcel on the way" : undefined}>
                    <Button size="sm" className="rounded-r-none" onClick={bookPathao} disabled={busy || hasOpenPathao}>
                      <PathaoMark />
                      {busy ? "Booking..." : "Book with Pathao"}
                    </Button>
                    <Button
                      size="icon-sm"
                      className="rounded-l-none border-l border-primary-foreground/25"
                      onClick={() => setBookingPathao(true)}
                      disabled={busy || hasOpenPathao}
                      aria-label="Book with Pathao, choose the settings"
                      title="Choose store, weight, cash to collect..."
                    >
                      <PencilIcon />
                    </Button>
                  </span>
                </div>
              )
            }
          >
            {pathaoLog && (
              <div className="px-4 pb-3">
                <PathaoLog
                  {...pathaoLog}
                  order={order}
                  parcel={`${units} ${units === 1 ? "item" : "items"} · 0.5 kg · Normal`}
                  collect={Math.max(0, Math.round(due))}
                  onRetry={bookPathao}
                  onEdit={() => setBookingPathao(true)}
                  onDismiss={() => setPathaoLog(null)}
                />
              </div>
            )}
            {order.shipments.length === 0 ? (
              <p className="px-4 pb-4 text-sm text-muted-foreground">Not shipped yet.</p>
            ) : (
              <ul className="flex flex-col">
                {order.shipments.map((s) => (
                  <li key={s.id} className="flex flex-col gap-3 border-t border-border/60 px-4 py-3 text-sm">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="grid size-9 place-items-center rounded-lg bg-muted text-muted-foreground">
                        <TruckIcon className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium">{[CARRIER_LABEL[s.carrier] ?? s.carrier, s.service].filter(Boolean).join(" · ")}</div>
                        <div className="text-xs text-muted-foreground">
                          Added {fmtDate(s.createdAt)}
                          {s.shippedAt && ` · shipped ${fmtDate(s.shippedAt)}`}
                          {s.deliveredAt && ` · delivered ${fmtDate(s.deliveredAt)}`}
                        </div>
                        {s.metadata?.pathaoStatus && (
                          <div className="text-xs text-muted-foreground">
                            Pathao: <span className="font-medium text-foreground">{pathaoText(s.metadata.pathaoStatus)}</span>
                            {s.metadata.pathaoStatusAt && ` · ${rel(s.metadata.pathaoStatusAt)}`}
                          </div>
                        )}
                      </div>
                      {s.carrier === "PATHAO" && s.consignmentId && !SHIPMENT_DONE.includes(s.status) && (
                        <Button size="sm" variant="ghost" onClick={() => syncPathao(s.id)} disabled={busy} title="Ask Pathao for the latest status">
                          <RefreshCwIcon className={cn(busy && "animate-spin")} />
                          Sync
                        </Button>
                      )}
                      {SHIPMENT_DONE.includes(s.status) ? (
                        <Pill tone={TONE[s.status] ?? "grey"}>{label(s.status)}</Pill>
                      ) : (
                        <Select value={s.status} items={shipmentStatusItems} onValueChange={(v) => setShipmentStatus(s.id, v as ShipmentStatus)} disabled={busy}>
                          <SelectTrigger size="sm" aria-label="Shipment status" className="w-40"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {shipmentStatusItems.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-lg bg-muted/40 px-3 py-2 text-xs sm:grid-cols-4">
                      <div>
                        <dt className="text-muted-foreground">Tracking</dt>
                        <dd className="truncate font-mono">
                          {s.trackingUrl ? (
                            <a href={s.trackingUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                              {s.trackingNumber ?? "Track"} <ExternalLinkIcon className="size-3" />
                            </a>
                          ) : (
                            s.trackingNumber ?? "—"
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Consignment</dt>
                        <dd className="truncate font-mono">{s.consignmentId ?? "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Collect on delivery</dt>
                        <dd className="tabular-nums">{s.codAmount ? taka(Number(s.codAmount), 2) : "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Courier charge</dt>
                        <dd className="tabular-nums">
                          {/* Pathao's fee is kept in metadata; the shipment's own charge stays 0. */}
                          {Number(s.shippingAmount) === 0 && s.metadata?.pathaoDeliveryFee !== undefined
                            ? taka(s.metadata.pathaoDeliveryFee, 2)
                            : taka(Number(s.shippingAmount), 2)}
                        </dd>
                      </div>
                    </dl>
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
                    {p.providerReference && <div className="truncate font-mono text-xs text-muted-foreground">Ref {p.providerReference}</div>}
                    {OPEN_PAYMENT.includes(p.status) && !stopped && (
                      <div className="grid grid-cols-2 gap-2">
                        <Button size="sm" variant="outline" className="text-destructive" onClick={() => markFailed(p.id)} disabled={busy}>
                          Mark failed
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => markPaid(p.id)} disabled={busy}>
                          Mark as paid
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {(paid > 0 || order.refundRequests.length > 0) && (
            <Card
              title="Refunds"
              action={
                refundable > 0 && (
                  <Button size="sm" variant="outline" onClick={() => setRefunding(true)}>
                    <Undo2Icon />
                    Refund
                  </Button>
                )
              }
            >
              {order.refundRequests.length === 0 ? (
                <p className="px-4 pb-4 text-sm text-muted-foreground">No refunds. Up to {taka(refundable, 2)} can be refunded.</p>
              ) : (
                <ul className="flex flex-col gap-2 px-4 pb-4 text-sm">
                  {order.refundRequests.map((r) => (
                    <li key={r.id} className="flex flex-col gap-1.5 rounded-xl border px-3 py-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold tabular-nums">{taka(Number(r.amount), 2)}</span>
                        <Pill tone={TONE[r.status] ?? "amber"}>{label(r.status)}</Pill>
                      </div>
                      <p className="text-muted-foreground">{r.reason}</p>
                      {r.adminNote && <p className="text-xs text-muted-foreground">Note: {r.adminNote}</p>}
                      <span className="text-xs text-muted-foreground">Requested {fmtDate(r.createdAt)}</span>
                      {r.status === "PENDING" && (
                        <div className="grid grid-cols-2 gap-2">
                          <Button size="sm" variant="outline" className="text-destructive" onClick={() => review(r.id, "reject")} disabled={busy}>
                            Reject
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => review(r.id, "approve")} disabled={busy}>
                            Approve
                          </Button>
                        </div>
                      )}
                      {r.status === "APPROVED" && (
                        <Button size="sm" onClick={() => review(r.id, "process")} disabled={busy}>
                          Mark refunded
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
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

      <PrintInvoice order={order} />
      {cancelling && <CancelDialog orderId={order.id} orderNumber={order.orderNumber} onClose={() => setCancelling(false)} />}
      {bookingPathao && <PathaoDialog order={order} due={Math.max(0, due)} onClose={() => setBookingPathao(false)} />}
      {shipping && (
        <ShipmentDialog orderId={order.id} orderNumber={order.orderNumber} codAmount={codOpen ? due : 0} onClose={() => setShipping(false)} />
      )}
      {refunding && <RefundDialog orderId={order.id} max={refundable} onClose={() => setRefunding(false)} />}
    </div>
  )
}

// "order.at-the-sorting-hub", "At_the_Sorting_HUB" or "Pending" → "At the sorting hub"
const pathaoText = (status: string) => {
  const words = status.replace(/^order\./, "").replace(/[-_\s]+/g, " ").trim().toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

// Pathao's logo (public/couriers/pathao.png, from their GitHub avatar); the round crop hides its black corners.
function PathaoMark({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn("size-4 shrink-0 overflow-hidden rounded-full bg-white", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- a 16px static icon */}
      <img src="/couriers/pathao.png" alt="" className="size-full scale-[1.12] object-cover" />
    </span>
  )
}

// Plain-words help for the booking errors we know; anything else shows the API's own message.
function pathaoTip(message: string) {
  if (/storeId|PATHAO_STORE_ID/i.test(message)) return "No pickup store. Pick one with the pencil, or set PATHAO_STORE_ID in the backend's .env."
  if (/not configured|log in to Pathao/i.test(message)) return "The backend can't sign in to Pathao. Check the PATHAO_* settings, or try later if Pathao is down."
  if (/mobile|phone/i.test(message)) return "Fix the phone on the shipping address: Pathao needs an 11-digit number like 01712345678."
  if (/address/i.test(message)) return "The shipping address is too short for Pathao (at least 10 characters)."
  return null
}

// One booking attempt, logged like an SMS gateway entry: outcome, recipient, what was sent and the raw reply.
function PathaoLog({
  ok,
  reply,
  at,
  order,
  parcel,
  collect,
  onRetry,
  onEdit,
  onDismiss,
}: {
  ok: boolean
  reply: unknown
  at: string
  order: OrderDetail
  parcel: string // "1 item · 0.5 kg · Normal"
  collect: number
  onRetry?: () => void
  onEdit?: () => void
  onDismiss?: () => void
}) {
  const address = order.addresses.find((a) => a.type === "SHIPPING")
  const phone = address?.phone ?? order.customerPhone
  const name = address?.fullName || order.customerName
  const raw = (reply as { message?: string | string[] } | null)?.message
  const message = Array.isArray(raw) ? raw.join(", ") : raw
  const tip = !ok && message ? pathaoTip(message) : null
  // A booking answers with the whole order; the new parcel is its latest Pathao shipment.
  const parcelId = ok ? (reply as { shipments?: Shipment[] } | null)?.shipments?.filter((sh) => sh.carrier === "PATHAO").at(-1)?.consignmentId : null
  const Icon = ok ? CheckIcon : CircleXIcon

  return (
    <div className={cn("overflow-hidden rounded-xl border border-l-4 bg-card", ok ? "border-l-emerald-500" : "border-l-red-500")}>
      <div className="flex items-start gap-3 px-4 pt-3">
        <span className={cn("mt-0.5 grid size-7 shrink-0 place-items-center rounded-full", ok ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400" : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400")}>
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span
              className={cn(
                "rounded border px-1.5 py-px text-[11px] font-semibold tracking-wide uppercase",
                ok
                  ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-400"
                  : "border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400"
              )}
            >
              Pathao · {ok ? "Booked" : "Failed"}
            </span>
            <span className="text-sm font-medium">{ok ? "Parcel booked" : "Couldn’t book this parcel"}</span>
            <span className="ml-auto text-xs text-muted-foreground" title={fmtDateTime(at)}>{rel(at)}</span>
          </div>
          {parcelId && (
            <p className="mt-1 text-sm text-muted-foreground">
              Consignment <span className="font-mono font-medium text-foreground">{parcelId}</span>. The rider will pick it up from your store.
            </p>
          )}
          {!ok && message && <p className="mt-1 text-sm text-red-700 dark:text-red-400">{message}</p>}
          {tip && <p className="mt-0.5 text-[13px] text-muted-foreground">{tip}</p>}
        </div>
        {onDismiss && (
          <Button size="icon-xs" variant="ghost" className="-mr-1 text-muted-foreground" onClick={onDismiss} aria-label="Hide this log">
            <XIcon />
          </Button>
        )}
      </div>

      <dl className="mx-4 mt-3 grid grid-cols-3 gap-px overflow-hidden rounded-lg border bg-border text-[13px]">
        <div className="min-w-0 bg-muted/40 px-3 py-2">
          <dt className="text-[11px] text-muted-foreground">To</dt>
          <dd className="truncate font-medium">{name}</dd>
          {phone && <dd className="font-mono text-xs text-muted-foreground">0{phone.replace(/\D/g, "").slice(-10)}</dd>}
        </div>
        <div className="min-w-0 bg-muted/40 px-3 py-2">
          <dt className="text-[11px] text-muted-foreground">Parcel</dt>
          <dd className="font-medium">{parcel}</dd>
          <dd className="text-xs text-muted-foreground">{order.orderNumber}</dd>
        </div>
        <div className="min-w-0 bg-muted/40 px-3 py-2">
          <dt className="text-[11px] text-muted-foreground">Collect on delivery</dt>
          <dd className="font-medium tabular-nums">{collect > 0 ? taka(collect) : "Nothing"}</dd>
          <dd className="text-xs text-muted-foreground">{collect > 0 ? "cash from the customer" : "prepaid"}</dd>
        </div>
      </dl>

      <div className="px-4 pt-2.5 pb-3">
        <ApiReply reply={reply} />
      </div>

      {!ok && (onRetry || onEdit) && (
        <div className="flex justify-end gap-2 border-t bg-muted/30 px-4 py-2">
          {onEdit && (
            <Button size="sm" variant="outline" onClick={onEdit}>
              <PencilIcon />
              Change settings
            </Button>
          )}
          {onRetry && (
            <Button size="sm" onClick={onRetry}>
              <RefreshCwIcon />
              Try again
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

// The raw JSON an API call answered, on one line, for checking what the courier really said.
// Long replies (a booking answers with the whole order) are clamped until opened.
function ApiReply({ reply }: { reply: unknown }) {
  const [open, setOpen] = useState(false)
  const text = JSON.stringify(reply) ?? "No reply"
  const long = text.length > 200
  return (
    <div className="rounded-md bg-muted/50 px-2.5 py-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
      <div className="mb-0.5 flex items-center justify-between font-sans text-[11px]">
        <span className="font-medium tracking-wide uppercase">API reply</span>
        <span className="flex gap-3">
          {long && (
            <button type="button" className="text-primary hover:underline" onClick={() => setOpen(!open)}>
              {open ? "Show less" : "Show all"}
            </button>
          )}
          <button
            type="button"
            className="text-primary hover:underline"
            onClick={() => {
              navigator.clipboard.writeText(JSON.stringify(reply, null, 2) ?? "")
              toast.success("Reply copied")
            }}
          >
            Copy
          </button>
        </span>
      </div>
      <p className={cn("break-all", long && !open && "line-clamp-2")}>{text}</p>
    </div>
  )
}

const ALL = "all"
const sameAs = (value: string) => (value === ALL ? undefined : Number(value))

type AddressForm = { fullName: string; phone: string; fullAddress: string; city: string; country: string }

// The checks Pathao runs before taking a parcel (backend pathao-recipient.ts), so problems show before booking.
function pathaoProblems(a: AddressForm, customerName: string | null, customerPhone: string | null) {
  const problems: string[] = []
  const toBd = (raw: string | null) => {
    let digits = (raw ?? "").replace(/\D/g, "")
    if (digits.startsWith("880")) digits = digits.slice(2)
    return /^01[3-9]\d{8}$/.test(digits)
  }
  if (!toBd(a.phone) && !toBd(customerPhone)) problems.push("Pathao needs a Bangladeshi mobile number, e.g. 01712345678.")
  else if (a.phone.trim() && !toBd(a.phone)) problems.push("This phone isn’t a Bangladeshi mobile number, so Pathao will call the customer’s account number instead.")
  if ((a.fullName.trim() || customerName || "").trim().length < 3) problems.push("The name must be at least 3 characters.")
  // Pathao gets the full address, plus the city when the address doesn't mention it.
  const sent = a.fullAddress.toLowerCase().includes(a.city.trim().toLowerCase()) ? a.fullAddress : [a.fullAddress, a.city].filter(Boolean).join(", ")
  if (sent.trim().length < 10) problems.push("The address must be at least 10 characters.")
  return problems
}

// Books the parcel at Pathao. Pathao works out the city, zone and area from the address text,
// and its delivery charge is only known once the parcel is booked.
function PathaoDialog({ order, due, onClose }: { order: OrderDetail; due: number; onClose: () => void }) {
  const address = order.addresses.find((a) => a.type === "SHIPPING")
  // Pathao gets 11 digits ("01712345678"); the address phone wins over the customer's.
  const phone = address?.phone ?? order.customerPhone
  const [stores, setStores] = useState<PathaoStore[] | null>(null)
  const [storeId, setStoreId] = useState(ALL)
  const [deliveryType, setDeliveryType] = useState<PathaoDeliveryType>("NORMAL")
  const [itemType, setItemType] = useState<PathaoItemType>("PARCEL")
  const [weight, setWeight] = useState("0.5")
  const [quantity, setQuantity] = useState(String(order.items.reduce((s, i) => s + i.quantity, 0)))
  const [collect, setCollect] = useState(String(Math.round(due)))
  const [description, setDescription] = useState(order.items.map((i) => `${i.quantity} × ${i.productName}`).join(", ").slice(0, 255))
  const [instruction, setInstruction] = useState("")
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const [reply, setReply] = useState<{ ok: boolean; body: unknown; at: string } | null>(null)
  const [storeError, setStoreError] = useState("")
  const [addressForm, setAddressForm] = useState<AddressForm | null>(null)
  const [addressError, setAddressError] = useState("")
  const [savingAddress, setSavingAddress] = useState(false)

  function editAddress() {
    if (!address) return
    setAddressError("")
    setAddressForm({ fullName: address.fullName, phone: address.phone, fullAddress: address.fullAddress, city: address.city, country: address.country ?? "" })
  }

  async function saveAddress() {
    if (!addressForm) return
    if (!address) return
    const form = Object.fromEntries(Object.entries(addressForm).map(([k, v]) => [k, v.trim()])) as AddressForm
    if (!form.fullName || !form.phone || !form.city) return setAddressError("Full name, phone and city are required.")
    if (form.fullAddress.length < 10) return setAddressError("The full address needs at least 10 characters.")
    if (form.country && form.country.length < 2) return setAddressError("Country needs at least 2 characters.")
    // Send only what changed; a cleared country is left as it was (the API can't blank it).
    const changes: Partial<OrderAddressBody> = {}
    if (form.fullName !== address.fullName) changes.fullName = form.fullName
    if (form.phone !== address.phone) changes.phone = form.phone
    if (form.fullAddress !== address.fullAddress) changes.fullAddress = form.fullAddress
    if (form.city !== address.city) changes.city = form.city
    if (form.country && form.country !== (address.country ?? "")) changes.country = form.country
    if (Object.keys(changes).length === 0) return setAddressForm(null)
    setSavingAddress(true)
    // The order page reloads with the saved address, which this dialog then shows.
    const res = await updateOrderAddress(order.id, "SHIPPING", changes)
    setSavingAddress(false)
    if (!res.success) return setAddressError(res.error)
    toast.success("Shipping address updated")
    setAddressForm(null)
  }

  useEffect(() => {
    getPathaoStores().then((res) => {
      if (res.success) setStores(res.data.filter((st) => st.is_active))
      else {
        setStores([])
        setStoreError(res.error)
      }
    })
  }, [])

  async function book() {
    const kg = Number(weight)
    if (!(kg >= 0.5 && kg <= 10)) return setError("Weight must be between 0.5 and 10 kg.")
    if (!/^\d+$/.test(quantity) || Number(quantity) < 1) return setError("Quantity must be a whole number, at least 1.")
    if (!/^\d+$/.test(collect)) return setError("Cash to collect must be whole taka, 0 or more.")
    setSaving(true)
    const res = await bookPathaoShipment(order.id, {
      storeId: sameAs(storeId),
      deliveryType,
      itemType,
      itemWeight: kg,
      itemQuantity: Number(quantity),
      itemDescription: description.trim() || undefined,
      specialInstruction: instruction.trim() || undefined,
      amountToCollect: Number(collect),
    })
    setSaving(false)
    // Keep the dialog open so the reply can be read; Done closes it.
    setReply({ ok: res.success, body: res.reply, at: new Date().toISOString() })
    if (!res.success) return setError(res.error)
    setError("")
    toast.success(`${order.orderNumber} booked with Pathao`, { description: "The rider will pick it up from your store." })
  }

  const storeItems = [{ value: ALL, label: "Default pickup store" }, ...(stores ?? []).map((st) => ({ value: String(st.store_id), label: st.store_name }))]
  const store = stores?.find((st) => String(st.store_id) === storeId)
  const kg = Number(weight)
  const name = address?.fullName || order.customerName
  const pick = (text: string, value: string, items: { value: string; label: string }[], onChange: (v: string) => void, disabled = false) => (
    <Field>
      <FieldLabel>{text}</FieldLabel>
      <Select value={value} items={items} onValueChange={(v) => onChange(v as string)} disabled={disabled}>
        <SelectTrigger aria-label={text} className="w-full"><SelectValue /></SelectTrigger>
        <SelectContent>
          {items.map((i) => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </Field>
  )
  const toggle = (value: string, options: { value: string; label: string; icon: React.ElementType }[], onChange: (v: string) => void) => (
    <ToggleGroup multiple={false} value={[value]} onValueChange={(v) => v[0] && onChange(v[0])} variant="outline" spacing={0} className="w-full">
      {options.map((o) => (
        <ToggleGroupItem key={o.value} value={o.value} className="flex-1 gap-1.5 px-3! data-pressed:bg-primary/10 data-pressed:font-medium data-pressed:text-primary">
          <o.icon className="size-3.5" />
          {o.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
  const section = "flex flex-col gap-3 border-t px-6 py-4 first:border-t-0"
  const sectionTitle = "flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase [&_svg]:size-3.5"
  const chip = (active: boolean) => cn("rounded-md border px-2 py-0.5 text-xs tabular-nums transition-colors hover:bg-muted", active && "border-primary bg-primary/10 text-primary hover:bg-primary/10")

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="flex-row items-center gap-3 border-b px-6 py-4">
          <PathaoMark className="size-10 ring-4 ring-red-50 dark:ring-red-950" />
          <div className="min-w-0 flex-1">
            <DialogTitle className="flex items-center gap-2 text-base">
              Book with Pathao
              <span className="rounded-md border bg-muted/60 px-1.5 py-px font-mono text-[11px] font-medium text-muted-foreground">{order.orderNumber}</span>
            </DialogTitle>
            <DialogDescription>Pathao picks the parcel up from your store; its status then updates here.</DialogDescription>
          </div>
          <div className="mr-8 hidden text-right sm:block">
            <div className="text-[11px] text-muted-foreground">
              {order.items.length} {order.items.length === 1 ? "item" : "items"} · order total
            </div>
            <div className="font-semibold tabular-nums">{taka(Number(order.totalAmount))}</div>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className={section}>
            <h3 className={sectionTitle}><UserIcon />Deliver to</h3>
            {address && addressForm ? (
              <div className="flex flex-col gap-3 rounded-xl border bg-muted/30 p-3.5">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="addr-name">Full name</FieldLabel>
                    <Input id="addr-name" value={addressForm.fullName} maxLength={200} className="bg-card" onChange={(e) => setAddressForm({ ...addressForm, fullName: e.target.value })} />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="addr-phone">Phone</FieldLabel>
                    <Input id="addr-phone" value={addressForm.phone} maxLength={30} inputMode="tel" placeholder="01712345678" className="bg-card font-mono" onChange={(e) => setAddressForm({ ...addressForm, phone: e.target.value })} />
                  </Field>
                </div>
                <Field>
                  <div className="flex items-baseline justify-between">
                    <FieldLabel htmlFor="addr-full">Full address</FieldLabel>
                    <span className="text-xs text-muted-foreground tabular-nums">{addressForm.fullAddress.trim().length}/255</span>
                  </div>
                  <Textarea
                    id="addr-full"
                    value={addressForm.fullAddress}
                    maxLength={255}
                    placeholder="House 123, Road 4, Sector 10, Uttara, Dhaka-1230"
                    className="min-h-16 bg-card"
                    onChange={(e) => setAddressForm({ ...addressForm, fullAddress: e.target.value })}
                  />
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="addr-city">City</FieldLabel>
                    <Input id="addr-city" value={addressForm.city} maxLength={100} className="bg-card" onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })} />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="addr-country">Country</FieldLabel>
                    <Input id="addr-country" value={addressForm.country} maxLength={100} placeholder="Optional, e.g. BD" className="bg-card" onChange={(e) => setAddressForm({ ...addressForm, country: e.target.value })} />
                  </Field>
                </div>
                {pathaoProblems(addressForm, order.customerName, order.customerPhone).map((p) => (
                  <p key={p} className="-mt-1 text-xs text-amber-700 dark:text-amber-400">{p}</p>
                ))}
                <div className="flex items-center justify-end gap-2">
                  {addressError ? (
                    <p className="mr-auto text-xs text-destructive">{addressError}</p>
                  ) : (
                    <span className="mr-auto text-xs text-muted-foreground">Saves to the order, so the invoice shows it too.</span>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => setAddressForm(null)} disabled={savingAddress}>Cancel</Button>
                  <Button size="sm" onClick={saveAddress} disabled={savingAddress}>{savingAddress ? "Saving..." : "Save address"}</Button>
                </div>
              </div>
            ) : address ? (
              <div className="flex items-start gap-3 rounded-xl border bg-muted/30 px-3.5 py-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary uppercase">
                  {(name ?? "?").split(" ").map((w) => w[0]).slice(0, 2).join("")}
                </span>
                <div className="min-w-0 flex-1 text-sm">
                  <div className="flex flex-wrap items-center gap-x-2">
                    <span className="font-medium">{name}</span>
                    {phone && <span className="font-mono text-xs text-muted-foreground">0{phone.replace(/\D/g, "").slice(-10)}</span>}
                  </div>
                  <div className="mt-0.5 flex gap-1 text-[13px] text-muted-foreground">
                    <MapPinIcon className="mt-0.5 size-3.5 shrink-0" />
                    {formatAddress(address)}
                  </div>
                  {pathaoProblems(
                    { fullName: address.fullName, phone: address.phone, fullAddress: address.fullAddress, city: address.city, country: address.country ?? "" },
                    order.customerName,
                    order.customerPhone
                  ).map((p) => (
                    <p key={p} className="mt-1 text-xs text-amber-700 dark:text-amber-400">{p}</p>
                  ))}
                </div>
                <Button size="sm" variant="ghost" className="shrink-0 text-primary hover:text-primary" onClick={editAddress}>
                  <PencilIcon />
                  Edit
                </Button>
              </div>
            ) : (
              <p className="rounded-xl bg-destructive/10 px-3.5 py-3 text-sm text-destructive">This order has no shipping address, so Pathao can’t take it.</p>
            )}
          </div>

          <div className={section}>
            <h3 className={sectionTitle}><StoreIcon />Pickup & service</h3>
            <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
              {pick("Pickup store", storeId, storeItems, setStoreId, stores === null)}
              <Field>
                <FieldLabel>Delivery</FieldLabel>
                {toggle(deliveryType, [{ value: "NORMAL", label: "Normal", icon: TruckIcon }, { value: "ON_DEMAND", label: "On demand", icon: ZapIcon }], (v) => setDeliveryType(v as PathaoDeliveryType))}
              </Field>
              <Field>
                <FieldLabel>Item type</FieldLabel>
                {toggle(itemType, [{ value: "PARCEL", label: "Parcel", icon: PackageIcon }, { value: "DOCUMENT", label: "Document", icon: FileTextIcon }], (v) => setItemType(v as PathaoItemType))}
              </Field>
            </div>
            {stores === null && <p className="-mt-1 text-xs text-muted-foreground">Loading your Pathao stores...</p>}
            {store && <p className="-mt-1 text-xs text-muted-foreground">Picked up from {store.store_address}</p>}
            {storeError && <p className="-mt-1 text-xs text-amber-700 dark:text-amber-400">Couldn’t load your stores ({storeError}). The default store from the backend is used.</p>}
          </div>

          <div className={section}>
            <h3 className={sectionTitle}><PackageIcon />Parcel</h3>
            <div className="grid gap-3 sm:grid-cols-[1.4fr_0.6fr_1fr]">
              <Field>
                <FieldLabel htmlFor="pathao-weight">Weight</FieldLabel>
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="outline" aria-label="Half a kilo less" onClick={() => setWeight(String(Math.max(0.5, kg - 0.5)))} disabled={!(kg > 0.5)}>
                    −
                  </Button>
                  <div className="relative flex-1">
                    <Input id="pathao-weight" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} className="pr-8 text-center tabular-nums" />
                    <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs text-muted-foreground">kg</span>
                  </div>
                  <Button size="icon" variant="outline" aria-label="Half a kilo more" onClick={() => setWeight(String(Math.min(10, (kg || 0) + 0.5)))} disabled={kg >= 10}>
                    +
                  </Button>
                </div>
                <span className="flex gap-1">
                  {[0.5, 1, 2, 5].map((w) => (
                    <button key={w} type="button" onClick={() => setWeight(String(w))} className={chip(kg === w)}>
                      {w} kg
                    </button>
                  ))}
                </span>
              </Field>
              <Field>
                <FieldLabel htmlFor="pathao-qty">Items</FieldLabel>
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="outline" aria-label="One item less" onClick={() => setQuantity(String(Math.max(1, Number(quantity) - 1)))} disabled={!(Number(quantity) > 1)}>
                    −
                  </Button>
                  <Input id="pathao-qty" inputMode="numeric" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="text-center tabular-nums" />
                  <Button size="icon" variant="outline" aria-label="One item more" onClick={() => setQuantity(String((Number(quantity) || 0) + 1))}>
                    +
                  </Button>
                </div>
              </Field>
              <Field>
                <FieldLabel htmlFor="pathao-cod">Cash to collect</FieldLabel>
                <div className="relative">
                  <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">৳</span>
                  <Input id="pathao-cod" inputMode="numeric" value={collect} onChange={(e) => setCollect(e.target.value)} className="pl-7 tabular-nums" />
                </div>
                <span className="flex gap-1">
                  {due > 0 && (
                    <button type="button" onClick={() => setCollect(String(Math.round(due)))} className={chip(collect === String(Math.round(due)))}>
                      Balance due
                    </button>
                  )}
                  <button type="button" onClick={() => setCollect("0")} className={chip(collect === "0")}>
                    Nothing
                  </button>
                </span>
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="pathao-desc">What’s inside</FieldLabel>
              <Input id="pathao-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={255} />
            </Field>
          </div>

          <div className={section}>
            <div className="flex items-baseline justify-between gap-2">
              <h3 className={sectionTitle}><StickyNoteIcon />Note for the rider</h3>
              <span className="text-xs text-muted-foreground tabular-nums">{instruction.length}/255</span>
            </div>
            <Textarea id="pathao-note" value={instruction} onChange={(e) => setInstruction(e.target.value)} maxLength={255} placeholder="Call before delivery" className="min-h-16" aria-label="Note for the rider" />
            <span className="-mt-1 flex flex-wrap gap-1">
              {["Call before delivery", "Handle with care", "Fragile"].map((t) => {
                const on = instruction.includes(t)
                // A second click takes the phrase back out of the note.
                const next = on
                  ? instruction.replace(t, "").replace(/^[.\s]+|[.\s]+$/g, "").replace(/(\.\s*){2,}/g, ". ")
                  : [instruction.trim(), t].filter(Boolean).join(". ")
                return (
                  <button key={t} type="button" aria-pressed={on} onClick={() => setInstruction(next.slice(0, 255))} className={chip(on)}>
                    {on ? "✓" : "+"} {t}
                  </button>
                )
              })}
            </span>
          </div>

          {reply && (
            <div className="border-t px-6 py-4">
              <PathaoLog
                ok={reply.ok}
                reply={reply.body}
                at={reply.at}
                order={order}
                parcel={`${quantity} ${Number(quantity) === 1 ? "item" : "items"} · ${weight} kg · ${deliveryType === "NORMAL" ? "Normal" : "On demand"}`}
                collect={Number(collect)}
              />
            </div>
          )}
        </div>

        {error && !reply && <p className="border-t bg-destructive/10 px-6 py-2.5 text-sm text-destructive">{error}</p>}

        <div className="flex flex-wrap items-center gap-3 border-t bg-muted/40 px-6 py-3">
          <div className="mr-auto min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="text-[13px] text-muted-foreground">Rider collects</span>
              <span className="text-lg font-bold tabular-nums">{Number(collect) > 0 ? taka(Number(collect)) : "Nothing"}</span>
            </div>
            <div className="text-xs text-muted-foreground">
              {deliveryType === "NORMAL" ? "Normal" : "On demand"} · {itemType === "PARCEL" ? "Parcel" : "Document"} · {weight} kg · {quantity}{" "}
              {Number(quantity) === 1 ? "item" : "items"} · delivery charge shown after booking
            </div>
          </div>
          {reply?.ok ? (
            <Button onClick={onClose}>Done</Button>
          ) : (
            <>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={book} disabled={saving || !address || addressForm !== null} title={addressForm ? "Save or cancel the address first" : undefined}>
                <PathaoMark />
                {saving ? "Booking..." : "Book parcel"}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ShipmentDialog({ orderId, orderNumber, codAmount, onClose }: { orderId: string; orderNumber: string; codAmount: number; onClose: () => void }) {
  const [carrier, setCarrier] = useState<CourierCarrier | null>(null)
  const [service, setService] = useState("")
  const [consignmentId, setConsignmentId] = useState("")
  const [trackingNumber, setTrackingNumber] = useState("")
  const [trackingUrl, setTrackingUrl] = useState("")
  const [cod, setCod] = useState(codAmount > 0 ? String(codAmount) : "")
  const [charge, setCharge] = useState("")
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!carrier) return setError("Pick the courier.")
    if ((cod && Number.isNaN(Number(cod))) || (charge && Number.isNaN(Number(charge)))) return setError("Amounts must be numbers.")
    setSaving(true)
    // The API rejects empty strings (trackingUrl must be a URL), so blanks are left out.
    const res = await createShipment(orderId, {
      carrier,
      service: service.trim() || undefined,
      consignmentId: consignmentId.trim() || undefined,
      trackingNumber: trackingNumber.trim() || undefined,
      trackingUrl: trackingUrl.trim() || undefined,
      codAmount: cod ? Number(cod) : undefined,
      shippingAmount: charge ? Number(charge) : undefined,
    })
    setSaving(false)
    if (!res.success) return setError(res.error)
    toast.success(`Shipment added to ${orderNumber}`)
    onClose()
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add shipment</DialogTitle>
          <DialogDescription>Record the parcel you booked with the courier. Use “Mark shipped” on the order once it leaves the warehouse.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field>
            <FieldLabel>Courier</FieldLabel>
            <Select value={carrier} items={carrierItems} onValueChange={(v) => setCarrier(v as CourierCarrier)}>
              <SelectTrigger aria-label="Courier" className="w-full"><SelectValue placeholder="Pick a courier" /></SelectTrigger>
              <SelectContent>
                {carrierItems.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="ship-service">Service</FieldLabel>
            <Input id="ship-service" value={service} onChange={(e) => setService(e.target.value)} placeholder="Regular, express..." />
          </Field>
          <Field>
            <FieldLabel htmlFor="ship-consignment">Consignment ID</FieldLabel>
            <Input id="ship-consignment" value={consignmentId} onChange={(e) => setConsignmentId(e.target.value)} className="font-mono" />
          </Field>
          <Field>
            <FieldLabel htmlFor="ship-tracking">Tracking number</FieldLabel>
            <Input id="ship-tracking" value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} className="font-mono" />
          </Field>
          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="ship-url">Tracking link</FieldLabel>
            <Input id="ship-url" type="url" value={trackingUrl} onChange={(e) => setTrackingUrl(e.target.value)} placeholder="https://" />
          </Field>
          <Field>
            <FieldLabel htmlFor="ship-cod">Collect on delivery (৳)</FieldLabel>
            <Input id="ship-cod" inputMode="decimal" value={cod} onChange={(e) => setCod(e.target.value)} placeholder="0" className="text-right tabular-nums" />
          </Field>
          <Field>
            <FieldLabel htmlFor="ship-charge">Courier charge (৳)</FieldLabel>
            <Input id="ship-charge" inputMode="decimal" value={charge} onChange={(e) => setCharge(e.target.value)} placeholder="0" className="text-right tabular-nums" />
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

function RefundDialog({ orderId, max, onClose }: { orderId: string; max: number; onClose: () => void }) {
  const [amount, setAmount] = useState(String(max))
  const [reason, setReason] = useState("")
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)

  async function save() {
    const value = Number(amount)
    if (!(value > 0) || value > max) return setError(`Enter an amount from ৳0.01 to ${taka(max, 2)}.`)
    if (!reason.trim()) return setError("Give a reason.")
    setSaving(true)
    const res = await createRefundRequest(orderId, Math.round(value * 100) / 100, reason.trim())
    setSaving(false)
    if (!res.success) return setError(res.error)
    toast.success("Refund requested", { description: "Approve it, then mark it refunded once the money is sent." })
    onClose()
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Refund this order</DialogTitle>
          <DialogDescription>Creates a refund request. Up to {taka(max, 2)} of what was paid can still be refunded.</DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor="refund-amount">Amount (৳)</FieldLabel>
          <Input id="refund-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="text-right tabular-nums" />
        </Field>
        <Field>
          <FieldLabel htmlFor="refund-reason">Reason</FieldLabel>
          <Textarea id="refund-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Item arrived damaged" />
        </Field>
        <DialogFooter className="items-center">
          {error && <p className="mr-auto text-sm text-destructive">{error}</p>}
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Request refund"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
