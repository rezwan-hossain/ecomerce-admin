"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import {
  ArrowLeftIcon,
  BadgeCheckIcon,
  BanknoteIcon,
  CheckIcon,
  CircleCheckIcon,
  MessageCircleIcon,
  ChevronRightIcon,
  CreditCardIcon,
  LandmarkIcon,
  ShoppingCartIcon,
  SmartphoneIcon,
  WalletIcon,
  CircleXIcon,
  CopyIcon,
  ExternalLinkIcon,
  FileTextIcon,
  LockIcon,
  MailIcon,
  MinusIcon,
  MapPinIcon,
  PackageIcon,
  InfoIcon,
  PackageCheckIcon,
  PackageOpenIcon,
  PencilIcon,
  PhoneIcon,
  PlusIcon,
  PrinterIcon,
  ReceiptIcon,
  RefreshCwIcon,
  StickyNoteIcon,
  StoreIcon,
  TagIcon,
  TriangleAlertIcon,
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
  receiveReturnedItems,
  reviewRefund,
  updateOrderStatus,
  updateShipmentStatus,
} from "@/app/actions/order.actions"
import { type PromotionInfo } from "@/app/actions/marketing.actions"
import { bookPathaoShipment, getPathaoStores, syncPathaoShipment } from "@/app/actions/pathao.actions"
import { Card, fmtDate, fmtDateTime, Kpis, label, n0, Pill, RackTag, rel, taka, type Tone, WarehouseTag } from "@/components/inventory/inventory-ui"
import { MovementQuantity, MovementTag, movementRacks } from "@/components/inventory/movements-table"
import { CANCELLABLE, cancelBlockedBy, liveShipment, CancelDialog, CARRIER_LABEL, FINISHED, followsShipment, localPhone, NEXT, ORDER_STATUS_LABEL, PAYMENT_LABEL, PROVIDER_LABEL, RefreshButton, SourceBadge, whatsApp } from "@/components/orders/orders-table"
import { offerSentence, offerText } from "@/components/marketing/marketing-utils"
import { PrintInvoice } from "@/components/orders/print-invoice"
import { StatusBadge } from "@/components/status-badge"
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { getReturnState } from "@/lib/orders/return-state"
import { cn } from "@/lib/utils"
import type { LedgerMovement, StockLevel, VariantStockDetail } from "@/types/inventory.type"
import { formatAddress, pathaoAddress, type CourierCarrier, type Order, type OrderAddress, type OrderAddressBody, type OrderDetail, type OrderStatus, type PaymentStatus, type Shipment, type ShipmentStatus } from "@/types/order.type"
import type { PathaoDeliveryType, PathaoItemType, PathaoStore } from "@/types/pathao.type"

