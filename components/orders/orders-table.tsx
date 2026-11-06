"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState, useTransition } from "react"
import { toast } from "sonner"
import {
  ArrowRightIcon,
  BanknoteIcon,
  CopyIcon,
  EllipsisVerticalIcon,
  EyeIcon,
  HandIcon,
  ServerIcon,
  ShoppingCartIcon,
  StickyNoteIcon,
  TagIcon,
  TruckIcon,
  MapPinIcon,
  MessageCircleIcon,
  PackageIcon,
  PhoneIcon,
  RefreshCwIcon,
  StepForwardIcon,
  XCircleIcon,
} from "lucide-react"

import { fmtDateTime, Kpis, label, n0, Pill, rel, taka, type Tone } from "@/components/inventory/inventory-ui"
import { ListTable, type ListColumn, type ListFilter } from "@/components/list-table"
import { cancelOrder, markPaymentPaid, updateOrderStatus } from "@/app/actions/order.actions"
import { getProduct } from "@/app/actions/product.actions"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Field, FieldLabel } from "@/components/ui/field"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { getReturnState } from "@/lib/orders/return-state"
import { cn } from "@/lib/utils"
import { formatAddress, type ChangeSource, type CourierCarrier, type Order, type OrderAddress, type OrderStatus, type PaymentStatus, type ShipmentStatus } from "@/types/order.type"
import type { ProductDetail } from "@/types/product.type"

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  PROCESSING: "Processing",
  READY_TO_SHIP: "Ready to ship",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  FAILED: "Failed",
  REFUNDED: "Refunded",
  RETURNED: "Returned",
  PARTIALLY_RETURNED: "Partly returned",
}

export const PAYMENT_LABEL: Record<PaymentStatus, string> = {
  PENDING: "Pending",
  PROCESSING: "Processing",
  PAID: "Paid",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
  PARTIALLY_REFUNDED: "Partly refunded",
  PARTIALLY_PAID: "Partly paid",
}

export const CARRIER_LABEL: Record<CourierCarrier, string> = { PATHAO: "Pathao", REDX: "RedX", STEADFAST: "Steadfast", CARRYBEE: "CarryBee" }
// Who made a change, as the backend recorded it. Manual stands out: by hand means nobody else confirmed it.
export function SourceBadge({ source, courier, at, userId }: { source: ChangeSource; courier?: CourierCarrier | null; at?: string; userId?: string }) {
  const name = courier ? CARRIER_LABEL[courier] : "Courier"
  let text = "System"
  let tip = "Made by the server, or recorded before sources were tracked"
  let icon = <ServerIcon />
  let tone = "border-border text-muted-foreground"
  if (source === "MANUAL") {
    text = "Manual"
    tip = userId ? `Changed by an admin in the admin panel (user ${userId})` : "Changed by an admin in the admin panel"
    icon = <HandIcon />
    tone = "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300"
  } else if (source === "COURIER_WEBHOOK") {
    text = name
    tip = `Reported by ${name}`
    icon = <TruckIcon />
    tone = "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-300"
  } else if (source === "COURIER_SYNC") {
    text = `${name} (sync)`
    tip = `Fetched from ${name} when an admin pressed Sync`
    icon = <RefreshCwIcon />
    tone = "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-300"
  } else if (source === "CHECKOUT") {
    text = "Checkout"
    tip = "Created at checkout"
    icon = <ShoppingCartIcon />
  }
  if (at) tip += ` · ${fmtDateTime(at)}`
  return (
    <span title={tip} className={cn("inline-flex h-5 items-center gap-1 rounded-md border px-1.5 text-[11px] font-medium whitespace-nowrap [&_svg]:size-3", tone)}>
      {icon}
      {text}
    </span>
  )
}

// Cash on delivery settled by hand, or a parcel closed by hand: worth checking against the courier's payout.
export const settledByHand = (o: Pick<Order, "payments" | "shipments">) =>
  o.payments.some((p) => p.provider === "COD" && p.metadata?.settledBy === "MANUAL") ||
  o.shipments.some((s) => (s.status === "DELIVERED" || s.status === "RETURNED") && s.metadata?.lastChange?.source === "MANUAL")

export const PROVIDER_LABEL: Record<Order["payments"][number]["provider"], string> = {
  COD: "Cash on delivery",
  BKASH: "bKash",
  NAGAD: "Nagad",
  SSLCOMMERZ: "SSLCommerz",
  STRIPE: "Stripe",
  OTHER: "Other",
}

const PAYMENT_TONE: Partial<Record<PaymentStatus, Tone>> = { PAID: "green", FAILED: "red", CANCELLED: "grey", REFUNDED: "grey", PARTIALLY_REFUNDED: "amber", PARTIALLY_PAID: "amber" }

const DAY = 86_400_000
// Placed but not shipped yet.
const UNFULFILLED: OrderStatus[] = ["PENDING", "CONFIRMED", "PROCESSING", "READY_TO_SHIP"]
// The happy path, one step at a time (the backend's ORDER_STATUS_TRANSITIONS).
export const NEXT: Partial<Record<OrderStatus, { status: OrderStatus; text: string }>> = {
  PENDING: { status: "CONFIRMED", text: "Confirm order" },
  CONFIRMED: { status: "PROCESSING", text: "Start processing" },
  PROCESSING: { status: "READY_TO_SHIP", text: "Ready to ship" },
  READY_TO_SHIP: { status: "SHIPPED", text: "Mark shipped" },
  SHIPPED: { status: "DELIVERED", text: "Mark delivered" },
  DELIVERED: { status: "COMPLETED", text: "Complete order" },
}
// Shipped, delivered and returned come from the parcel once there is one: the order follows its shipment.
export const followsShipment = (o: Pick<Order, "shipments">, status: OrderStatus | undefined) =>
  (status === "SHIPPED" || status === "DELIVERED" || status === "RETURNED") && o.shipments.some((s) => s.status !== "CANCELLED")
