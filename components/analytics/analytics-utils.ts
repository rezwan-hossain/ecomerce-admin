// Sales numbers shared by the analytics pages. Built on the server from orders, products and stock,
// then summed in the browser for whichever period is picked.
import type { VariantStock } from "@/types/inventory.type"
import type { Order, OrderAddress, OrderStatus } from "@/types/order.type"
import type { Product } from "@/types/product.type"

const DAY = 86_400_000

// These orders never took the customer's money or the stock.
const NEVER_SOLD: OrderStatus[] = ["CANCELLED", "FAILED"]
// Everything in these came back or was paid back.
const GIVEN_BACK: OrderStatus[] = ["RETURNED", "REFUNDED"]

export type SaleOrder = {
  id: string
  number: string
  at: string
  status: OrderStatus
  provider: string
  gross: number // list price × units, before discounts
  discount: number
  returned: number // value of what came back (after its discount)
  shipping: number // delivery charged to the customer
  units: number
  cancelled: boolean
  customer: string // phone's last 10 digits, else the email: one person across orders
  customerName: string
  firstOrder: boolean // the customer's first order that wasn't cancelled
  city: string | null // the shipping district
  promotions: string[]
  cod: boolean
  deliveryDays: number | null // placed → parcel delivered
  received: number // money in: paid, partly paid or later refunded (refunds are a separate decision)
  carrier: string | null // the latest parcel's courier
  parcel: string | null // the latest parcel's status
  courierFee: number // what couriers charged us for this order's parcels
}

// Same rule as the backend: these payments brought money in.
const RECEIVED = ["PAID", "PARTIALLY_PAID", "REFUNDED", "PARTIALLY_REFUNDED"]

export type SaleLine = {
  orderId: string
  at: string
  productId: string
  units: number // kept: ordered minus returned
  returned: number // units that came back
  revenue: number // net of discounts, for the kept units
  cost: number | null // kept units × average unit cost, when the cost is recorded
}

export type ProductInfo = {
  id: string
  name: string
  image?: string
  brand: string | null
  category: string | null
  status: string
  stock: number // sellable units now
}

export function buildSalesData(
  orders: Order[],
  products: Product[],
  stock: VariantStock[],
  details: { addresses?: Record<string, OrderAddress>; promotions?: Record<string, string[]> } = {}
) {
  // Average unit cost per variant, weighted by the units on hand in each warehouse.
  const unitCost: Record<string, number> = {}
  const stockByProduct: Record<string, number> = {}
  for (const v of stock) {
    let units = 0
    let value = 0
    for (const l of v.levels) {
      // A cost of 0 means none was recorded.
      if (!(Number(l.unitCost) > 0) || l.onHand <= 0) continue
      units += l.onHand
      value += l.onHand * Number(l.unitCost)
    }
    if (units > 0) unitCost[v.variantId] = value / units
    stockByProduct[v.product.id] = (stockByProduct[v.product.id] ?? 0) + v.stock
  }

  // Each customer's first order that went through, oldest first.
  const customerOf = (o: Order) => o.customerPhone?.replace(/\D/g, "").slice(-10) || o.customerEmail.toLowerCase()
  const firstOrderId = new Map<string, string>()
  for (const o of [...orders].sort((a, b) => (a.placedAt ?? a.createdAt).localeCompare(b.placedAt ?? b.createdAt))) {
    if (!NEVER_SOLD.includes(o.status) && !firstOrderId.has(customerOf(o))) firstOrderId.set(customerOf(o), o.id)
  }

  const saleOrders: SaleOrder[] = []
  const lines: SaleLine[] = []
  for (const o of orders) {
    const at = o.placedAt ?? o.createdAt
    const cancelled = NEVER_SOLD.includes(o.status)
    const givenBack = GIVEN_BACK.includes(o.status)
    let gross = 0
    let returned = 0
    let units = 0
    for (const item of o.items) {
      const net = Number(item.totalAmount)
      const perUnit = net / item.quantity
      // A returned or refunded order gave everything back, even from before returns were counted per item.
      const back = givenBack ? item.quantity : (item.returnedQuantity ?? 0)
      gross += Number(item.unitPrice) * item.quantity
      returned += perUnit * back
      units += item.quantity
      const kept = item.quantity - back
      if (cancelled || !item.productId) continue
      const cost = item.variantId ? unitCost[item.variantId] : undefined
      lines.push({ orderId: o.id, at, productId: item.productId, units: kept, returned: back, revenue: perUnit * kept, cost: cost === undefined ? null : cost * kept })
    }
    saleOrders.push({
      id: o.id,
      number: o.orderNumber,
      at,
      status: o.status,
      provider: o.payments.find((p) => p.status === "PAID")?.provider ?? o.payments.at(-1)?.provider ?? "OTHER",
      gross,
      discount: Number(o.discountAmount),
      returned,
      shipping: Number(o.shippingAmount),
      units,
      cancelled,
      customer: customerOf(o),
      customerName: o.customerName ?? o.customerEmail,
      firstOrder: firstOrderId.get(customerOf(o)) === o.id,
      city: details.addresses?.[o.id]?.city || null,
      promotions: details.promotions?.[o.id] ?? [],
      cod: o.payments.some((p) => p.provider === "COD"),
      received: o.payments.filter((p) => RECEIVED.includes(p.status)).reduce((sum, p) => sum + Number(p.amount), 0),
      carrier: o.shipments.at(-1)?.carrier ?? null,
      parcel: o.shipments.at(-1)?.status ?? null,
      // Pathao reports its own fee; the shipment's amount may just copy the customer's delivery charge.
      courierFee: o.shipments.reduce((sum, sh) => sum + (sh.metadata?.pathaoDeliveryFee ?? Number(sh.shippingAmount)), 0),
      deliveryDays: deliveredAfter(o, at),
    })
  }

  const info: ProductInfo[] = products.map((p) => ({
    id: p.id,
    name: p.name,
    image: (p.images.find((i) => i.isPrimary) ?? p.images[0])?.url,
    brand: p.brand?.name ?? null,
    category: (p.categories.find((c) => c.isPrimary) ?? p.categories[0])?.category.name ?? null,
    status: p.status,
    stock: stockByProduct[p.id] ?? 0,
  }))

  return { orders: saleOrders, lines, products: info }
}