// The next step on the happy path, as the backend allows it (ORDER_STATUS_TRANSITIONS).
const STEPS: OrderStatus[] = ["PENDING", "CONFIRMED", "PROCESSING", "READY_TO_SHIP", "SHIPPED", "DELIVERED", "COMPLETED"]
const STEP_LABEL: Partial<Record<OrderStatus, string>> = { PENDING: "Placed" }
const TIMELINE_ICON: Partial<Record<OrderStatus, typeof PackageIcon>> = {
  PENDING: ShoppingCartIcon,
  CONFIRMED: CircleCheckIcon,
  PROCESSING: PackageOpenIcon,
  READY_TO_SHIP: PackageIcon,
  SHIPPED: TruckIcon,
  DELIVERED: PackageCheckIcon,
  COMPLETED: BadgeCheckIcon,
  CANCELLED: CircleXIcon,
  FAILED: CircleXIcon,
  REFUNDED: Undo2Icon,
  RETURNED: Undo2Icon,
  PARTIALLY_RETURNED: Undo2Icon,
}
const STOPPED: OrderStatus[] = ["CANCELLED", "FAILED", "REFUNDED", "RETURNED", "PARTIALLY_RETURNED"]
const OPEN_PAYMENT = ["PENDING", "PROCESSING"]
// Shipment, payment and refund statuses that finished well or badly; the rest are in progress.
export const TONE: Record<string, Tone> = {
  DELIVERED: "green", PAID: "green", PARTIALLY_PAID: "amber", APPROVED: "blue", PROCESSED: "green",
  FAILED: "red", RETURNED: "red", CANCELLED: "red", REJECTED: "red",
}
const carrierItems = Object.entries(CARRIER_LABEL).map(([value, text]) => ({ value, label: text }))
const SHIPMENT_STATUSES: ShipmentStatus[] = ["PENDING", "PROCESSING", "SHIPPED", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED", "FAILED", "RETURNED", "CANCELLED"]
export const shipmentStatusItems = SHIPMENT_STATUSES.map((value) => ({ value, label: label(value) }))
// The backend refuses status changes once a shipment ends.
// Not a real shipment status: DELIVERED plus the cash the rider collected.
export const PARTLY_DELIVERED = "PARTLY_DELIVERED"
// The shipment select's options; "Partly delivered" only while the courier still has cash to collect.
export function shipmentStatusOptions(codPending: boolean): { value: string; label: string }[] {
  if (!codPending) return shipmentStatusItems
  const at = shipmentStatusItems.findIndex((t) => t.value === "DELIVERED") + 1
  return [...shipmentStatusItems.slice(0, at), { value: PARTLY_DELIVERED, label: "Partly delivered" }, ...shipmentStatusItems.slice(at)]
}
export const SHIPMENT_DONE: ShipmentStatus[] = ["DELIVERED", "CANCELLED", "RETURNED", "FAILED"]
// The order follows its shipment. These would also ship the order (taking the stock), so they ask first.
const CONFIRM_TEXT: Partial<Record<ShipmentStatus, string>> = {
  RETURNED: "The order will move to Shipped and then Returned, and the cash-on-delivery payment will be marked failed.",
  DELIVERED: "The order will move to Shipped and then Delivered.",
}
export const needsShipmentConfirm = (orderStatus: OrderStatus, status: ShipmentStatus) => orderStatus === "READY_TO_SHIP" && CONFIRM_TEXT[status] !== undefined

export function ConfirmShipmentDialog({ status, onConfirm, onClose }: { status: ShipmentStatus; onConfirm: () => void; onClose: () => void }) {
  return (
    <AlertDialog open onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Mark this parcel as {label(status).toLowerCase()}?</AlertDialogTitle>
          <AlertDialogDescription>{CONFIRM_TEXT[status]}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button
            onClick={() => {
              onConfirm()
              onClose()
            }}
          >
            Mark {label(status).toLowerCase()}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// A partial delivery's payment is the cash the customer actually gave.
// Same rule as the backend: refunded payments still count as received; refunds are shown on their own line.
const RECEIVED: PaymentStatus[] = ["PAID", "PARTIALLY_PAID", "REFUNDED", "PARTIALLY_REFUNDED"]
const sumPaid = (o: Pick<Order, "payments">) => o.payments.filter((p) => RECEIVED.includes(p.status)).reduce((s, p) => s + Number(p.amount), 0)

function stockTone(l: StockLevel, threshold: number) {
  if (l.available <= 0) return "bad"
  if (l.available <= threshold) return "warn"
  return undefined
}

function Address({ address, customerPhone, shipping = false }: { address: OrderAddress; customerPhone: string | null; shipping?: boolean }) {
  const oneLine = formatAddress(address)
  // Someone else receiving the parcel is worth knowing before the rider calls.
  const otherPhone = customerPhone && localPhone(customerPhone) !== localPhone(address.phone)
  return (
    <address className="flex flex-col gap-2 text-sm not-italic">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-medium">{address.fullName}</div>
          {address.company && <div className="truncate text-xs text-muted-foreground">{address.company}</div>}
          <div className="flex items-center gap-1 font-mono text-[13px] text-muted-foreground">
            {localPhone(address.phone)}
            {otherPhone && <span className="font-sans text-[11px] text-amber-700 dark:text-amber-400">· not the customer&apos;s phone</span>}
          </div>
        </div>
        <span className="flex shrink-0">
          <Button variant="ghost" size="icon-xs" className="text-muted-foreground" nativeButton={false} render={<a href={`tel:${address.phone}`} />}>
            <PhoneIcon />
            <span className="sr-only">Call {address.fullName}</span>
          </Button>
          <Button variant="ghost" size="icon-xs" className="text-emerald-600 hover:text-emerald-700" nativeButton={false} render={<a href={whatsApp(address.phone)} target="_blank" rel="noreferrer" />}>
            <MessageCircleIcon />
            <span className="sr-only">WhatsApp {address.fullName}</span>
          </Button>
        </span>
      </div>
      <p className="leading-relaxed">{address.fullAddress}</p>
      <div className="flex flex-wrap gap-1.5 text-[11px]">
        {address.thana && (
          <span className="rounded-md bg-muted px-1.5 py-0.5">
            <span className="text-muted-foreground">Thana</span> <span className="font-medium">{address.thana}</span>
          </span>
        )}
        {/* Only the parcel's address goes to the courier. */}
        {!address.thana && shipping && (
          <span className="rounded-md bg-amber-50 px-1.5 py-0.5 font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">No thana — couriers need it</span>
        )}
        <span className="rounded-md bg-muted px-1.5 py-0.5">
          <span className="text-muted-foreground">District</span> <span className="font-medium">{address.city}</span>
        </span>
        {address.country && (
          <span className="rounded-md bg-muted px-1.5 py-0.5">
            <span className="text-muted-foreground">Country</span> <span className="font-medium">{address.country}</span>
          </span>
        )}
      </div>
      <div className="flex gap-1">
        <Button variant="outline" size="xs" onClick={() => navigator.clipboard.writeText(`${address.fullName}, ${localPhone(address.phone)}, ${oneLine}`).then(() => toast.success("Address copied"))}>
          <CopyIcon />
          Copy
        </Button>
        <Button variant="outline" size="xs" nativeButton={false} render={<a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(oneLine)}`} target="_blank" rel="noreferrer" />}>
          <MapPinIcon />
          Map
        </Button>
      </div>
    </address>
  )
}

export function OrderDetailPage({
  order,
  images,
  stock,
  movements,
  history,
  promotionRules,
}: {
  order: OrderDetail
  images: Record<string, string>
  stock: Record<string, VariantStockDetail>
  movements: LedgerMovement[]
  history: Order[]
  promotionRules: Record<string, PromotionInfo> // promotion id → its rule (missing if deleted)
}) {
  const [busy, setBusy] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [shipping, setShipping] = useState(false)
  const [bookingPathao, setBookingPathao] = useState(false)
  const [pathaoLog, setPathaoLog] = useState<{ ok: boolean; reply: unknown; at: string } | null>(null)
  const [refunding, setRefunding] = useState(false)
  const [receiving, setReceiving] = useState(false)
  const [confirming, setConfirming] = useState<{ shipmentId: string; status: ShipmentStatus } | null>(null)
  const [partlyDelivering, setPartlyDelivering] = useState<string | null>(null)
  const [markingCancelled, setMarkingCancelled] = useState<Shipment | null>(null)
  const [editingAddress, setEditingAddress] = useState<OrderAddress | null>(null)
  const [readdressed, setReaddressed] = useState(false)

  const next = NEXT[order.status]
  const stopped = STOPPED.includes(order.status)
  const units = order.items.reduce((s, i) => s + i.quantity, 0)
  const total = Number(order.totalAmount)
  const paid = sumPaid(order)
  const returnState = getReturnState(order)
  // A parcel marked returned before the order was shipped leaves the order stuck on SHIPPED.
  const stuckReturn =
    order.status === "SHIPPED" && order.shipments.some((s) => s.status === "RETURNED") && !order.shipments.some((s) => s.status !== "RETURNED" && s.status !== "CANCELLED")
  const partlyPaid = order.payments.find((p) => p.status === "PARTIALLY_PAID")
  // After a partial delivery the rest isn't owed: those items come back instead.
  let due = total - paid
  if (partlyPaid) due = 0
  const refunded = order.refundRequests.filter((r) => r.status === "PROCESSED").reduce((s, r) => s + Number(r.amount), 0)
  // Paid money not yet refunded or promised in an open request.
  const refundable = paid - order.refundRequests.filter((r) => r.status !== "REJECTED").reduce((s, r) => s + Number(r.amount), 0)
  let paidHint = "nothing due"
  if (due > 0 && !stopped) paidHint = `${taka(due)} still due`
  else if (refunded > 0) paidHint = `${taka(refunded)} refunded`
  const codOpen = order.payments.some((p) => p.method === "CASH_ON_DELIVERY" && OPEN_PAYMENT.includes(p.status))
  // A partial delivery only makes sense while the courier still has cash to collect.
  const codPending = order.payments.find((p) => p.provider === "COD" && p.status === "PENDING")
  const statusItems = shipmentStatusOptions(codPending !== undefined)
  const logs = [...order.statusLogs].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const reachedAt = new Map(logs.map((l) => [l.toStatus, l.createdAt]))
  const lastLog = logs.at(-1)
  const canShip = ["CONFIRMED", "PROCESSING", "READY_TO_SHIP"].includes(order.status)
  // Addresses can change until the order ships; the shipping one not while a courier holds the parcel with the old one.
  const addressEditable = CANCELLABLE.includes(order.status)
  const booked = liveShipment(order)
  const shippingLocked = booked
    ? `Booked with ${CARRIER_LABEL[booked.carrier]}${booked.consignmentId ? ` (${booked.consignmentId})` : ""}. Cancel the parcel first, then change the address and book again.`
    : undefined
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
  // One row per promotion: what it saved and on which lines (or the whole order).
  const promotionRows = new Map<string, { id: string; name: string; saved: number; items: string[]; onOrder: boolean }>()
  for (const i of order.items) {
    const p = i.metadata?.appliedPromotion
    if (!p) continue
    const row = promotionRows.get(p.id) ?? { id: p.id, name: p.name, saved: 0, items: [], onOrder: false }
    row.saved += Number(i.discountAmount)
    row.items.push(i.productName)
    promotionRows.set(p.id, row)
  }
  for (const d of order.discounts) {
    const key = d.promotionId ?? d.id
    const row = promotionRows.get(key) ?? { id: key, name: d.promotionName, saved: 0, items: [], onOrder: false }
    row.saved += Number(d.amount)
    row.onOrder = true
    promotionRows.set(key, row)
  }

  const detailRows: { label: string; value: string; hint?: string; copy?: string; mono?: boolean; title?: string }[] = [
    { label: "Order number", value: order.orderNumber, copy: order.orderNumber, mono: true },
    { label: "Order ID", value: `${order.id.slice(0, 8)}…${order.id.slice(-4)}`, copy: order.id, mono: true, title: order.id },
    { label: "Checkout", value: order.userId ? "Customer account" : "Guest checkout" },
    { label: "Currency", value: `৳ ${order.currency}` },
    { label: "Placed", value: fmtDateTime(placedAt), hint: rel(placedAt) },
  ]
  if (order.completedAt) detailRows.push({ label: "Completed", value: fmtDateTime(order.completedAt), hint: `took ${duration(placedAt, order.completedAt)}` })
  if (order.cancelledAt) detailRows.push({ label: "Cancelled", value: fmtDateTime(order.cancelledAt), hint: `after ${duration(placedAt, order.cancelledAt)}` })
  const changes = order.statusLogs.length
  detailRows.push({ label: "Last change", value: fmtDateTime(order.updatedAt), hint: `${rel(order.updatedAt)} · ${n0(changes)} status ${changes === 1 ? "change" : "changes"}` })

  const shippingAddress = order.addresses.find((a) => a.type === "SHIPPING")
  const billing = order.addresses.find((a) => a.type === "BILLING")
  // Checkout copies the shipping address into billing when the customer gives only one.
  const sameAddress = (a: OrderAddress, b: OrderAddress) =>
    a.fullName === b.fullName && a.phone === b.phone && a.fullAddress === b.fullAddress && a.thana === b.thana && a.city === b.city
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
  // Delivered out of finished orders, the same rate the orders list shows.
  const finished = history.filter((o) => FINISHED.includes(o.status)).length
  const delivered = history.filter((o) => o.status === "DELIVERED" || o.status === "COMPLETED").length
  const returned = history.filter((o) => o.status === "RETURNED" || o.status === "PARTIALLY_RETURNED").length
  const cancelled = history.filter((o) => o.status === "CANCELLED" || o.status === "FAILED").length
  const deliveryRate = finished ? Math.round((delivered / finished) * 100) : null
  let deliveryTone = "text-emerald-700 dark:text-emerald-400"
  if (deliveryRate !== null && deliveryRate < 80) deliveryTone = "text-amber-700 dark:text-amber-400"
  if (deliveryRate !== null && deliveryRate < 50) deliveryTone = "text-destructive"

  async function advance() {
    if (!next) return
    setBusy(true)
    const res = await updateOrderStatus(order.id, next.status)
    setBusy(false)
    if (!res.success) return toast.error(res.error)
    toast.success(`Order is now ${ORDER_STATUS_LABEL[next.status].toLowerCase()}`)
  }

  async function markReturned() {
    setBusy(true)
    const res = await updateOrderStatus(order.id, "RETURNED", "Returned by courier")
    setBusy(false)
    if (!res.success) return toast.error(res.error)
    toast.success("Order marked returned")
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

  function pickShipmentStatus(shipmentId: string, status: ShipmentStatus | typeof PARTLY_DELIVERED) {
    if (status === PARTLY_DELIVERED) setPartlyDelivering(shipmentId)
    else if (needsShipmentConfirm(order.status, status)) setConfirming({ shipmentId, status })
    else setShipmentStatus(shipmentId, status)
  }

  async function setShipmentStatus(shipmentId: string, status: ShipmentStatus) {
    setBusy(true)
    const res = await updateShipmentStatus(order.id, shipmentId, status)
    setBusy(false)
    if (!res.success) return toast.error(res.error)
    toast.success(`Shipment is now ${label(status).toLowerCase()}`)
  }

  // The dialog shows the error itself, so hand the result back.
  async function saveShipmentStatus(shipmentId: string, status: ShipmentStatus, collectedAmount: number) {
    const res = await updateShipmentStatus(order.id, shipmentId, status, collectedAmount)
    if (res.success) toast.success("Recorded as partly delivered", { description: `${taka(collectedAmount)} collected. Receive the items that came back.` })
    return res
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

  // The parcel was cancelled in the courier's panel. Pathao can confirm it with a sync; otherwise the admin marks it by hand.
  async function parcelCancelled(s: Shipment) {
    if (s.carrier === "PATHAO" && s.consignmentId) {
      setBusy(true)
      const res = await syncPathaoShipment(order.id, s.id)
      setBusy(false)
      if (res.success && res.data.status === "CANCELLED") {
        return toast.success("Pathao confirms the parcel is cancelled", { description: "You can cancel the order now." })
      }
    }
    setMarkingCancelled(s)
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
            <span title={order.status === "PARTIALLY_RETURNED" ? `${n0(order.items.reduce((s, i) => s + i.returnedQuantity, 0))} of ${n0(units)} items back in stock — the customer kept the rest.` : undefined}>
              <StatusBadge status={ORDER_STATUS_LABEL[order.status]} />
            </span>
            {payment && <Pill tone={payment.status === "CANCELLED" ? "grey" : (TONE[payment.status] ?? "amber")}>{paymentPillText(payment)}</Pill>}
          </div>
          <p className="text-sm text-muted-foreground">
            Placed {fmtDateTime(placedAt)} ({rel(placedAt)}){payment && ` · ${label(payment.method)}`} · {order.userId ? "Account" : "Guest checkout"}
          </p>
        </div>
        <div className="flex gap-2 print:hidden">
          <RefreshButton />
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => window.print()}>
            <PrinterIcon />
            Print
          </Button>
          {CANCELLABLE.includes(order.status) && (
            // A disabled button gets no hover, so the hint sits on the wrapper.
            <span title={cancelBlockedBy(order)}>
              <Button variant="outline" size="sm" className="text-destructive" onClick={() => setCancelling(true)} disabled={busy || !!cancelBlockedBy(order)}>
                Cancel order
              </Button>
            </span>
          )}
          {next && !stuckReturn && !followsShipment(order, next.status) && (
            <Button size="sm" onClick={advance} disabled={busy}>
              {next.text}
            </Button>
          )}
          {next && followsShipment(order, next.status) && (
            <span className="inline-flex items-center gap-1.5 self-center rounded-full border bg-muted/50 px-2.5 py-1 text-xs text-muted-foreground">
              <InfoIcon className="size-3.5" />
              Change the shipment status, the order follows it
            </span>
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
          { label: "Paid", value: taka(paid), hint: paidHint, warn: due > 0 && !stopped },
          { label: "Discount", value: taka(Number(order.discountAmount)), hint: promotions.join(", ") || "no promotion" },
          { label: "Cost of goods", value: costKnown ? taka(cost) : "—", hint: costHint },
          { label: "Customer orders", value: n0(history.length), hint: `${taka(spent)} spent in total` },
          { label: "Shipments", value: n0(order.shipments.length), hint: order.shipments[0] ? label(order.shipments[0].status) : "not shipped yet" },
        ]}
      />

      <div className="grid gap-4 px-4 md:gap-6 lg:px-6 xl:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-4 md:gap-6 xl:col-span-2">
          {stuckReturn && (
            <Alert className="rounded-2xl border-amber-300 bg-amber-50 px-4 py-3 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200 *:data-[slot=alert-description]:text-amber-800 dark:*:data-[slot=alert-description]:text-amber-300">
              <PackageOpenIcon />
              <AlertTitle className="font-semibold">The parcel came back, but the order still says Shipped</AlertTitle>
              <AlertDescription>Mark the order returned, then receive the items back into stock.</AlertDescription>
              <AlertAction>
                <Button size="sm" onClick={markReturned} disabled={busy}>
                  Mark order returned
                </Button>
              </AlertAction>
            </Alert>
          )}

          {returnState.kind !== "none" && (
            <ReturnAlert
              title={returnState.kind === "returned" ? "Parcel returned by courier" : "Partly delivered"}
              text={
                returnState.kind === "returned"
                  ? "The customer refused it or couldn't be reached. Receive the items back into stock when the parcel arrives."
                  : `The customer kept some items and paid ${taka(returnState.collected)} of ${taka(returnState.ordered)}. Receive the items that came back.`
              }
              items={order.items}
              images={images}
              movements={movements}
              onReceive={() => setReceiving(true)}
            />
          )}
          {returnState.kind === "none" && order.items.some((i) => i.returnedQuantity > 0) && (
            <ReturnAlert
              title="Returned items are back in stock"
              text="Everything that came back has been received."
              items={order.items}
              images={images}
              movements={movements}
            />
          )}

          <Card title="Items" action={<span className="hidden text-xs text-muted-foreground sm:inline">Available stock and pick rack right now</span>}>
            <ul className="flex flex-col">
              {order.items.map((i) => {
                const image = i.productId ? images[i.productId] : undefined
                const discount = Number(i.discountAmount)
                const variant = i.variantId ? stock[i.variantId] : undefined
                const allBack = i.returnedQuantity > 0 && i.returnedQuantity >= i.quantity
                return (
                  <li key={i.id} className={cn("flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border/60 px-4 py-3.5", allBack && "opacity-55")}>
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
                        {i.metadata?.appliedPromotion && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-px text-[11px] text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                            <TagIcon className="size-3" />
                            {i.metadata.appliedPromotion.name}
                          </span>
                        )}
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
                      {i.returnedQuantity > 0 && <div className="text-xs text-muted-foreground">{n0(i.returnedQuantity)} returned</div>}
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

          {promotionRows.size > 0 && (
            <Card
              title="Promotions"
              action={
                <Link href="/marketing/promotions" className="text-xs text-muted-foreground hover:text-primary hover:underline">
                  Manage promotions
                </Link>
              }
            >
              <ul className="flex flex-col">
                {[...promotionRows.values()].map((row) => {
                  const rule = promotionRules[row.id]
                  let statusTone: Tone = "grey"
                  if (rule?.status === "ACTIVE") statusTone = "green"
                  if (rule?.status === "SCHEDULED") statusTone = "blue"
                  return (
                    <li key={row.id} className="flex items-start gap-3 border-t border-border/60 px-4 py-3.5">
                      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-900">
                        <TagIcon className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-medium">{row.name}</span>
                          {rule && <Pill tone="green">{offerText(rule)}</Pill>}
                          {rule && <Pill tone={statusTone}>{label(rule.status)}</Pill>}
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">{rule ? offerSentence(rule) : "This promotion has since been deleted."}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {row.onOrder ? "Applied to the whole order" : `Applied to ${row.items.join(", ")}`}
                          {rule?.endsAt && ` · ${new Date(rule.endsAt) < new Date() ? "ended" : "ends"} ${fmtDate(rule.endsAt)}`}
                          {rule?.maxDiscountAmount && row.saved >= rule.maxDiscountAmount && (
                            <span className="font-medium text-amber-700 dark:text-amber-400"> · hit the {taka(rule.maxDiscountAmount)} cap</span>
                          )}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="font-semibold text-emerald-700 tabular-nums dark:text-emerald-400">−{taka(row.saved, 2)}</div>
                        <div className="text-[11px] text-muted-foreground">saved</div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </Card>
          )}

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
                        {s.metadata?.lastChange && (
                          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                            {label(s.metadata.lastChange.status)} set by
                            <SourceBadge source={s.metadata.lastChange.source} courier={s.metadata.lastChange.courier} at={s.metadata.lastChange.at} userId={s.metadata.lastChange.userId} />
                            {rel(s.metadata.lastChange.at)}
                          </div>
                        )}
                        {s.metadata?.pathaoStatus && (
                          <div className="text-xs text-muted-foreground">
                            Pathao: <span className="font-medium text-foreground">{pathaoText(s.metadata.pathaoStatus)}</span>
                            {s.metadata.pathaoStatusAt && ` · ${rel(s.metadata.pathaoStatusAt)}`}
                          </div>
                        )}
                      </div>
                      {CANCELLABLE.includes(order.status) && !SHIPMENT_DONE.includes(s.status) && (
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => parcelCancelled(s)} disabled={busy} title="Cancelled it in the courier's panel? Record it here">
                          <XIcon />
                          Parcel cancelled at courier
                        </Button>
                      )}
                      {s.carrier === "PATHAO" && s.consignmentId && !SHIPMENT_DONE.includes(s.status) && (
                        <Button size="sm" variant="ghost" onClick={() => syncPathao(s.id)} disabled={busy} title="Ask Pathao for the latest status">
                          <RefreshCwIcon className={cn(busy && "animate-spin")} />
                          Sync
                        </Button>
                      )}
                      {SHIPMENT_DONE.includes(s.status) ? (
                        <Pill tone={TONE[s.status] ?? "grey"}>{label(s.status)}</Pill>
                      ) : (
                        <Select value={s.status} items={statusItems} onValueChange={(v) => pickShipmentStatus(s.id, v as ShipmentStatus)} disabled={busy}>
                          <SelectTrigger size="sm" aria-label="Shipment status" className="w-40"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {statusItems.map((t) => (
                              <SelectItem key={t.value} value={t.value}>
                                {t.label}
                              </SelectItem>
                            ))}
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
                          {taka(courierFee(s), 2)}
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
                            {movementRacks(m) === "UNASSIGNED" && <span className="text-[11px] text-muted-foreground">no rack</span>}
                            {movementRacks(m) && movementRacks(m) !== "UNASSIGNED" && <RackTag code={movementRacks(m)} />}
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

          <Card
            title="Timeline"
            action={
              <span className="text-xs text-muted-foreground">
                {n0(logs.length)} {logs.length === 1 ? "event" : "events"}
                {logs[0] && ` since ${fmtDate(logs[0].createdAt)}`}
              </span>
            }
          >
            <ol className="flex flex-col px-4 pb-4">
              {[...logs].reverse().map((log, index, newestFirst) => {
                const Icon = TIMELINE_ICON[log.toStatus] ?? CircleCheckIcon
                const latest = index === 0
                const previous = newestFirst[index + 1]
                let tone = "bg-primary/10 text-primary ring-primary/20"
                if (log.toStatus === "DELIVERED" || log.toStatus === "COMPLETED") tone = "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-900"
                if (log.toStatus === "CANCELLED" || log.toStatus === "FAILED") tone = "bg-red-50 text-red-700 ring-red-200 dark:bg-red-950 dark:text-red-300 dark:ring-red-900"
                if (log.toStatus === "RETURNED" || log.toStatus === "PARTIALLY_RETURNED" || log.toStatus === "REFUNDED") tone = "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:ring-amber-900"
                if (!latest) tone = "bg-muted text-muted-foreground ring-border"
                return (
                  <li key={log.id} className="relative flex gap-3 pb-5 last:pb-0">
                    {index < newestFirst.length - 1 && <span className="absolute top-8 bottom-0 left-[15px] w-px bg-border" aria-hidden />}
                    <span className={cn("relative grid size-8 shrink-0 place-items-center rounded-full ring-1", tone, latest && "ring-4")}>
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1 pt-0.5 text-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <span className="font-medium">{log.fromStatus ? ORDER_STATUS_LABEL[log.toStatus] : "Order placed"}</span>
                          {log.fromStatus && <span className="text-xs text-muted-foreground"> from {ORDER_STATUS_LABEL[log.fromStatus].toLowerCase()}</span>}
                        </div>
                        {/* How long this step waited on the one before it. */}
                        {previous && (
                          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground tabular-nums">
                            {new Date(log.createdAt).getTime() - new Date(previous.createdAt).getTime() < 60_000 ? "instantly" : `+${duration(previous.createdAt, log.createdAt)}`}
                          </span>
                        )}
                      </div>
                      {log.note && log.note !== "Order placed" && <p className="mt-0.5 text-muted-foreground">{log.note}</p>}
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                        <span title={fmtDateTime(log.createdAt)}>
                          {fmtDateTime(log.createdAt)} · {rel(log.createdAt)}
                        </span>
                        <SourceBadge source={log.source} courier={log.courier} />
                      </div>
                    </div>
                  </li>
                )
              })}
            </ol>
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-4 md:gap-6">
          <Card title="Customer" action={<Pill tone={order.userId ? "blue" : "grey"}>{order.userId ? "Account" : "Guest"}</Pill>}>
            <div className="flex flex-col gap-3 px-4 pb-4 text-sm">
              <div className="flex items-center gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary/10 font-semibold text-primary uppercase ring-4 ring-primary/5">
                  {(order.customerName ?? order.customerEmail).slice(0, 2)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate font-semibold">{order.customerName ?? "No name given"}</span>
                    {history.length <= 1 ? (
                      <span className="shrink-0 rounded-md bg-sky-50 px-1.5 text-[11px] font-medium text-sky-700 dark:bg-sky-950 dark:text-sky-300">New</span>
                    ) : (
                      <span className="shrink-0 rounded-md bg-violet-50 px-1.5 text-[11px] font-medium text-violet-700 dark:bg-violet-950 dark:text-violet-300">Repeat</span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">Customer since {fmtDate(firstOrder)}</div>
                </div>
              </div>

              <div className="flex flex-col gap-1 rounded-xl border px-3 py-2">
                <div className="flex items-center gap-2">
                  <MailIcon className="size-3.5 shrink-0 text-muted-foreground" />
                  <a href={`mailto:${order.customerEmail}`} className="min-w-0 flex-1 truncate hover:text-primary hover:underline">
                    {order.customerEmail}
                  </a>
                </div>
                {order.customerPhone && (
                  <div className="flex items-center gap-2">
                    <PhoneIcon className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate font-mono text-[13px]">{localPhone(order.customerPhone)}</span>
                    <Button variant="ghost" size="icon-xs" className="text-muted-foreground" nativeButton={false} render={<a href={`tel:${order.customerPhone}`} />}>
                      <PhoneIcon />
                      <span className="sr-only">Call</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="text-emerald-600 hover:text-emerald-700"
                      nativeButton={false}
                      render={<a href={whatsApp(order.customerPhone)} target="_blank" rel="noreferrer" />}
                    >
                      <MessageCircleIcon />
                      <span className="sr-only">WhatsApp</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="text-muted-foreground"
                      onClick={() => navigator.clipboard.writeText(localPhone(order.customerPhone ?? "")).then(() => toast.success("Phone copied"))}
                    >
                      <CopyIcon />
                      <span className="sr-only">Copy phone</span>
                    </Button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 divide-x rounded-xl border bg-muted/30 text-center">
                <div className="px-2 py-2">
                  <div className="font-semibold tabular-nums">{n0(history.length)}</div>
                  <div className="text-[11px] text-muted-foreground">Orders</div>
                </div>
                <div className="min-w-0 px-2 py-2" title={`Average order ${taka(kept.length ? spent / kept.length : 0)}`}>
                  <div className="truncate font-semibold tabular-nums">{taka(spent)}</div>
                  <div className="text-[11px] text-muted-foreground">Spent</div>
                </div>
                <div className="px-2 py-2" title={`${n0(delivered)} of ${n0(finished)} finished orders delivered`}>
                  <div className={cn("font-semibold tabular-nums", deliveryTone)}>{deliveryRate === null ? "—" : `${deliveryRate}%`}</div>
                  <div className="text-[11px] text-muted-foreground">Delivered</div>
                </div>
              </div>
              {(returned > 0 || cancelled > 0) && (
                <div className="flex items-start gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                  <TriangleAlertIcon className="mt-px size-3.5 shrink-0" />
                  <span>
                    {[returned > 0 && `${n0(returned)} returned`, cancelled > 0 && `${n0(cancelled)} cancelled or failed`].filter(Boolean).join(" · ")} — check before shipping cash on delivery.
                  </span>
                </div>
              )}

              {order.customerNote && (
                <div className="flex gap-1.5 rounded-r-lg border-l-2 border-amber-400 bg-amber-50/70 py-1.5 pr-2.5 pl-2 dark:border-amber-600 dark:bg-amber-950/60">
                  <StickyNoteIcon className="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                  <span className="text-amber-900 italic dark:text-amber-200">{order.customerNote}</span>
                </div>
              )}

              {others.length > 0 && (
                <div className="flex flex-col">
                  <div className="mb-1 flex items-baseline justify-between text-xs">
                    <span className="font-medium text-muted-foreground">Other orders</span>
                    {others.length > 5 && <span className="text-muted-foreground">latest 5 of {n0(others.length)}</span>}
                  </div>
                  {others.slice(0, 5).map((o) => (
                    <Link key={o.id} href={`/orders/${o.id}`} className="group -mx-2 flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted">
                      <span className={cn("size-2 shrink-0 rounded-full", statusDot(o.status))} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-mono text-xs font-medium group-hover:text-primary">{o.orderNumber}</span>
                        <span className="block text-[11px] text-muted-foreground">
                          {fmtDate(o.placedAt ?? o.createdAt)} · {ORDER_STATUS_LABEL[o.status]}
                        </span>
                      </span>
                      <span className="text-xs font-medium tabular-nums">{taka(Number(o.totalAmount))}</span>
                      <ChevronRightIcon className="size-3.5 shrink-0 text-muted-foreground/50 group-hover:text-primary" />
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </Card>

          <Card title="Addresses">
            <div className="flex flex-col gap-3 px-4 pb-4">
              <div className="rounded-xl border p-3">
                <div className="mb-2 flex items-center justify-between gap-1.5 text-xs font-medium text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <TruckIcon className="size-3.5" />
                    Ship to
                  </span>
                  {shippingAddress && addressEditable && (
                    // A disabled button gets no hover, so the hint sits on the wrapper.
                    <span title={shippingLocked}>
                      <Button size="xs" variant="ghost" className="text-primary hover:text-primary" onClick={() => setEditingAddress(shippingAddress)} disabled={!!shippingLocked}>
                        <PencilIcon />
                        Edit
                      </Button>
                    </span>
                  )}
                </div>
                {shippingAddress ? <Address address={shippingAddress} customerPhone={order.customerPhone} shipping /> : <p className="text-sm text-muted-foreground">None given.</p>}
                {shippingLocked && addressEditable && (
                  <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-muted/60 px-2 py-1.5 text-[11px] text-muted-foreground">
                    <LockIcon className="mt-px size-3 shrink-0" />
                    {shippingLocked}
                  </p>
                )}
                {readdressed && canShip && !hasOpenPathao && !liveShipment(order) && (
                  <div className="mt-2 flex items-center gap-2 rounded-lg bg-primary/10 px-2.5 py-2 text-xs">
                    <CircleCheckIcon className="size-3.5 shrink-0 text-primary" />
                    <span className="flex-1">Address changed. Book with Pathao again?</span>
                    <Button size="xs" onClick={() => setBookingPathao(true)}>
                      <PathaoMark />
                      Book
                    </Button>
                  </div>
                )}
              </div>
              {billingAddress ? (
                <div className="rounded-xl border p-3">
                  <div className="mb-2 flex items-center justify-between gap-1.5 text-xs font-medium text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <ReceiptIcon className="size-3.5" />
                      Bill to
                    </span>
                    {/* The courier never sees billing, so a live parcel doesn't lock it. */}
                    {addressEditable && (
                      <Button size="xs" variant="ghost" className="text-primary hover:text-primary" onClick={() => setEditingAddress(billingAddress)}>
                        <PencilIcon />
                        Edit
                      </Button>
                    )}
                  </div>
                  <Address address={billingAddress} customerPhone={order.customerPhone} />
                </div>
              ) : (
                <div className="flex items-center gap-1.5 px-1 text-xs text-muted-foreground">
                  <ReceiptIcon className="size-3.5" />
                  Billing address is the same as shipping
                </div>
              )}
            </div>
          </Card>

          <Card
            title="Payments"
            action={
              <span className="text-xs text-muted-foreground tabular-nums">
                <span className="font-medium text-foreground">{taka(paid)}</span> of {taka(total)} paid
              </span>
            }
          >
            <div className="flex flex-col gap-3 px-4 pb-4">
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div className={cn("h-full rounded-full", paid >= total ? "bg-emerald-500" : "bg-amber-500")} style={{ width: `${Math.min(100, total > 0 ? (paid / total) * 100 : 0)}%` }} />
              </div>
              {order.payments.length === 0 && <p className="text-sm text-muted-foreground">No payment attempts.</p>}
              {order.payments.map((p) => {
                const open = OPEN_PAYMENT.includes(p.status) && !stopped
                const dead = p.status === "FAILED" || p.status === "CANCELLED"
                let Icon = WalletIcon
                if (p.method === "CASH_ON_DELIVERY") Icon = BanknoteIcon
                if (p.method === "CARD") Icon = CreditCardIcon
                if (p.method === "MOBILE_BANKING") Icon = SmartphoneIcon
                if (p.method === "BANK_TRANSFER") Icon = LandmarkIcon
                let iconTone = "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:ring-amber-900"
                if (TONE[p.status] === "green") iconTone = "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-900"
                if (dead) iconTone = "bg-muted text-muted-foreground ring-border"
                // The courier that will collect this cash, if a parcel is out.
                const collector = p.provider === "COD" && open ? order.shipments.find((s) => !SHIPMENT_DONE.includes(s.status)) : undefined
                return (
                  <div key={p.id} className={cn("overflow-hidden rounded-xl border text-sm", dead && "bg-muted/30")}>
                    <div className="flex items-start gap-3 px-3 py-3">
                      <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg ring-1", iconTone)}>
                        <Icon className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <span className="min-w-0">
                            <span className="block truncate font-medium">{PROVIDER_LABEL[p.provider]}</span>
                            {label(p.method) !== PROVIDER_LABEL[p.provider] && <span className="block text-xs text-muted-foreground">{label(p.method)}</span>}
                          </span>
                          <Pill tone={p.status === "CANCELLED" ? "grey" : (TONE[p.status] ?? "amber")}>{PAYMENT_LABEL[p.status]}</Pill>
                        </div>
                        <div className={cn("mt-1 text-lg font-semibold tracking-tight tabular-nums", dead && "text-muted-foreground line-through decoration-1")}>
                          {taka(Number(p.amount), 2)}
                          {p.status === "PARTIALLY_PAID" && (
                            <span className="ml-1 text-xs font-normal text-muted-foreground no-underline">collected of {taka(Number(p.metadata?.orderedAmount), 2)}</span>
                          )}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
                          <span>{p.paidAt ? `Paid ${fmtDateTime(p.paidAt)}` : `Started ${fmtDateTime(p.createdAt)}`}</span>
                          {p.metadata?.settledBy && (
                            <SourceBadge source={p.metadata.settledBy} courier={p.metadata.settledByCourier} at={p.metadata.settledAt} userId={p.metadata.settledByUserId} />
                          )}
                        </div>
                        {collector && (
                          <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                            <TruckIcon className="size-3.5" />
                            {CARRIER_LABEL[collector.carrier]} collects this on delivery
                          </div>
                        )}
                        {p.failureMessage && (
                          <div className="mt-1.5 flex items-start gap-1.5 text-xs text-destructive">
                            <CircleXIcon className="mt-px size-3.5 shrink-0" />
                            {p.failureMessage}
                          </div>
                        )}
                        {p.provider === "COD" && p.metadata?.settledBy === "MANUAL" && (
                          <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-50 px-2 py-1.5 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                            <TriangleAlertIcon className="mt-px size-3.5 shrink-0" />
                            Marked by hand — check against the courier&apos;s payout.
                          </div>
                        )}
                      </div>
                    </div>
                    {(p.transactionId || p.providerReference) && (
                      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 border-t border-dashed bg-muted/30 px-3 py-2 text-xs">
                        {p.transactionId && (
                          <>
                            <dt className="text-muted-foreground">Transaction</dt>
                            <dd className="truncate text-right font-mono" title={p.transactionId}>{p.transactionId}</dd>
                          </>
                        )}
                        {p.providerReference && (
                          <>
                            <dt className="text-muted-foreground">Reference</dt>
                            <dd className="truncate text-right font-mono" title={p.providerReference}>{p.providerReference}</dd>
                          </>
                        )}
                      </dl>
                    )}
                    {open && (
                      <div className="flex gap-2 border-t bg-muted/30 px-3 py-2">
                        <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => markFailed(p.id)} disabled={busy}>
                          <XIcon />
                          Mark failed
                        </Button>
                        <Button size="sm" className="ml-auto" onClick={() => markPaid(p.id)} disabled={busy}>
                          <CheckIcon />
                          Mark as paid
                        </Button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
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
            <dl className="flex flex-col divide-y divide-border/60 px-4 pb-2 text-sm">
              {detailRows.map((row) => (
                  <div key={row.label} className="flex items-start justify-between gap-3 py-2.5">
                    <dt className="text-muted-foreground">{row.label}</dt>
                    <dd className="flex min-w-0 items-center gap-1 text-right">
                      <span className="min-w-0">
                        <span title={row.title} className={cn("block truncate font-medium", row.mono && "font-mono text-xs leading-5")}>
                          {row.value}
                        </span>
                        {row.hint && <span className="block text-[11px] text-muted-foreground">{row.hint}</span>}
                      </span>
                      {row.copy && (
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          className="-mr-1 shrink-0 text-muted-foreground"
                          onClick={() => navigator.clipboard.writeText(row.copy ?? "").then(() => toast.success(`${row.label} copied`))}
                        >
                          <CopyIcon />
                          <span className="sr-only">Copy {row.label.toLowerCase()}</span>
                        </Button>
                      )}
                    </dd>
                  </div>
                ))}
            </dl>
          </Card>
        </div>
      </div>

      <PrintInvoice order={order} />
      {cancelling && <CancelDialog orderId={order.id} orderNumber={order.orderNumber} onClose={() => setCancelling(false)} />}
      {editingAddress && (
        <AddressDialog
          orderId={order.id}
          address={editingAddress}
          onClose={() => setEditingAddress(null)}
          onSaved={() => {
            // Only worth rebooking when an earlier parcel was cancelled for the old address.
            if (editingAddress.type === "SHIPPING" && order.shipments.some((s) => s.status === "CANCELLED")) setReaddressed(true)
          }}
        />
      )}
      {bookingPathao && <PathaoDialog order={order} due={Math.max(0, due)} onClose={() => setBookingPathao(false)} />}
      {shipping && (
        <ShipmentDialog orderId={order.id} orderNumber={order.orderNumber} codAmount={codOpen ? due : 0} onClose={() => setShipping(false)} />
      )}
      {partlyDelivering && codPending && (
        <PartialDeliveryDialog
          codAmount={Number(codPending.amount)}
          readyToShip={order.status === "READY_TO_SHIP"}
          onSave={(collected) => saveShipmentStatus(partlyDelivering, "DELIVERED", collected)}
          onClose={() => setPartlyDelivering(null)}
        />
      )}
      {markingCancelled && (
        <AlertDialog open onOpenChange={(open) => !open && setMarkingCancelled(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Mark this parcel cancelled?</AlertDialogTitle>
              <AlertDialogDescription>
                {markingCancelled.carrier === "PATHAO"
                  ? "Pathao doesn't show it as cancelled yet. Mark it cancelled anyway?"
                  : `Only do this once ${CARRIER_LABEL[markingCancelled.carrier]} has cancelled it.`}{" "}
                This is recorded as Manual, and then the order can be cancelled.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep parcel</AlertDialogCancel>
              <Button
                variant="destructive"
                onClick={() => {
                  setShipmentStatus(markingCancelled.id, "CANCELLED")
                  setMarkingCancelled(null)
                }}
              >
                Mark cancelled
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
      {confirming && (
        <ConfirmShipmentDialog status={confirming.status} onConfirm={() => setShipmentStatus(confirming.shipmentId, confirming.status)} onClose={() => setConfirming(null)} />
      )}
      {receiving && <ReceiveReturnsDialog order={order} images={images} stock={stock} movements={movements} fullReturn={returnState.kind === "returned"} onClose={() => setReceiving(false)} />}
      {refunding && <RefundDialog orderId={order.id} max={refundable} onClose={() => setRefunding(false)} />}
    </div>
  )
}

// "order.at-the-sorting-hub", "At_the_Sorting_HUB" or "Pending" → "At the sorting hub"
// What the courier charges us: Pathao reports its own fee; the shipment's amount may just copy the customer's delivery charge.
export const courierFee = (s: Shipment) => s.metadata?.pathaoDeliveryFee ?? Number(s.shippingAmount)

export const pathaoText = (status: string) => {
  const words = status.replace(/^order\./, "").replace(/[-_\s]+/g, " ").trim().toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

// Pathao's logo (public/couriers/pathao.png, from their GitHub avatar); the round crop hides its black corners.
export function PathaoMark({ className }: { className?: string }) {
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

type AddressForm = { fullName: string; phone: string; city: string; thana: string; fullAddress: string }

// Edits a shipping or billing address; only changed fields are sent.
function AddressDialog({ orderId, address, onClose, onSaved }: { orderId: string; address: OrderAddress; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<AddressForm>({ fullName: address.fullName, phone: address.phone, city: address.city, thana: address.thana, fullAddress: address.fullAddress })
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const shipping = address.type === "SHIPPING"

  async function save() {
    const next = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim()])) as AddressForm
    if (!next.fullName || !next.phone || !next.city || !next.thana) return setError("Full name, phone, district and thana are required.")
    if (next.fullAddress.length < 10) return setError("The full address needs at least 10 characters.")
    const changes: Partial<OrderAddressBody> = {}
    for (const key of ["fullName", "phone", "city", "thana", "fullAddress"] as const) {
      if (next[key] !== address[key]) changes[key] = next[key]
    }
    if (Object.keys(changes).length === 0) return onClose()
    setSaving(true)
    const res = await updateOrderAddress(orderId, address.type, changes)
    setSaving(false)
    if (!res.success) {
      // Refused (e.g. a parcel was booked from another tab): keep the dialog and what was typed.
      toast.error("Address not changed", { description: res.error })
      return setError(res.error)
    }
    toast.success(shipping ? "Shipping address updated" : "Billing address updated")
    onSaved()
    onClose()
  }

  const field = (key: keyof AddressForm) => ({ value: form[key], onChange: (e: { target: { value: string } }) => setForm({ ...form, [key]: e.target.value }) })
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{shipping ? "Edit shipping address" : "Edit billing address"}</DialogTitle>
          <DialogDescription>{shipping ? "Where the courier delivers. A new booking carries this address." : "Printed on the invoice; couriers never see it."}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="ad-name">Full name</FieldLabel>
            <Input id="ad-name" maxLength={200} {...field("fullName")} />
          </Field>
          <Field>
            <FieldLabel htmlFor="ad-phone">Phone</FieldLabel>
            <Input id="ad-phone" maxLength={30} inputMode="tel" placeholder="01712345678" className="font-mono" {...field("phone")} />
          </Field>
          <Field>
            <FieldLabel htmlFor="ad-city">District</FieldLabel>
            <Input id="ad-city" maxLength={100} placeholder="Dhaka" {...field("city")} />
          </Field>
          <Field>
            <FieldLabel htmlFor="ad-thana">Thana</FieldLabel>
            <Input id="ad-thana" maxLength={100} placeholder="Mirpur 6" {...field("thana")} />
          </Field>
          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="ad-full">Full address</FieldLabel>
            <Textarea id="ad-full" maxLength={255} placeholder="House 32, Road 8, Block H, Mirpur 2" className="min-h-16" {...field("fullAddress")} />
            <span className="text-right text-[11px] text-muted-foreground tabular-nums">{form.fullAddress.length}/255</span>
          </Field>
        </div>
        {shipping && <p className="text-xs text-muted-foreground">Pathao gets: {pathaoAddress(form) || "—"}</p>}
        <DialogFooter className="items-center">
          {error && <p className="mr-auto text-sm text-destructive">{error}</p>}
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving..." : "Save address"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

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
  if (!a.thana.trim()) problems.push("Add the thana so Pathao finds the right delivery area.")
  if (pathaoAddress(a).length < 10) problems.push("The address must be at least 10 characters.")
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
    setAddressForm({ fullName: address.fullName, phone: address.phone, city: address.city, thana: address.thana, fullAddress: address.fullAddress })
  }

  async function saveAddress() {
    if (!addressForm) return
    if (!address) return
    const form = Object.fromEntries(Object.entries(addressForm).map(([k, v]) => [k, v.trim()])) as AddressForm
    if (!form.fullName || !form.phone || !form.city || !form.thana) return setAddressError("Full name, phone, district and thana are required.")
    if (form.fullAddress.length < 10) return setAddressError("The full address needs at least 10 characters.")
    // Send only what changed.
    const changes: Partial<OrderAddressBody> = {}
    if (form.fullName !== address.fullName) changes.fullName = form.fullName
    if (form.phone !== address.phone) changes.phone = form.phone
    if (form.fullAddress !== address.fullAddress) changes.fullAddress = form.fullAddress
    if (form.city !== address.city) changes.city = form.city
    if (form.thana !== address.thana) changes.thana = form.thana
    if (Object.keys(changes).length === 0) return setAddressForm(null)
    setSavingAddress(true)
    // The order page reloads with the saved address, which this dialog then shows.
    const res = await updateOrderAddress(order.id, "SHIPPING", changes)
    setSavingAddress(false)
    if (!res.success) {
      // A 409 means a parcel was booked meanwhile (another tab); keep the form so nothing typed is lost.
      toast.error("Address not changed", { description: res.error })
      return setAddressError(res.error)
    }
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
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="addr-city">District</FieldLabel>
                    <Input id="addr-city" value={addressForm.city} maxLength={100} placeholder="Dhaka" className="bg-card" onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })} />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="addr-thana">Thana</FieldLabel>
                    <Input id="addr-thana" value={addressForm.thana} maxLength={100} placeholder="Mirpur 6" className="bg-card" onChange={(e) => setAddressForm({ ...addressForm, thana: e.target.value })} />
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
                    placeholder="HOUSE-32, ROAD-08, BLOCK-H, MIRPUR-2, DHAKA-1216"
                    className="min-h-16 bg-card"
                    onChange={(e) => setAddressForm({ ...addressForm, fullAddress: e.target.value })}
                  />
                </Field>
                <p className="-mt-1 text-xs text-muted-foreground">
                  Pathao gets: <span className="text-foreground">{pathaoAddress(addressForm) || "—"}</span>
                </p>
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
                  <div className="mt-0.5 text-xs text-muted-foreground">Pathao gets: {pathaoAddress(address)}</div>
                  {pathaoProblems(
                    { fullName: address.fullName, phone: address.phone, city: address.city, thana: address.thana, fullAddress: address.fullAddress },
                    order.customerName,
                    order.customerPhone
                  ).map((p) => (
                    <p key={p} className="mt-1 text-xs text-amber-700 dark:text-amber-400">{p}</p>
                  ))}
                </div>
                <Button size="sm" variant="ghost" className="shrink-0 text-primary hover:text-primary" onClick={editAddress} disabled={!!liveShipment(order)} title={liveShipment(order) ? "Cancel the booked parcel first" : undefined}>
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

// "3 days", "5 hours", "12 minutes": the gap between two times, in its largest whole unit.
function duration(from: string, to: string) {
  const minutes = Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60_000))
  let n = minutes
  let unit = "minute"
  if (minutes >= 60 * 24) {
    n = Math.round(minutes / (60 * 24))
    unit = "day"
  } else if (minutes >= 60) {
    n = Math.round(minutes / 60)
    unit = "hour"
  }
  return `${n} ${unit}${n === 1 ? "" : "s"}`
}

function statusDot(status: OrderStatus) {
  if (status === "DELIVERED" || status === "COMPLETED") return "bg-emerald-500"
  if (status === "CANCELLED" || status === "FAILED") return "bg-red-500"
  if (status === "RETURNED" || status === "PARTIALLY_RETURNED" || status === "REFUNDED") return "bg-amber-500"
  return "bg-primary"
}

function paymentPillText(p: OrderDetail["payments"][number]) {
  if (p.status === "PAID") return "Paid"
  if (p.status === "PARTIALLY_PAID") return `Partly paid ${taka(Number(p.amount))} of ${taka(Number(p.metadata?.orderedAmount))}`
  return `Payment ${PAYMENT_LABEL[p.status].toLowerCase()}`
}

const returnsSchema = z.object({
  items: z.array(z.object({ orderItemId: z.string(), max: z.number(), quantity: z.number().int("Whole units only").min(0), damaged: z.boolean() })),
  note: z.string().max(500, "At most 500 characters"),
})
type ReturnsForm = z.infer<typeof returnsSchema>

// The admin counts what physically came back; good units go back on sale, damaged ones to the damage section.
function ReceiveReturnsDialog({
  order,
  images,
  stock,
  movements,
  fullReturn,
  onClose,
}: {
  order: OrderDetail
  images: Record<string, string>
  stock: Record<string, VariantStockDetail>
  movements: LedgerMovement[]
  fullReturn: boolean
  onClose: () => void
}) {
  const parcel = order.shipments.find((s) => s.status === "RETURNED" || s.status === "DELIVERED") ?? order.shipments.at(-1)
  const cod = order.payments.find((p) => p.provider === "COD")
  // Units go back to the warehouse they were sold from (the order's SALE rows); fall back to where stock is now.
  const homeOf = (i: OrderDetail["items"][number]) => {
    const sale = movements.find((m) => m.type === "SALE" && m.inventoryLevel.variant.id === i.variantId)
    const code = sale?.inventoryLevel.warehouse.code
    const level = i.variantId ? stock[i.variantId]?.levels.find((l) => l.warehouse.code === code) : undefined
    return { code, available: level?.available }
  }
  const unitPrice = (i: OrderDetail["items"][number]) => Number(i.totalAmount) / i.quantity
  const form = useForm<ReturnsForm>({
    resolver: zodResolver(
      returnsSchema
        .refine((v) => v.items.every((i) => i.quantity <= i.max), { message: "More than is still out", path: ["items"] })
        .refine((v) => v.items.some((i) => i.quantity > 0), { message: "Enter at least one item", path: ["items"] })
    ),
    defaultValues: {
      // A returned parcel brings everything back; after a partial delivery the admin counts what came.
      items: order.items.filter((i) => i.quantity > i.returnedQuantity).map((i) => {
        const max = i.quantity - i.returnedQuantity
        return { orderItemId: i.id, max, quantity: fullReturn ? max : 0, damaged: false }
      }),
      note: "",
    },
  })
  const [serverError, setServerError] = useState("")
  const sending = useRef(false)
  const rows = form.watch("items")
  // Lines follow the form rows, so they stay aligned while the rows catch up with a refreshed order.
  const lines = rows.map((r) => order.items.find((i) => i.id === r.orderItemId)!)
  const itemsKey = order.items.map((i) => `${i.id}:${i.returnedQuantity}`).join(",")

  // Someone else may have received some of these: shrink each line's max, keep what was typed (clamped).
  useEffect(() => {
    const current = form.getValues("items")
    const next = order.items
      .filter((i) => i.quantity > i.returnedQuantity)
      .map((i) => {
        const max = i.quantity - i.returnedQuantity
        const old = current.find((r) => r.orderItemId === i.id)
        const quantity = Math.min(max, old?.quantity ?? 0)
        return { orderItemId: i.id, max, quantity, damaged: quantity > 0 && (old?.damaged ?? false) }
      })
    if (next.length === 0) {
      toast.info("These items were already received", { description: "Someone else just recorded them. Stock is up to date." })
      onClose()
      return
    }
    form.setValue("items", next)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-run only when the returned counts change
  }, [itemsKey])

  const note = form.watch("note")
  const { errors, isSubmitting } = form.formState
  const onSale = rows.filter((r) => !r.damaged).reduce((sum, r) => sum + r.quantity, 0)
  const damaged = rows.filter((r) => r.damaged).reduce((sum, r) => sum + r.quantity, 0)
  const valueOf = (damagedRows: boolean) =>
    rows.reduce((sum, r, index) => (r.damaged === damagedRows ? sum + unitPrice(lines[index]) * r.quantity : sum), 0)
  const total = onSale + damaged
  const error = serverError || errors.items?.root?.message || errors.items?.message
  const raced = serverError.startsWith("Only ") && serverError.includes("can still be returned")

  function setQuantity(index: number, value: number) {
    const max = rows[index].max
    const quantity = Math.min(max, Math.max(0, Math.round(value) || 0))
    form.setValue(`items.${index}.quantity`, quantity, { shouldValidate: form.formState.isSubmitted })
    if (quantity === 0) form.setValue(`items.${index}.damaged`, false)
  }

  async function submit(values: ReturnsForm) {
    // Enter in a quantity box can submit again while the button is disabled.
    if (sending.current) return
    sending.current = true
    setServerError("")
    const res = await receiveReturnedItems(order.id, {
      items: values.items.filter((i) => i.quantity > 0).map((i) => ({ orderItemId: i.orderItemId, quantity: i.quantity, damaged: i.damaged })),
      note: values.note.trim() || undefined,
    })
    sending.current = false
    if (!res.success) return setServerError(res.error)
    toast.success("Items received back into stock")
    onClose()
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="gap-0 p-0 sm:max-w-[46rem]">
        <DialogHeader className="flex-row items-center gap-3 border-b px-5 py-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-900/60 dark:text-amber-300 dark:ring-amber-800">
            <PackageOpenIcon className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <DialogTitle>Receive returned items</DialogTitle>
            <DialogDescription>
              <span className="font-mono text-xs text-foreground">{order.orderNumber}</span> · count what physically came back
            </DialogDescription>
          </div>
        </DialogHeader>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 border-b px-5 py-3 text-xs sm:grid-cols-4">
          <div>
            <dt className="text-muted-foreground">Customer</dt>
            <dd className="truncate font-medium">{order.customerName ?? order.customerEmail}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Parcel</dt>
            <dd className="truncate font-medium">
              {parcel ? `${CARRIER_LABEL[parcel.carrier]} · ${label(parcel.status).toLowerCase()}` : "No parcel"}
            </dd>
            {parcel && (parcel.trackingNumber ?? parcel.consignmentId) && <dd className="truncate font-mono text-muted-foreground">{parcel.trackingNumber ?? parcel.consignmentId}</dd>}
          </div>
          <div>
            <dt className="text-muted-foreground">Cash on delivery</dt>
            <dd className="font-medium tabular-nums">
              {!cod && "Prepaid"}
              {cod?.status === "PARTIALLY_PAID" && `${taka(Number(cod.amount))} of ${taka(Number(cod.metadata?.orderedAmount))}`}
              {cod?.status === "FAILED" && <span className="text-destructive">Not collected</span>}
              {cod && cod.status !== "PARTIALLY_PAID" && cod.status !== "FAILED" && `${taka(Number(cod.amount))} · ${PAYMENT_LABEL[cod.status].toLowerCase()}`}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Order total</dt>
            <dd className="font-medium tabular-nums">{taka(Number(order.totalAmount))}</dd>
          </div>
        </dl>

        <form id="receive-returns" onSubmit={form.handleSubmit(submit)} className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto bg-muted/30 px-5 py-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              {lines.length} {lines.length === 1 ? "item" : "items"} still out
            </span>
            <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => lines.forEach((_, index) => setQuantity(index, rows[index].max))}>
              Everything came back
            </Button>
          </div>

          <ul className="flex flex-col gap-2">
            {lines.map((line, index) => {
              const row = rows[index]
              const image = line.productId ? images[line.productId] : undefined
              const empty = row.quantity === 0
              const home = homeOf(line)
              return (
                <li key={line.id} className={cn("overflow-hidden rounded-xl border bg-card transition-colors", !empty && "border-primary/30")}>
                  <div className="flex items-center gap-3 px-3 py-3">
                    <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-lg border bg-muted/60 text-muted-foreground">
                      {image ? (
                        // eslint-disable-next-line @next/next/no-img-element -- any image host is allowed
                        <img src={image} alt="" className="size-full object-cover" />
                      ) : (
                        <PackageIcon className="size-4" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{line.productName}</div>
                      <div className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
                        {line.variantName && line.variantName !== line.sku && <span className="font-medium text-foreground">{line.variantName}</span>}
                        <span className="font-mono">{line.sku}</span>
                      </div>
                      <div className="mt-0.5 text-[11px] text-muted-foreground tabular-nums">
                        {taka(unitPrice(line))} each · {n0(line.quantity)} ordered
                        {line.returnedQuantity > 0 && ` · ${n0(line.returnedQuantity)} already back`} ·{" "}
                        <span className="font-medium text-amber-700 dark:text-amber-400">{n0(row.max)} still out</span>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-sm font-semibold tabular-nums">{empty ? <span className="text-muted-foreground">—</span> : taka(unitPrice(line) * row.quantity)}</div>
                      <div className="text-[11px] text-muted-foreground">{empty ? "nothing yet" : "receiving"}</div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-dashed bg-muted/30 px-3 py-2">
                    <div className="flex items-center rounded-lg border bg-background">
                      <Button type="button" variant="ghost" size="icon-sm" aria-label="One less" onClick={() => setQuantity(index, row.quantity - 1)} disabled={row.quantity === 0}>
                        <MinusIcon />
                      </Button>
                      <Input
                        inputMode="numeric"
                        aria-label={`${line.productName} received now`}
                        value={row.quantity}
                        onChange={(e) => setQuantity(index, Number(e.target.value))}
                        className="h-8 w-10 border-0 px-0 text-center font-semibold tabular-nums shadow-none focus-visible:ring-0"
                      />
                      <Button type="button" variant="ghost" size="icon-sm" aria-label="One more" onClick={() => setQuantity(index, row.quantity + 1)} disabled={row.quantity >= row.max}>
                        <PlusIcon />
                      </Button>
                    </div>
                    <span className="text-xs text-muted-foreground tabular-nums">of {n0(row.max)}</span>

                    <ToggleGroup
                      multiple={false}
                      value={[row.damaged ? "damaged" : "good"]}
                      onValueChange={(v) => v[0] && form.setValue(`items.${index}.damaged`, v[0] === "damaged")}
                      disabled={empty}
                      spacing={0}
                      variant="outline"
                      size="sm"
                      aria-label={`${line.productName} condition`}
                    >
                      <ToggleGroupItem value="good" className="gap-1 bg-background text-xs data-pressed:bg-emerald-50 data-pressed:text-emerald-800 dark:data-pressed:bg-emerald-950 dark:data-pressed:text-emerald-300">
                        <CheckIcon className="size-3.5" />
                        Good
                      </ToggleGroupItem>
                      <ToggleGroupItem value="damaged" className="gap-1 bg-background text-xs data-pressed:bg-red-50 data-pressed:text-red-700 dark:data-pressed:bg-red-950 dark:data-pressed:text-red-300">
                        <TriangleAlertIcon className="size-3.5" />
                        Damaged
                      </ToggleGroupItem>
                    </ToggleGroup>

                    {home.code && !empty && (
                      <span className="ml-auto flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        {row.damaged ? "To damage section in" : "Back on sale in"}
                        <WarehouseTag code={home.code} />
                        {home.available !== undefined && !row.damaged && (
                          <span className="tabular-nums">
                            {n0(home.available)} → <span className="font-semibold text-emerald-700 dark:text-emerald-400">{n0(home.available + row.quantity)}</span>
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>

          <Field>
            <div className="flex items-baseline justify-between">
              <FieldLabel htmlFor="returns-note">
                Note <span className="font-normal text-muted-foreground">(optional)</span>
              </FieldLabel>
              <span className="text-[11px] text-muted-foreground tabular-nums">{note.length}/500</span>
            </div>
            <Textarea id="returns-note" placeholder="e.g. Box opened, cap scratched" maxLength={500} className="min-h-16 bg-background" {...form.register("note")} />
            {errors.note && <p className="text-sm text-destructive">{errors.note.message}</p>}
          </Field>
        </form>

        {raced && (
          <div className="border-t bg-destructive/10 px-5 py-2.5 text-sm text-destructive">
            Someone just received some of these items. The counts below are updated. Check them and submit again.
            <span className="block text-xs opacity-80">{serverError}</span>
          </div>
        )}

        <DialogFooter className="m-0 flex-col gap-3 rounded-b-xl border-t px-5 py-3 sm:flex-row sm:items-center">
          <div className="mr-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            {error && !raced && <span className="text-sm text-destructive">{error}</span>}
            {(!error || raced) && (
              <>
                {(onSale > 0 || damaged === 0) && (
                  <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                    <PackageCheckIcon className="size-3.5" />
                    {n0(onSale)} back on sale{onSale > 0 && ` · ${taka(valueOf(false))}`}
                  </span>
                )}
                {damaged > 0 && (
                  <span className="inline-flex items-center gap-1 text-red-700 dark:text-red-400">
                    <TriangleAlertIcon className="size-3.5" />
                    {n0(damaged)} to the damage section · {taka(valueOf(true))}
                  </span>
                )}
              </>
            )}
          </div>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="receive-returns" disabled={isSubmitting}>
            <PackageCheckIcon />
            {isSubmitting ? "Receiving..." : `Receive ${n0(total)} ${total === 1 ? "unit" : "units"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// What's still out with the courier or customer and what has already gone back into stock (and where).
// Without onReceive it's the finished state: everything expected is back.
function ReturnAlert({
  title,
  text,
  items,
  images,
  movements,
  onReceive,
}: {
  title: string
  text: string
  items: OrderDetail["items"]
  images: Record<string, string>
  movements: LedgerMovement[]
  onReceive?: () => void
}) {
  const stillOut = onReceive ? items.filter((i) => i.quantity > i.returnedQuantity) : []
  const back = items.filter((i) => i.returnedQuantity > 0)
  const out = stillOut.reduce((sum, i) => sum + i.quantity - i.returnedQuantity, 0)
  const done = !onReceive

  // The ledger rows this order wrote for a returned line: where it was restocked and how much went to damage.
  function receipt(i: OrderDetail["items"][number]) {
    const rows = movements.filter((m) => m.inventoryLevel.variant.id === i.variantId)
    const warehouses = [...new Set(rows.filter((m) => m.type === "RETURN_RESTOCKED").map((m) => m.inventoryLevel.warehouse.code))]
    const damaged = rows.filter((m) => m.type === "DAMAGED").reduce((sum, m) => sum + Math.abs(m.quantity), 0)
    return { warehouses, damaged }
  }

  function thumb(i: OrderDetail["items"][number]) {
    const image = i.productId ? images[i.productId] : undefined
    return (
      <span className="grid size-7 shrink-0 place-items-center overflow-hidden rounded-md bg-muted text-muted-foreground">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element -- any image host is allowed
          <img src={image} alt="" className="size-full object-cover" />
        ) : (
          <PackageIcon className="size-3.5" />
        )}
      </span>
    )
  }

  return (
    <section
      role="alert"
      className={cn("overflow-hidden rounded-2xl border bg-card shadow-xs", done ? "border-emerald-200 dark:border-emerald-900" : "border-amber-200 dark:border-amber-900")}
    >
      <div className={cn("flex flex-wrap items-center gap-4 px-4 py-3.5", done ? "bg-emerald-50/80 dark:bg-emerald-950/40" : "bg-amber-50/80 dark:bg-amber-950/40")}>
        <span
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-xl ring-1",
            done
              ? "bg-emerald-100 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/60 dark:text-emerald-300 dark:ring-emerald-800"
              : "bg-amber-100 text-amber-700 ring-amber-200 dark:bg-amber-900/60 dark:text-amber-300 dark:ring-amber-800"
          )}
        >
          {done ? <PackageCheckIcon className="size-5" /> : <PackageOpenIcon className="size-5" />}
        </span>
        <div className="min-w-0 flex-1 basis-64">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className={cn("font-semibold", done ? "text-emerald-950 dark:text-emerald-100" : "text-amber-950 dark:text-amber-100")}>{title}</h2>
            {!done && (
              <span className="rounded-full bg-amber-200/70 px-2 py-0.5 text-[11px] font-semibold text-amber-900 tabular-nums dark:bg-amber-900 dark:text-amber-200">
                {n0(out)} {out === 1 ? "unit" : "units"} to receive
              </span>
            )}
          </div>
          <p className={cn("mt-0.5 text-sm", done ? "text-emerald-900/80 dark:text-emerald-200/80" : "text-amber-900/80 dark:text-amber-200/80")}>{text}</p>
        </div>
        {onReceive && (
          <Button onClick={onReceive} className="shrink-0">
            <PackageCheckIcon />
            Receive returned items
          </Button>
        )}
      </div>

      {stillOut.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-t border-amber-100 px-4 py-3 dark:border-amber-900/60">
          <span className="w-28 shrink-0 text-xs font-medium text-muted-foreground">Still out</span>
          {stillOut.map((i) => (
            <span key={i.id} className="flex items-center gap-2 rounded-lg border bg-background py-1 pr-2.5 pl-1 text-xs">
              {thumb(i)}
              <span className="max-w-48 truncate font-medium">{i.productName}</span>
              {i.variantName && i.variantName !== i.sku && <span className="text-muted-foreground">{i.variantName}</span>}
              <span className="font-semibold text-amber-700 tabular-nums dark:text-amber-400">×{n0(i.quantity - i.returnedQuantity)}</span>
            </span>
          ))}
        </div>
      )}

      {back.length > 0 && (
        <div className={cn("flex flex-wrap items-center gap-2 border-t px-4 py-3", done ? "border-emerald-100 dark:border-emerald-900/60" : "border-amber-100 dark:border-amber-900/60")}>
          <span className="w-28 shrink-0 text-xs font-medium text-muted-foreground">Back in stock</span>
          {back.map((i) => {
            const { warehouses, damaged } = receipt(i)
            const sellable = i.returnedQuantity - damaged
            return (
              <span key={i.id} className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/60 py-1 pr-2.5 pl-1 text-xs dark:border-emerald-900 dark:bg-emerald-950/40">
                {thumb(i)}
                <span className="max-w-48 truncate font-medium">{i.productName}</span>
                {i.variantName && i.variantName !== i.sku && <span className="text-muted-foreground">{i.variantName}</span>}
                <span className="inline-flex items-center gap-0.5 font-semibold text-emerald-700 tabular-nums dark:text-emerald-400">
                  <CheckIcon className="size-3" strokeWidth={3} />×{n0(i.returnedQuantity)}
                </span>
                {sellable > 0 && warehouses.map((code) => <WarehouseTag key={code} code={code} />)}
                {damaged > 0 && <span className="rounded bg-red-100 px-1.5 py-0.5 font-medium text-red-700 dark:bg-red-950 dark:text-red-300">{n0(damaged)} damaged</span>}
              </span>
            )
          })}
        </div>
      )}
    </section>
  )
}

// The customer kept only some items and paid for those. Records DELIVERED with the cash collected;
// the items that came back are received afterwards from the order page.
export function PartialDeliveryDialog({
  codAmount,
  readyToShip,
  onSave,
  onClose,
}: {
  codAmount: number
  readyToShip: boolean
  onSave: (collected: number) => Promise<{ success: boolean; error?: string }>
  onClose: () => void
}) {
  const [amount, setAmount] = useState("")
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)

  async function save() {
    const value = Number(amount)
    if (amount.trim() === "" || !(value >= 0)) return setError("Enter the cash the rider collected.")
    if (value === 0) return setError("Nothing collected? Mark the parcel Returned instead.")
    if (value >= codAmount) return setError(`That's the full ${taka(codAmount)}. Mark the parcel Delivered instead.`)
    setSaving(true)
    const res = await onSave(Math.round(value * 100) / 100)
    setSaving(false)
    if (!res.success) return setError(res.error ?? "Something went wrong")
    onClose()
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Partly delivered</DialogTitle>
          <DialogDescription>
            The customer kept some items and paid only for those. Cash on delivery was {taka(codAmount)}.
            {readyToShip && " The order will move to Shipped and then Delivered."}
          </DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor="partial-collected">Cash collected (৳)</FieldLabel>
          <Input id="partial-collected" inputMode="decimal" autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" className="text-right tabular-nums" />
        </Field>
        <p className="flex items-start gap-1.5 rounded-lg bg-amber-50 px-2.5 py-2 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-300">
          <TriangleAlertIcon className="mt-px size-3.5 shrink-0" />
          This is recorded as Manual. Check it against the courier&apos;s payout.
        </p>
        <DialogFooter className="items-center">
          {error && <p className="mr-auto text-sm text-destructive">{error}</p>}
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
