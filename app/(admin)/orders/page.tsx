import { OrdersTable } from "@/components/orders/orders-table"
import { PageHeader } from "@/components/page-header"
import { StatCards } from "@/components/stat-cards"
import { currency, orders } from "@/lib/demo-data"

export default function OrdersPage() {
  const revenue = orders
    .filter((o) => o.payment === "Paid")
    .reduce((sum, o) => sum + Number(o.total), 0)
  const unfulfilled = orders.filter(
    (o) => o.status === "Pending" || o.status === "Processing"
  ).length
  const delivered = orders.filter((o) => o.status === "Delivered").length

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <PageHeader
        title="Orders"
        description="Track, fulfil and manage every order in your store."
      />
      <StatCards
        stats={[
          { label: "Total Orders", value: String(orders.length), hint: "Last 30 days" },
          { label: "Revenue", value: currency.format(revenue), hint: "From paid orders" },
          { label: "Unfulfilled", value: String(unfulfilled), hint: "Pending or processing" },
          { label: "Delivered", value: String(delivered), hint: "Successfully completed" },
        ]}
      />
      <OrdersTable orders={orders} />
    </div>
  )
}
