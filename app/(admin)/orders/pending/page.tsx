import { connection } from "next/server"

import { getOrders, getShippingAddresses } from "@/app/actions/order.actions"
import { getProducts } from "@/app/actions/product.actions"
import { OrdersTable } from "@/components/orders/orders-table"
import { PageHeader } from "@/components/page-header"

export default async function PendingOrdersPage() {
  await connection()

  const res = await getOrders()
  const pending = res.success ? res.data.filter((o) => ["PENDING", "CONFIRMED", "PROCESSING", "READY_TO_SHIP"].includes(o.status)) : []
  const addresses = await getShippingAddresses(pending.map((o) => o.id))
  // Order items are snapshots without images, so show each product's primary image.
  const products = await getProducts()
  const images: Record<string, string> = {}
  for (const p of products.success ? products.data : []) {
    const image = p.images.find((i) => i.isPrimary) ?? p.images[0]
    if (image) images[p.id] = image.url
  }

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <PageHeader
        title="Pending Orders"
        description="Orders placed but not shipped yet: waiting for payment, confirmation or packing."
      />
      {res.success ? (
        <OrdersTable orders={pending} history={res.data} addresses={addresses} images={images} mode="pending" />
      ) : (
        <p className="px-4 text-muted-foreground lg:px-6">Couldn’t load orders: {res.error}</p>
      )}
    </div>
  )
}
