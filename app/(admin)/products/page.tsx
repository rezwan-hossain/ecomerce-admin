import { connection } from "next/server"

import { getStock } from "@/app/actions/inventory.actions"
import { getOrders } from "@/app/actions/order.actions"
import { getProducts } from "@/app/actions/product.actions"
import { getReviews } from "@/app/actions/review.actions"
import { PageHeader } from "@/components/page-header"
import { type ProductInsight, ProductsTable } from "@/components/products/products-table"

const DAY = 86_400_000
// These orders never took the stock, so they don't count as sold.
const NOT_SOLD = ["CANCELLED", "FAILED", "REFUNDED"]

export default async function ProductsPage() {
  // Load fresh data on every request instead of once at build time.
  await connection()

  const [res, stock, orders, reviews] = await Promise.all([getProducts(), getStock(), getOrders(), getReviews()])

  // Stock, sales and ratings per product, summed here so the table only gets numbers.
  const insights: Record<string, ProductInsight> = {}
  const insight = (id: string) =>
    (insights[id] ??= { variants: [], sold30: 0, revenue30: 0, lastSoldAt: null, ratingSum: 0, ratingCount: 0, pendingReviews: 0 })
  for (const v of stock.success ? stock.data : []) insight(v.product.id).variants.push(v)
  const since = Date.now() - 30 * DAY
  for (const o of orders.success ? orders.data : []) {
    if (NOT_SOLD.includes(o.status)) continue
    const placed = o.placedAt ?? o.createdAt
    for (const item of o.items) {
      if (!item.productId) continue
      const i = insight(item.productId)
      if (!i.lastSoldAt || placed > i.lastSoldAt) i.lastSoldAt = placed
      if (new Date(placed).getTime() < since) continue
      i.sold30 += item.quantity
      i.revenue30 += Number(item.totalAmount)
    }
  }
  for (const r of reviews.success ? reviews.data : []) {
    const i = insight(r.productId)
    if (r.status === "APPROVED") {
      i.ratingSum += r.rating
      i.ratingCount++
    }
    if (r.status === "PENDING") i.pendingReviews++
  }

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <PageHeader title="Products" description="Your catalog with live stock, sales from the last 30 days and customer ratings." />
      {res.success ? (
        <ProductsTable initialProducts={res.data} insights={insights} />
      ) : (
        <p className="px-4 text-muted-foreground lg:px-6">Couldn’t load products: {res.error}</p>
      )}
    </div>
  )
}
