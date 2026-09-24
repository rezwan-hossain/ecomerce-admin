import { OrdersTable } from "@/components/orders/orders-table"
import { PageHeader } from "@/components/page-header"
import { orders } from "@/lib/demo-data"

export default function PendingOrdersPage() {
  const pending = orders.filter(
    (o) => o.status === "Pending" || o.status === "Processing"
  )

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <PageHeader
        title="Pending Orders"
        description="Orders waiting for payment or fulfilment. Ship paid orders straight from here."
      />
      <OrdersTable orders={pending} mode="pending" />
    </div>
  )
}
