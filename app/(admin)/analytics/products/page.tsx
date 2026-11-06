import { connection } from "next/server"

import { getStock } from "@/app/actions/inventory.actions"
import { getOrders } from "@/app/actions/order.actions"
import { getProducts } from "@/app/actions/product.actions"
import { buildSalesData } from "@/components/analytics/analytics-utils"
import { TopProducts } from "@/components/analytics/top-products"
import { PageHeader } from "@/components/page-header"

export default async function TopProductsPage() {
  await connection()

  const [orders, products, stock] = await Promise.all([getOrders(), getProducts(), getStock()])
  if (!orders.success) return <p className="px-4 py-6 text-muted-foreground lg:px-6">Couldn’t load orders: {orders.error}</p>

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <PageHeader title="Top products" description="Your best sellers and slow movers, with profit and how long the stock will last." />
      <TopProducts data={buildSalesData(orders.data, products.success ? products.data : [], stock.success ? stock.data : [])} />
    </div>
  )
}
