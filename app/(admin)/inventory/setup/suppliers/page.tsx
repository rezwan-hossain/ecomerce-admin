import { connection } from "next/server"

import { DemoNote } from "@/components/inventory/inventory-ui"
import { Suppliers } from "@/components/inventory/setup"
import { PageHeader } from "@/components/page-header"
import { DEMO_PURCHASE_ORDERS, DEMO_SUPPLIERS } from "@/lib/inventory-demo"

export default async function SuppliersPage() {
  // Demo dates are relative to now, so render per request.
  await connection()

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <PageHeader title="Suppliers" description="Who you buy from, their terms and typical lead times." />
      <DemoNote what="suppliers" />
      <Suppliers initialSuppliers={DEMO_SUPPLIERS} purchaseOrders={DEMO_PURCHASE_ORDERS} />
    </div>
  )
}
