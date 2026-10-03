import { connection } from "next/server"

import { DemoNote } from "@/components/inventory/inventory-ui"
import { PurchaseOrders } from "@/components/inventory/purchase-orders"
import { PageHeader } from "@/components/page-header"
import { DEMO_PURCHASE_ORDERS, DEMO_SUPPLIERS } from "@/lib/inventory-demo"

export default async function PurchaseOrdersPage() {
  // Demo dates are relative to now, so render per request.
  await connection()

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <PageHeader
        title="Purchase orders"
        description="Inbound stock from suppliers. Submitting an order counts its units as incoming; receiving puts them on a rack."
      />
      <DemoNote what="purchase orders" />
      <PurchaseOrders initialOrders={DEMO_PURCHASE_ORDERS} suppliers={DEMO_SUPPLIERS} />
    </div>
  )
}
