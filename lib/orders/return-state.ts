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
  if (order.status === "RETURNED") return { kind: "returned", remaining }
  const partial = order.payments.find((p) => p.provider === "COD" && p.status === "PARTIALLY_PAID")
  if (partial) return { kind: "partial", collected: Number(partial.amount), ordered: Number(partial.metadata?.orderedAmount), remaining }
  return { kind: "none" }
}