export type SalesData = ReturnType<typeof buildSalesData>

function deliveredAfter(o: Order, at: string) {
  const delivered = o.shipments.find((s) => s.status === "DELIVERED" && s.deliveredAt)?.deliveredAt
  if (!delivered) return null
  return Math.max(0, (new Date(delivered).getTime() - new Date(at).getTime()) / DAY)
}

// ── Periods ─────────────────────────────────────────

export const PERIODS = [
  { value: "7d", label: "7 days", days: 7 },
  { value: "30d", label: "30 days", days: 30 },
  { value: "90d", label: "90 days", days: 90 },
  { value: "12m", label: "12 months", days: 365 },
  { value: "all", label: "All time", days: 0 },
] as const
export type Period = (typeof PERIODS)[number]["value"]

// The picked window and the same length just before it, for "vs previous".
export function periodRange(period: Period, firstAt: string | undefined) {
  const end = Date.now()
  const days = PERIODS.find((p) => p.value === period)!.days
  let start = end - days * DAY
  if (days === 0) start = firstAt ? new Date(firstAt).getTime() : end - 30 * DAY
  return { start, end, previousStart: start - (end - start) }
}

export const within = (at: string, start: number, end: number) => {
  const t = new Date(at).getTime()
  return t >= start && t < end
}

// Days for a week or two, weeks for a quarter, months beyond that.
export function bucketSize(start: number, end: number): "day" | "week" | "month" {
  const days = (end - start) / DAY
  if (days <= 31) return "day"
  if (days <= 120) return "week"
  return "month"
}

function bucketStart(t: number, size: "day" | "week" | "month") {
  const d = new Date(t)
  d.setHours(0, 0, 0, 0)
  if (size === "week") d.setDate(d.getDate() - ((d.getDay() + 6) % 7)) // weeks start on Monday
  if (size === "month") d.setDate(1)
  return d
}

// Every bucket in the window, empty ones too, so the chart's gaps are real.
export function buckets(start: number, end: number) {
  const size = bucketSize(start, end)
  const list: { key: string; label: string; from: number }[] = []
  const d = bucketStart(start, size)
  while (d.getTime() < end) {
    let label = d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })
    if (size === "month") label = d.toLocaleDateString("en-GB", { month: "short", year: "2-digit" })
    list.push({ key: d.toISOString(), label, from: d.getTime() })
    if (size === "day") d.setDate(d.getDate() + 1)
    if (size === "week") d.setDate(d.getDate() + 7)
    if (size === "month") d.setMonth(d.getMonth() + 1)
  }
  return { size, list, keyOf: (at: string) => bucketStart(new Date(at).getTime(), size).toISOString() }
}

// "+12%" / "−4%" against the previous period; null when there's nothing to compare with.
export function change(now: number, before: number) {
  if (before === 0) return null
  return ((now - before) / before) * 100
}
