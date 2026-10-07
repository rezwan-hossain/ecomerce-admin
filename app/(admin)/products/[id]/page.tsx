import { notFound } from "next/navigation"
import { connection } from "next/server"

import { getProductMovements, getProductStock } from "@/app/actions/inventory.actions"
import { getOrders } from "@/app/actions/order.actions"
import { getProduct } from "@/app/actions/product.actions"
import { getProductReviews } from "@/app/actions/review.actions"
import { ProductDetailPage } from "@/components/products/product-detail"

export default async function ProductPage({ params }: PageProps<"/products/[id]">) {
  await connection()
  const { id } = await params

  const [product, stock, orders, reviews] = await Promise.all([
    getProduct(id),
    getProductStock(id),
    getOrders(),
    getProductReviews(id),
  ])
  if (!product.success) notFound()

  const movements = await getProductMovements(product.data.variants.map((v) => v.id), 15)

  // The orders API can't filter by product, so keep the orders that contain it.
  const productOrders = orders.success ? orders.data.filter((o) => o.items.some((i) => i.productId === id)) : []

  return (
    <ProductDetailPage
      product={product.data}
      stock={stock.success ? stock.data : []}
      movements={movements.success ? movements.data.movements : []}
      orders={productOrders}
      reviews={reviews.success ? reviews.data : []}
    />
  )
}
