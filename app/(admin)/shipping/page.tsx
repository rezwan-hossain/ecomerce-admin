import { connection } from "next/server"

import { getOrder, getOrders } from "@/app/actions/order.actions"
import { PageHeader } from "@/components/page-header"
import { ShippingBoard } from "@/components/shipping/shipping-board"

// Placed and paid for (or cash on delivery), not handed to a courier yet.
const TO_FULFIL = ["CONFIRMED", "PROCESSING", "READY_TO_SHIP"]

export default async function ShippingPage() {
  // Load fresh data on every request instead of once at build time.
  await connection()

  const orders = await getOrders()
  if (!orders.success) {
    return <p className="px-4 py-6 text-muted-foreground lg:px-6">Couldn’t load orders: {orders.error}</p>
  }

  // The list has no addresses, so look up where each waiting order goes.
  const waiting = orders.data.filter((o) => TO_FULFIL.includes(o.status))
  const details = await Promise.all(waiting.map((o) => getOrder(o.id)))
  const destinations: Record<string, string> = {}
  for (const d of details) {
    if (!d.success) continue
    const address = d.data.addresses.find((a) => a.type === "SHIPPING")
    if (address) destinations[d.data.id] = [address.city, address.state].filter(Boolean).join(", ")
  }

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <PageHeader title="Shipping" description="Pack orders, hand them to couriers and follow every parcel until it's delivered." />
      <ShippingBoard orders={orders.data} destinations={destinations} />
    </div>
  )
}