export const CANCELLABLE: OrderStatus[] = ["PENDING", "CONFIRMED", "PROCESSING", "READY_TO_SHIP"]
// A parcel still with the courier; the backend won't cancel the order until it's cancelled there.
const LIVE_SHIPMENT: ShipmentStatus[] = ["PENDING", "PROCESSING", "SHIPPED", "IN_TRANSIT", "OUT_FOR_DELIVERY"]
export function cancelBlockedBy(o: Pick<Order, "shipments">) {
  const s = o.shipments.find((x) => LIVE_SHIPMENT.includes(x.status))
  if (!s) return undefined
  return `Cancel the ${CARRIER_LABEL[s.carrier]} parcel ${s.consignmentId ?? s.trackingNumber ?? ""} first`.replace(/\s+first$/, " first")
}
const STOPPED: OrderStatus[] = ["CANCELLED", "FAILED", "REFUNDED", "RETURNED", "PARTIALLY_RETURNED"]
const RETURNS: OrderStatus[] = ["RETURNED", "PARTIALLY_RETURNED"]

// Same rule as the backend: refunded payments still count as received.
const RECEIVED: PaymentStatus[] = ["PAID", "PARTIALLY_PAID", "REFUNDED", "PARTIALLY_REFUNDED"]
const isPaid = (o: Order) => o.payments.some((p) => RECEIVED.includes(p.status))
const placed = (o: Order) => o.placedAt ?? o.createdAt
const age = (o: Order) => (Date.now() - new Date(placed(o)).getTime()) / DAY
const itemCount = (o: Order) => o.items.reduce((sum, item) => sum + item.quantity, 0)
// Unpaid and still going: money the store is waiting for (cash on delivery mostly).
const awaitingPayment = (o: Order) => !isPaid(o) && !STOPPED.includes(o.status)

const allFilters: ListFilter<Order>[] = [
  { label: "All", value: "all", match: () => true },
  { label: "Unpaid", value: "unpaid", match: awaitingPayment },
  { label: "Unfulfilled", value: "unfulfilled", match: (o) => UNFULFILLED.includes(o.status) },
  { label: "Shipped", value: "shipped", match: (o) => o.status === "SHIPPED" },
  { label: "Delivered", value: "delivered", match: (o) => o.status === "DELIVERED" || o.status === "COMPLETED" },
  { label: "Returned", value: "returned", match: (o) => o.status === "RETURNED" },
  { label: "Partly returned", value: "partly-returned", match: (o) => o.status === "PARTIALLY_RETURNED" },
  { label: "Cancelled", value: "cancelled", match: (o) => STOPPED.includes(o.status) && !RETURNS.includes(o.status) },
]

const pendingFilters: ListFilter<Order>[] = [
  { label: "All pending", value: "all", match: () => true },
  { label: "To confirm", value: "confirm", match: (o) => o.status === "PENDING" },
  { label: "Packing", value: "packing", match: (o) => o.status === "CONFIRMED" || o.status === "PROCESSING" },
  { label: "Ready to ship", value: "ready", match: (o) => o.status === "READY_TO_SHIP" },
  { label: "Unpaid", value: "unpaid", match: (o) => !isPaid(o) },
]

const SORTS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "total", label: "Highest total" },
]

// Total, then where the money stands: the latest payment attempt (a paid one wins) and what's still owed.
function Amount({ order, promotions = [] }: { order: Order; promotions?: string[] }) {
  const payment = order.payments.find((p) => RECEIVED.includes(p.status)) ?? order.payments.at(-1)
  const paid = order.payments.filter((p) => RECEIVED.includes(p.status)).reduce((s, p) => s + Number(p.amount), 0)
  // After a partial delivery the rest isn't owed: those items come back instead.
  let due = Number(order.totalAmount) - paid
  if (payment?.status === "PARTIALLY_PAID" || STOPPED.includes(order.status)) due = 0
  const discount = Number(order.discountAmount)
  return (
    <span className="flex flex-col items-end gap-1">
      <span className="text-[17px] font-bold tracking-tight">{taka(Number(order.totalAmount))}</span>
      <span className="flex flex-wrap items-center justify-end gap-1">
        {payment ? <Pill tone={PAYMENT_TONE[payment.status] ?? "amber"}>{PAYMENT_LABEL[payment.status]}</Pill> : <Pill tone="amber">Unpaid</Pill>}
        {settledByHand(order) && <SourceBadge source="MANUAL" />}
      </span>
      {/* Each part stays whole; the line breaks between them when the column is narrow. */}
      <span className="flex flex-wrap justify-end gap-x-1 text-[11px] text-muted-foreground">
        {payment && <span className="whitespace-nowrap">{PROVIDER_LABEL[payment.provider]}</span>}
        {due > 0 && <span className="font-medium whitespace-nowrap text-amber-700 dark:text-amber-400">{taka(due)} due</span>}
        {discount > 0 && promotions.length === 0 && <span className="whitespace-nowrap text-emerald-700 dark:text-emerald-400">−{taka(discount)} off</span>}
      </span>
      {discount > 0 && promotions.length > 0 && (
        <span className="flex flex-wrap items-center justify-end gap-1 text-[11px]">
          <span
            title={promotions.join(", ")}
            className="inline-flex max-w-28 items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-px text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
          >
            <TagIcon className="size-3 shrink-0" />
            <span className="truncate">{promotions[0]}</span>
            {promotions.length > 1 && <span className="shrink-0 font-medium">+{promotions.length - 1}</span>}
          </span>
          <span className="font-medium whitespace-nowrap text-emerald-700 dark:text-emerald-400">−{taka(discount)}</span>
        </span>
      )}
      {payment?.status === "PARTIALLY_PAID" && (
        <span className="text-[11px] font-medium whitespace-nowrap text-amber-700 dark:text-amber-400">
          {taka(Number(payment.amount))} of {taka(Number(payment.metadata?.orderedAmount))}
        </span>
      )}
      {payment?.status === "FAILED" && payment.failureMessage && <span className="max-w-28 text-right text-[11px] leading-tight whitespace-normal text-destructive">{payment.failureMessage}</span>}
    </span>
  )
}

