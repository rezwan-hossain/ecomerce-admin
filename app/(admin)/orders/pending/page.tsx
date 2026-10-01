import { connection } from "next/server"

import { getOrders } from "@/app/actions/order.actions"
import { OrdersTable } from "@/components/orders/orders-table"
import { PageHeader } from "@/components/page-header"

export default async function PendingOrdersPage() {
  await connection()

  const res = await getOrders()

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <PageHeader
        title="Pending Orders"
        description="Orders placed but not shipped yet: waiting for payment, confirmation or packing."
      />
      {res.success ? (
        <OrdersTable
          orders={res.data.filter((o) => ["PENDING", "CONFIRMED", "PROCESSING", "READY_TO_SHIP"].includes(o.status))}
          mode="pending"
        />
      ) : (
        <p className="px-4 text-muted-foreground lg:px-6">Couldn’t load orders: {res.error}</p>
      )}
    </div>
  )
}
