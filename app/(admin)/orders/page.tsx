import { connection } from "next/server"

import { getOrders, getListDetails } from "@/app/actions/order.actions"
import { getProducts } from "@/app/actions/product.actions"
import { OrdersTable } from "@/components/orders/orders-table"
import { PageHeader } from "@/components/page-header"

export default async function OrdersPage() {
  // Load fresh data on every request instead of once at build time.
  await connection()

  const res = await getOrders()
  const { addresses, promotions } = res.success ? await getListDetails(res.data.map((o) => o.id)) : { addresses: {}, promotions: {} }
  // Order items are snapshots without images, so show each product's primary image.
  const products = await getProducts()
  const images: Record<string, string> = {}
  for (const p of products.success ? products.data : []) {
    const image = p.images.find((i) => i.isPrimary) ?? p.images[0]
    if (image) images[p.id] = image.url
  }

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <PageHeader title="Orders" description="Track, fulfil and manage every order in your store." />
      {res.success ? (
        <OrdersTable orders={res.data} addresses={addresses} promotions={promotions} images={images} />
      ) : (
        <p className="px-4 text-muted-foreground lg:px-6">Couldn’t load orders: {res.error}</p>
      )}
    </div>
  )
}
