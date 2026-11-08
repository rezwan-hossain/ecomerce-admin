import { connection } from "next/server"

import { getAlertSummary } from "@/app/actions/inventory-alert.actions"
import { getStock } from "@/app/actions/inventory.actions"
import { getOrders } from "@/app/actions/order.actions"
import { getProducts } from "@/app/actions/product.actions"
import { getReviews } from "@/app/actions/review.actions"
import { buildSalesData } from "@/components/analytics/analytics-utils"
import { Dashboard } from "@/components/dashboard/dashboard"

export default async function DashboardPage() {
  await connection()

  const [orders, products, stock, reviews, alerts] = await Promise.all([getOrders(), getProducts(), getStock(), getReviews(), getAlertSummary()])
  if (!orders.success) return <p className="px-4 py-6 text-muted-foreground lg:px-6">Couldn’t load orders: {orders.error}</p>

  const productList = products.success ? products.data : []
  const stockList = stock.success ? stock.data : []

  return (
    <Dashboard
      sales={buildSalesData(orders.data, productList, stockList)}
      orders={orders.data}
      stock={stockList}
      reviews={reviews.success ? reviews.data : []}
      openAlerts={alerts.success ? alerts.data.open : 0}
    />
  )
}