// A returned parcel or partial delivery also says whether the items are back in stock yet.
function OrderStatusCell({ order }: { order: Order }) {
  const units = itemCount(order)
  const back = order.items.reduce((s, i) => s + i.returnedQuantity, 0)
  let title: string | undefined
  if (order.status === "PARTIALLY_RETURNED") title = `${n0(back)} of ${n0(units)} items back in stock — the customer kept the rest.`
  const badge = (
    <span title={title}>
      <StatusBadge status={ORDER_STATUS_LABEL[order.status]} />
    </span>
  )
  const partial = order.payments.some((p) => p.status === "PARTIALLY_PAID")
  if (!RETURNS.includes(order.status) && !partial) return badge
  let note = <span className="text-amber-700 dark:text-amber-400">Not received yet</span>
  if (getReturnState(order).kind === "none") note = <span className="text-emerald-700 dark:text-emerald-400">Returned to stock</span>
  else if (back > 0) note = <span className="text-amber-700 dark:text-amber-400">{n0(back)} back in stock, more to come</span>
  return (
    <span className="flex flex-col items-start gap-1">
      {badge}
      {partial && <span className="text-[11px] font-medium whitespace-nowrap text-amber-700 dark:text-amber-400">Partly delivered</span>}
      <span className="max-w-28 text-[11px] leading-tight whitespace-normal">{note}</span>
    </span>
  )
}

// The courier's tracking number (else its consignment id), linked when there's a tracking page, with a copy button.
function TrackingId({ shipment }: { shipment: Order["shipments"][number] }) {
  const id = shipment.trackingNumber ?? shipment.consignmentId
  if (!id) return null
  return (
    <span className="mt-0.5 flex items-center gap-0.5">
      {shipment.trackingUrl ? (
        <a href={shipment.trackingUrl} target="_blank" rel="noreferrer" title={`Track ${id}`} className="max-w-28 truncate font-mono text-[11px] text-primary hover:underline">
          {id}
        </a>
      ) : (
        <span title={id} className="max-w-28 truncate font-mono text-[11px]">{id}</span>
      )}
      <button
        type="button"
        aria-label={`Copy tracking ID ${id}`}
        title="Copy tracking ID"
        className="grid size-5 shrink-0 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
        onClick={() => {
          navigator.clipboard.writeText(id)
          toast.success(`Copied ${id}`)
        }}
      >
        <CopyIcon className="size-3" />
      </button>
    </span>
  )
}

function Fulfilment({ order }: { order: Order }) {
  const shipment = order.shipments.at(-1)
  if (shipment) {
    return (
      <span className="flex flex-col">
        <span className="font-medium">{CARRIER_LABEL[shipment.carrier] ?? shipment.carrier}</span>
        <span className="text-[11px] text-muted-foreground">{label(shipment.status)}</span>
        <ShipmentTiming shipment={shipment} />
        <TrackingId shipment={shipment} />
      </span>
    )
  }
  if (STOPPED.includes(order.status)) return <span className="text-muted-foreground">—</span>
  if (UNFULFILLED.includes(order.status)) {
    // Over two days without a parcel is worth a look.
    return <span className={cn("text-xs", age(order) > 2 ? "font-medium text-amber-700 dark:text-amber-400" : "text-muted-foreground")}>Not shipped</span>
  }
  return <span className="text-xs text-muted-foreground">No parcel</span>
}

const days = (from: string, to = Date.now()) => Math.max(0, Math.round((to - new Date(from).getTime()) / DAY))
const dayText = (n: number) => (n === 0 ? "same day" : `${n} ${n === 1 ? "day" : "days"}`)

