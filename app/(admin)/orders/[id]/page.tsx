import { notFound } from "next/navigation"
import { connection } from "next/server"

import { getReferenceMovements, getVariantStock } from "@/app/actions/inventory.actions"
import { getOrder, getOrders } from "@/app/actions/order.actions"
import { getProduct } from "@/app/actions/product.actions"
import { OrderDetailPage } from "@/components/orders/order-detail"
import type { VariantStockDetail } from "@/types/inventory.type"

export default async function OrderPage({ params }: PageProps<"/orders/[id]">) {
  await connection()
  const { id } = await params

  const order = await getOrder(id)
  if (!order.success) notFound()

  const productIds = [...new Set(order.data.items.flatMap((i) => (i.productId ? [i.productId] : [])))]
  const variantIds = [...new Set(order.data.items.flatMap((i) => (i.variantId ? [i.variantId] : [])))]
  const [products, variants, movements, orders] = await Promise.all([
    Promise.all(productIds.map((productId) => getProduct(productId))),
    Promise.all(variantIds.map((variantId) => getVariantStock(variantId))),
    getReferenceMovements(id),
    getOrders(),
  ])

  // Order items are snapshots without images, so look up each product's primary image.
  const images: Record<string, string> = {}
  for (const p of products) {
    if (!p.success) continue
    const image = p.data.images.find((i) => i.isPrimary) ?? p.data.images[0]
    if (image) images[p.data.id] = image.url
  }
  const stock: Record<string, VariantStockDetail> = {}
  for (const v of variants) {
    if (v.success) stock[v.data.variantId] = v.data
  }

  // The orders API can't filter by customer, so keep the ones with the same email.
  const email = order.data.customerEmail.toLowerCase()
  const history = orders.success ? orders.data.filter((o) => o.customerEmail.toLowerCase() === email) : []

  return (
    <OrderDetailPage
      order={order.data}
      images={images}
      stock={stock}
      movements={movements.success ? movements.data : []}
      history={history}
    />
  )
}
