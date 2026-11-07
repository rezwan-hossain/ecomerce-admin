import type { Order } from "@/types/order.type"

export interface RemainingItem {
  orderItemId: string
  name: string
  remaining: number
}

export type ReturnState =
  | { kind: "none" }
  | { kind: "returned"; remaining: RemainingItem[] }
  | { kind: "partial"; collected: number; ordered: number; remaining: RemainingItem[] }

// Whether items are still out with the courier or customer and should come back into stock.
export function getReturnState(order: Pick<Order, "status" | "items" | "payments">): ReturnState {
  const remaining = order.items
    .map((i) => ({ orderItemId: i.id, name: i.productName, remaining: i.quantity - (i.returnedQuantity ?? 0) }))
    .filter((i) => i.remaining > 0)
  if (remaining.length === 0) return { kind: "none" }
  let partial = order.payments.find((p) => p.provider === "COD" && p.status === "PARTIALLY_PAID")
  // Delivered but the courier collected ৳0 of what was owed: also a partial delivery, with nothing paid.
  const nothing = order.payments.find((p) => p.provider === "COD" && p.status === "FAILED" && p.metadata?.collectedAmount === "0")
  if (!partial && nothing && (order.status === "DELIVERED" || order.status === "PARTIALLY_RETURNED")) partial = nothing
  // Nothing was collected on a returned parcel, so every unit should come back.
  if (!partial && (order.status === "RETURNED" || order.status === "PARTIALLY_RETURNED")) return { kind: "returned", remaining }
  if (!partial) return { kind: "none" }
  // Money paid since (e.g. recorded after the courier collected nothing) counts as collected too.
  const later = order.payments.filter((p) => p !== partial && ["PAID", "PARTIALLY_PAID"].includes(p.status)).reduce((s, p) => s + Number(p.amount), 0)
  const collected = (partial.status === "FAILED" ? 0 : Number(partial.amount)) + later
  const ordered = Number(partial.metadata?.orderedAmount)
  // The items the customer kept never come back, so "done" is when the units received cover what wasn't paid for.
  const returnedValue = order.items.reduce((s, i) => s + (Number(i.totalAmount) / i.quantity) * (i.returnedQuantity ?? 0), 0)
  if (ordered - collected - returnedValue < 1) return { kind: "none" }
  return { kind: "partial", collected, ordered, remaining }
}