// How long the parcel took, or how long it has been out; over 3 days on the road needs a look.
function ShipmentTiming({ shipment }: { shipment: Order["shipments"][number] }) {
  if (shipment.status === "DELIVERED" && shipment.deliveredAt) {
    const took = days(shipment.shippedAt ?? shipment.createdAt, new Date(shipment.deliveredAt).getTime())
    return <span className="text-[11px] text-muted-foreground">{took === 0 ? "Same day" : `Took ${dayText(took)}`}</span>
  }
  if (["SHIPPED", "IN_TRANSIT", "OUT_FOR_DELIVERY"].includes(shipment.status) && shipment.shippedAt) {
    const out = days(shipment.shippedAt)
    return <span className={cn("text-[11px] text-muted-foreground", out > 3 && "font-medium text-amber-700 dark:text-amber-400")}>{out === 0 ? "Out today" : `Out ${dayText(out)}`}</span>
  }
  if (shipment.status === "PENDING" || shipment.status === "PROCESSING") {
    const waiting = days(shipment.createdAt)
    return <span className={cn("text-[11px] text-muted-foreground", waiting > 1 && "font-medium text-amber-700 dark:text-amber-400")}>{waiting === 0 ? "Booked today" : `Booked ${dayText(waiting)} ago`}</span>
  }
  return null
}

// One customer across orders: the phone's last 10 digits, else the email (guests have no account id).
const customerKey = (o: Order) => o.customerPhone?.replace(/\D/g, "").slice(-10) || o.customerEmail.toLowerCase()

// "01911087109" style for display, and the international number WhatsApp links need.
export const localPhone = (phone: string) => `0${phone.replace(/\D/g, "").slice(-10)}`
export const whatsApp = (phone: string) => `https://wa.me/880${phone.replace(/\D/g, "").slice(-10)}`

// "11 Oct 2026 · 7:16 PM"
const placedAt = (iso: string) => {
  const d = new Date(iso)
  return `${d.getDate()} ${d.toLocaleString("en-US", { month: "short" })} ${d.getFullYear()} · ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`
}

export const FINISHED: OrderStatus[] = ["DELIVERED", "COMPLETED", "CANCELLED", "FAILED", "REFUNDED", "RETURNED", "PARTIALLY_RETURNED"]

