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
  const partial = order.payments.find((p) => p.provider === "COD" && p.status === "PARTIALLY_PAID")
  // Nothing was collected on a returned parcel, so every unit should come back.
  if (!partial && (order.status === "RETURNED" || order.status === "PARTIALLY_RETURNED")) return { kind: "returned", remaining }
  if (!partial) return { kind: "none" }
  const collected = Number(partial.amount)
  const ordered = Number(partial.metadata?.orderedAmount)
  // The items the customer kept never come back, so "done" is when the units received cover what wasn't paid for.
  const returnedValue = order.items.reduce((s, i) => s + (Number(i.totalAmount) / i.quantity) * (i.returnedQuantity ?? 0), 0)
  if (ordered - collected - returnedValue < 1) return { kind: "none" }
  return { kind: "partial", collected, ordered, remaining }
}
