import { connection } from "next/server"

import { getOrders } from "@/app/actions/order.actions"
import { OrdersTable } from "@/components/orders/orders-table"
import { PageHeader } from "@/components/page-header"

export default async function OrdersPage() {
  // Load fresh data on every request instead of once at build time.
  await connection()

  const res = await getOrders()

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <PageHeader title="Orders" description="Track, fulfil and manage every order in your store." />
      {res.success ? (
        <OrdersTable orders={res.data} />
      ) : (
        <p className="px-4 text-muted-foreground lg:px-6">Couldn’t load orders: {res.error}</p>
      )}
    </div>
  )
}