export function OrdersTable({
  orders,
  history = orders,
  addresses,
  promotions,
  images,
  mode = "all",
}: {
  orders: Order[]
  history?: Order[] // every order, for each customer's track record
  addresses: Record<string, OrderAddress>
  promotions: Record<string, string[]> // order id → promotion names
  images: Record<string, string> // product id → primary image
  mode?: "all" | "pending"
}) {
  const [sort, setSort] = useState("newest")
  const [viewing, setViewing] = useState<Order | null>(null)
  const [cancelling, setCancelling] = useState<Order | null>(null)

  async function advance(o: Order) {
    const next = NEXT[o.status]!
    const res = await updateOrderStatus(o.id, next.status)
    if (!res.success) return toast.error(res.error)
    toast.success(`${o.orderNumber} is now ${ORDER_STATUS_LABEL[next.status].toLowerCase()}`)
  }

  async function markPaid(o: Order, paymentId: string) {
    const res = await markPaymentPaid(o.id, paymentId)
    if (!res.success) return toast.error(res.error)
    toast.success(`${o.orderNumber} marked as paid`)
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text)
    toast.success(`Copied ${text}`)
  }

  // Order count and delivery success per customer: delivered out of the orders that finished.
  const customers = new Map<string, { orders: number; finished: number; delivered: number }>()
  for (const o of history) {
    const c = customers.get(customerKey(o)) ?? { orders: 0, finished: 0, delivered: 0 }
    c.orders += 1
    if (FINISHED.includes(o.status)) c.finished += 1
    if (o.status === "DELIVERED" || o.status === "COMPLETED") c.delivered += 1
    customers.set(customerKey(o), c)
  }

  const sorted = [...orders].sort((a, b) => {
    if (sort === "oldest") return placed(a).localeCompare(placed(b))
    if (sort === "total") return Number(b.totalAmount) - Number(a.totalAmount)
    return placed(b).localeCompare(placed(a))
  })

  const columns: ListColumn<Order>[] = [
    {
      key: "order",
      header: "Order",
      cell: (o) => (
        <div className="flex flex-col items-start">
          <Link href={`/orders/${o.id}`} className="group flex flex-col">
            <span className="font-medium whitespace-nowrap group-hover:text-primary group-hover:underline">{o.orderNumber}</span>
            <span className="text-[11px] whitespace-nowrap text-muted-foreground tabular-nums">{placedAt(placed(o))}</span>
            <span className="text-[11px] text-muted-foreground">{rel(placed(o))}</span>
          </Link>
          {o.customerNote && (
            <Popover>
              {/* A quote of the note, two lines at most; click for all of it. */}
              <PopoverTrigger className="group/note mt-1.5 flex w-40 cursor-pointer gap-1.5 rounded-r-md border-l-2 border-amber-400 bg-amber-50/70 py-1 pr-2 pl-1.5 text-left whitespace-normal outline-none hover:bg-amber-100 focus-visible:ring-3 focus-visible:ring-ring/50 dark:border-amber-600 dark:bg-amber-950/60 dark:hover:bg-amber-950">
                <StickyNoteIcon className="mt-px size-3 shrink-0 text-amber-600 dark:text-amber-400" />
                <span className="line-clamp-2 text-[11px] leading-snug text-amber-900 italic dark:text-amber-200">{o.customerNote}</span>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-80">
                <div className="flex items-center gap-1.5 text-xs font-medium text-amber-800 dark:text-amber-300">
                  <StickyNoteIcon className="size-3.5" />
                  Note from {o.customerName ?? "the customer"}
                </div>
                <p className="text-sm whitespace-pre-wrap">{o.customerNote}</p>
                <div className="flex items-center justify-between gap-2 border-t pt-2 text-xs text-muted-foreground">
                  <span>{o.orderNumber}</span>
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => navigator.clipboard.writeText(o.customerNote ?? "").then(() => toast.success("Note copied"))}
                  >
                    <CopyIcon />
                    Copy
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>
      ),
    },
    {
      key: "customer",
      header: "Customer",
      cell: (o) => {
        const c = customers.get(customerKey(o))!
        const address = addresses[o.id]
        const rate = c.finished ? Math.round((c.delivered / c.finished) * 100) : null
        let rateTone = "text-emerald-700 dark:text-emerald-400"
        if (rate !== null && rate < 80) rateTone = "text-amber-700 dark:text-amber-400"
        if (rate !== null && rate < 50) rateTone = "text-destructive"
        return (
          <div className="flex w-52 flex-col gap-0.5 whitespace-normal">
            <span className="flex items-center gap-1.5">
              <span className="truncate font-medium">{o.customerName ?? o.customerEmail}</span>
              <span className="shrink-0 rounded bg-muted px-1 text-[10px] font-semibold text-muted-foreground uppercase">{o.userId ? "Account" : "Guest"}</span>
            </span>
            {o.customerPhone && (
              <span className="flex items-center gap-1.5 text-xs">
                <span className="font-mono tabular-nums">{localPhone(o.customerPhone)}</span>
                <a href={`tel:${o.customerPhone}`} aria-label={`Call ${o.customerPhone}`} className="grid size-5 place-items-center rounded-full bg-muted text-muted-foreground hover:text-foreground">
                  <PhoneIcon className="size-3" />
                </a>
                <a href={whatsApp(o.customerPhone)} target="_blank" rel="noreferrer" aria-label={`WhatsApp ${o.customerPhone}`} className="grid size-5 place-items-center rounded-full bg-emerald-600 text-white hover:bg-emerald-700">
                  <MessageCircleIcon className="size-3" />
                </a>
              </span>
            )}
            <span className="text-[11px] text-muted-foreground">
              {c.orders} {c.orders === 1 ? "order" : "orders"}
              {rate !== null && (
                <>
                  {" · "}
                  <span className={cn("font-semibold", rateTone)} title={`${c.delivered} of ${c.finished} finished orders delivered`}>
                    {rate}% delivered
                  </span>
                </>
              )}
            </span>
            {address && (
              <span className="flex items-start gap-1 text-[11px] text-muted-foreground" title={o.customerEmail}>
                <MapPinIcon className="mt-px size-3 shrink-0" />
                <span className="line-clamp-2">
                  {formatAddress(address)}
                </span>
              </span>
            )}
          </div>
        )
      },
    },
    {
      key: "items",
      header: "Items",
      className: "hidden lg:table-cell",
      cell: (o) => {
        const first = o.items[0]
        if (!first) return <span className="text-muted-foreground">No items</span>
        return (
          <span className="flex max-w-48 items-center gap-3 xl:max-w-[12.5rem]">
            <button
              type="button"
              onClick={() => setViewing(o)}
              aria-label={`See the ${o.items.length === 1 ? "item" : `${o.items.length} items`} in ${o.orderNumber}`}
              className="flex shrink-0 cursor-zoom-in rounded-lg outline-none hover:[&>span]:ring-primary/40 focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {/* Up to three pictures; with four or more the third tile counts the rest. */}
              {(o.items.length > 3 ? o.items.slice(0, 2) : o.items).map((item, index) => (
                <span
                  key={item.id}
                  title={item.productName}
                  // The first item (the one named beside it) sits on top.
                  style={{ zIndex: 3 - index }}
                  className={cn("relative grid size-9 shrink-0 place-items-center overflow-hidden rounded-lg border bg-muted ring-2 ring-card transition-shadow", index > 0 && "-ml-3.5")}
                >
                  {item.productId && images[item.productId] ? (
                    // eslint-disable-next-line @next/next/no-img-element -- any image host is allowed
                    <img src={images[item.productId]} alt={item.productName} className="size-full object-cover" />
                  ) : (
                    <PackageIcon className="size-4 text-muted-foreground" />
                  )}
                </span>
              ))}
              {o.items.length > 3 && (
                <span className="relative -ml-3.5 grid size-9 shrink-0 place-items-center rounded-lg border bg-foreground text-xs font-semibold text-background ring-2 ring-card">
                  +{o.items.length - 2}
                </span>
              )}
            </button>
            <span className="flex min-w-0 flex-col">
              <span className="truncate" title={first.productName}>{first.productName}</span>
              <span className="truncate text-[11px] text-muted-foreground">
                {/* Single-variant products snapshot the SKU as the variant name, so that one says nothing. */}
                {first.variantName && first.variantName !== first.sku && <span className="font-medium text-foreground">{first.variantName} · </span>}
                {o.items.length > 1 && `${o.items.length} items · `}
                {n0(itemCount(o))} {itemCount(o) === 1 ? "unit" : "units"}
              </span>
            </span>
          </span>
        )
      },
    },
    { key: "fulfilment", header: "Fulfilment", className: "hidden md:table-cell", cell: (o) => <Fulfilment order={o} /> },
    { key: "status", header: "Status", cell: (o) => <OrderStatusCell order={o} /> },
    { key: "amount", header: "Amount", className: "text-right tabular-nums", cell: (o) => <Amount order={o} promotions={promotions[o.id]} /> },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      className: "w-10 pl-0",
      cell: (o) => {
        const next = NEXT[o.status]
        const openPayment = STOPPED.includes(o.status) ? undefined : o.payments.find((p) => p.status === "PENDING" || p.status === "PROCESSING")
        return (
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="size-8 text-muted-foreground data-open:bg-muted" />}>
              <EllipsisVerticalIcon />
              <span className="sr-only">Actions for {o.orderNumber}</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem render={<Link href={`/orders/${o.id}`} />}>
                <EyeIcon />
                View order
              </DropdownMenuItem>
              {next && !followsShipment(o, next.status) && (
                <DropdownMenuItem onClick={() => advance(o)}>
                  <StepForwardIcon />
                  {next.text}
                </DropdownMenuItem>
              )}
              {openPayment && (
                <DropdownMenuItem onClick={() => markPaid(o, openPayment.id)}>
                  <BanknoteIcon />
                  Mark as paid · {taka(Number(openPayment.amount))}
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => copy(o.orderNumber)}>
                <CopyIcon />
                Copy order number
              </DropdownMenuItem>
              {o.customerPhone && (
                <>
                  <DropdownMenuItem render={<a href={`tel:${o.customerPhone}`} />}>
                    <PhoneIcon />
                    Call customer
                  </DropdownMenuItem>
                  <DropdownMenuItem render={<a href={whatsApp(o.customerPhone)} target="_blank" rel="noreferrer" />}>
                    <MessageCircleIcon />
                    WhatsApp customer
                  </DropdownMenuItem>
                </>
              )}
              {CANCELLABLE.includes(o.status) && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onClick={() => setCancelling(o)} disabled={!!cancelBlockedBy(o)}>
                    <XCircleIcon />
                    <span className="flex flex-col">
                      Cancel order
                      {cancelBlockedBy(o) && <span className="text-[11px] font-normal text-muted-foreground">{cancelBlockedBy(o)}</span>}
                    </span>
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ]

  const kept = orders.filter((o) => !STOPPED.includes(o.status))
  const revenue = orders.filter(isPaid).reduce((sum, o) => sum + Number(o.totalAmount), 0)
  const unpaid = orders.filter(awaitingPayment)
  const unfulfilled = orders.filter((o) => UNFULFILLED.includes(o.status))
  const late = unfulfilled.filter((o) => age(o) > 2)
  const oldest = [...unfulfilled].sort((a, b) => placed(a).localeCompare(placed(b)))[0]

  return (
    <>
      {mode === "all" ? (
        <Kpis
          items={[
            {
              label: "Orders",
              value: n0(orders.length),
              hint: `${n0(orders.filter((o) => age(o) < 1).length)} today · ${n0(orders.filter((o) => age(o) < 7).length)} this week`,
            },
            { label: "Revenue", value: taka(revenue), hint: `paid · avg ${taka(kept.length ? kept.reduce((s, o) => s + Number(o.totalAmount), 0) / kept.length : 0)} an order` },
            {
              label: "Awaiting payment",
              value: taka(unpaid.reduce((s, o) => s + Number(o.totalAmount), 0)),
              hint: unpaid.length ? `${n0(unpaid.length)} ${unpaid.length === 1 ? "order" : "orders"}, mostly cash on delivery` : "nothing outstanding",
            },
            { label: "To fulfil", value: n0(unfulfilled.length), hint: late.length ? `${n0(late.length)} waiting over 2 days` : "nothing late", warn: late.length > 0 },
            { label: "Shipped", value: n0(orders.filter((o) => o.status === "SHIPPED").length), hint: "on the way to customers" },
            {
              label: "Cancelled",
              value: n0(orders.length - kept.length),
              hint: orders.length ? `${Math.round(((orders.length - kept.length) / orders.length) * 100)}% of orders` : "none yet",
            },
          ]}
        />
      ) : (
        <Kpis
          items={[
            { label: "Pending", value: n0(orders.length), hint: `${taka(orders.reduce((s, o) => s + Number(o.totalAmount), 0))} in value` },
            { label: "To confirm", value: n0(orders.filter((o) => o.status === "PENDING").length), hint: "new, not confirmed yet" },
            { label: "Packing", value: n0(orders.filter((o) => o.status === "CONFIRMED" || o.status === "PROCESSING").length), hint: "confirmed or processing" },
            { label: "Ready to ship", value: n0(orders.filter((o) => o.status === "READY_TO_SHIP").length), hint: "waiting for the courier" },
            { label: "Unpaid", value: n0(orders.filter((o) => !isPaid(o)).length), hint: "pay on delivery or not paid yet" },
            { label: "Oldest waiting", value: oldest ? rel(placed(oldest)).replace(" ago", "") : "—", hint: oldest?.orderNumber ?? "nothing waiting", warn: late.length > 0 },
          ]}
        />
      )}
      <ListTable
        rows={sorted}
        columns={columns}
        getRowId={(o) => o.id}
        searchText={(o) =>
          `${o.orderNumber} ${o.customerName ?? ""} ${o.customerEmail} ${o.customerPhone ?? ""} ${o.customerPhone ? localPhone(o.customerPhone) : ""} ${Object.values(addresses[o.id] ?? {}).join(" ")} ${o.items.map((i) => `${i.productName} ${i.sku}`).join(" ")} ${o.customerNote ?? ""} ${(promotions[o.id] ?? []).join(" ")}`
        }
        searchPlaceholder="Search orders…"
        // Empty tabs only add noise; "All" always stays.
        filters={(mode === "pending" ? pendingFilters : allFilters).filter((f, index) => index === 0 || sorted.some(f.match))}
        emptyText={mode === "pending" ? "All caught up — no pending orders." : "No orders yet."}
        toolbar={
          <>
            <Select value={sort} items={SORTS} onValueChange={(v) => setSort(v as string)}>
              <SelectTrigger size="sm" aria-label="Sort orders" className="hidden w-36 sm:flex"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SORTS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <RefreshButton iconOnly />
          </>
        }
      />
      {cancelling && <CancelDialog orderId={cancelling.id} orderNumber={cancelling.orderNumber} onClose={() => setCancelling(null)} />}
      {viewing && <ItemsDialog key={viewing.id} order={viewing} images={images} onClose={() => setViewing(null)} />}
    </>
  )
}

// Order items only keep the variant's text ("M", "Red / 42"), so the products are fetched to name each option.
function ItemsDialog({ order, images, onClose }: { order: Order; images: Record<string, string>; onClose: () => void }) {
  const [products, setProducts] = useState<Record<string, ProductDetail>>({})
  const units = itemCount(order)

  useEffect(() => {
    let stale = false
    const ids = [...new Set(order.items.map((i) => i.productId).filter((id): id is string => !!id))]
    Promise.all(ids.map((id) => getProduct(id))).then((results) => {
      if (stale) return
      const found: Record<string, ProductDetail> = {}
      for (const r of results) if (r.success) found[r.data.id] = r.data
      setProducts(found)
    })
    return () => {
      stale = true
    }
  }, [order])

  const payment = order.payments.find((p) => p.status === "PAID") ?? order.payments.at(-1)
  const paid = order.payments.filter((p) => ["PAID", "PARTIALLY_PAID", "REFUNDED", "PARTIALLY_REFUNDED"].includes(p.status)).reduce((sum, p) => sum + Number(p.amount), 0)
  const loading = Object.keys(products).length === 0 && order.items.some((i) => i.productId)
  const shipment = order.shipments.at(-1)

  // A plain picking list: "2 × Tartan Dress (M) · TARTAN-DRESS-M".
  function copyList() {
    const lines = order.items.map((i) => {
      const variant = i.variantName && i.variantName !== i.sku ? ` (${i.variantName})` : ""
      return `${i.quantity} × ${i.productName}${variant} · ${i.sku}`
    })
    navigator.clipboard.writeText(`${order.orderNumber}\n${lines.join("\n")}`).then(() => toast.success("Item list copied"))
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="gap-0 p-0 sm:max-w-[42rem]">
        <DialogHeader className="gap-2 border-b px-5 pt-5 pb-4">
          <div className="flex flex-wrap items-center gap-2 pr-8">
            <DialogTitle className="font-mono text-base">{order.orderNumber}</DialogTitle>
            <StatusBadge status={ORDER_STATUS_LABEL[order.status]} />
          </div>
          <DialogDescription className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs">
            <span className="font-medium text-foreground">{order.customerName ?? order.customerEmail}</span>
            {order.customerPhone && <span className="font-mono">· {localPhone(order.customerPhone)}</span>}
            <span>· {placedAt(placed(order))}</span>
          </DialogDescription>
          {shipment && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <TruckIcon className="size-3.5" />
              <span className="font-medium text-foreground">{CARRIER_LABEL[shipment.carrier]}</span>
              <span>· {label(shipment.status)}</span>
              {(shipment.consignmentId ?? shipment.trackingNumber) && <span className="font-mono">· {shipment.consignmentId ?? shipment.trackingNumber}</span>}
            </div>
          )}
        </DialogHeader>

        <div className="flex items-center justify-between border-b bg-muted/30 px-5 py-2 text-xs text-muted-foreground">
          <span>
            {order.items.length} {order.items.length === 1 ? "item" : "items"} · {n0(units)} {units === 1 ? "unit" : "units"}
          </span>
          <Button variant="ghost" size="xs" onClick={copyList}>
            <CopyIcon />
            Copy list
          </Button>
        </div>

        <ul className="max-h-[60vh] divide-y overflow-y-auto">
          {order.items.map((item) => {
            const product = item.productId ? products[item.productId] : undefined
            const variant = product?.variants.find((v) => v.id === item.variantId)
            const optionName = (optionId: string) => {
              const option = product?.options.find((o) => o.option.id === optionId)?.option
              return option?.displayName ?? option?.name ?? "Option"
            }
            let options = (variant?.optionValues ?? []).map((ov) => ({ name: optionName(ov.optionValue.optionId), value: ov.optionValue.value }))
            // Until the product loads (or if it's gone), fall back to the snapshot's text.
            if (options.length === 0 && item.variantName && item.variantName !== "None" && item.variantName !== item.sku) {
              options = [{ name: "Variant", value: item.variantName }]
            }
            const src = variant?.images[0]?.url ?? (item.productId ? images[item.productId] : undefined)
            const full = Number(item.unitPrice) * item.quantity
            const saved = full - Number(item.totalAmount)
            return (
              <li key={item.id} className={cn("flex items-center gap-4 px-5 py-3.5", item.returnedQuantity >= item.quantity && "opacity-60")}>
                <span className="relative grid size-20 shrink-0 place-items-center overflow-hidden rounded-xl border bg-muted">
                  {src ? (
                    // eslint-disable-next-line @next/next/no-img-element -- any image host is allowed
                    <img src={src} alt={item.productName} className="size-full object-cover" />
                  ) : (
                    <PackageIcon className="size-6 text-muted-foreground" />
                  )}
                  {item.quantity > 1 && (
                    <span className="absolute top-1 right-1 grid h-5 min-w-5 place-items-center rounded-full bg-foreground px-1 text-[11px] font-bold text-background tabular-nums">
                      ×{item.quantity}
                    </span>
                  )}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="min-w-0">
                    {product?.brand && <div className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{product.brand.name}</div>}
                    {item.productId ? (
                      <Link href={`/products/${item.productId}`} className="font-medium hover:text-primary hover:underline">
                        {item.productName}
                      </Link>
                    ) : (
                      <span className="font-medium">{item.productName}</span>
                    )}
                  </div>
                  {options.length > 0 && (
                    <span className="flex flex-wrap gap-1.5">
                      {options.map((opt) => (
                        <span key={opt.name} className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-px text-[11px]">
                          <span className="text-muted-foreground">{opt.name}</span>
                          <b className="font-semibold">{opt.value}</b>
                        </span>
                      ))}
                    </span>
                  )}
                  {/* Single-variant items snapshot the SKU as their name, so there's nothing to wait for. */}
                  {loading && options.length === 0 && item.variantName !== item.sku && <span className="h-4 w-20 animate-pulse rounded-md bg-muted" />}
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                    <span className="font-mono">{item.sku}</span>
                    {variant && (
                      <span className={cn(variant.stock === 0 && "text-destructive", variant.stock > 0 && variant.stock <= 5 && "text-amber-700 dark:text-amber-400")}>
                        · {variant.stock === 0 ? "out of stock" : `${n0(variant.stock)} in stock`}
                      </span>
                    )}
                    {item.returnedQuantity > 0 && (
                      <span className="rounded bg-amber-100 px-1.5 py-px font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">{n0(item.returnedQuantity)} returned</span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-0.5 text-right tabular-nums">
                  <span className="font-semibold">{taka(Number(item.totalAmount))}</span>
                  {saved > 0 && <span className="text-xs text-muted-foreground line-through">{taka(full)}</span>}
                  {item.quantity > 1 && (
                    <span className="text-xs text-muted-foreground">
                      {n0(item.quantity)} × {taka(Number(item.unitPrice))}
                    </span>
                  )}
                  {saved > 0 && <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">−{taka(saved)} off</span>}
                </div>
              </li>
            )
          })}
        </ul>

        <dl className="grid gap-1.5 border-t bg-muted/30 px-5 py-3 text-sm tabular-nums">
          <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd>{taka(Number(order.subtotalAmount))}</dd></div>
          {Number(order.discountAmount) > 0 && (
            <div className="flex justify-between"><dt className="text-muted-foreground">Discount</dt><dd className="text-emerald-700 dark:text-emerald-400">−{taka(Number(order.discountAmount))}</dd></div>
          )}
          <div className="flex justify-between"><dt className="text-muted-foreground">Shipping</dt><dd>{Number(order.shippingAmount) ? taka(Number(order.shippingAmount)) : "Free"}</dd></div>
          <div className="flex justify-between border-t pt-1.5 text-base font-semibold"><dt>Total</dt><dd>{taka(Number(order.totalAmount))}</dd></div>
          {payment && (
            <div className="flex items-center justify-between gap-2 text-xs">
              <dt className="flex items-center gap-1.5 text-muted-foreground">
                {PROVIDER_LABEL[payment.provider]}
                <Pill tone={PAYMENT_TONE[payment.status] ?? "amber"}>{PAYMENT_LABEL[payment.status]}</Pill>
              </dt>
              <dd className="text-muted-foreground">{taka(paid)} paid</dd>
            </div>
          )}
        </dl>

        <DialogFooter className="m-0 rounded-b-xl border-t px-5 py-3">
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button nativeButton={false} render={<Link href={`/orders/${order.id}`} />}>
            Open order
            <ArrowRightIcon data-icon="inline-end" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function CancelDialog({ orderId, orderNumber, onClose }: { orderId: string; orderNumber: string; onClose: () => void }) {
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

// Re-runs the page's server fetches (new orders, courier updates) without a full reload.
export function RefreshButton({ iconOnly = false }: { iconOnly?: boolean }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  return (
    <Button
      size={iconOnly ? "icon-sm" : "sm"}
      variant="outline"
      className="bg-card"
      disabled={pending}
      title="Refresh"
      aria-label="Refresh"
      onClick={() =>
        startTransition(() => {
          router.refresh()
          toast.success("Up to date")
        })
      }
    >
      <RefreshCwIcon className={cn(pending && "animate-spin")} />
      {!iconOnly && (pending ? "Refreshing..." : "Refresh")}
    </Button>
  )
}
