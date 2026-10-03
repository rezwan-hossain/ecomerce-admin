import { connection } from "next/server"

import { getLocations } from "@/app/actions/inventory.actions"
import { DemoNote } from "@/components/inventory/inventory-ui"
import { Warehouses } from "@/components/inventory/setup"
import { PageHeader } from "@/components/page-header"
import { DEMO_WAREHOUSES } from "@/lib/inventory-demo"

export default async function WarehousesPage() {
  // Demo dates are relative to now, so render per request.
  await connection()

  const locations = await getLocations()

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <PageHeader title="Warehouses" description="Where stock lives. Higher-priority warehouses are reserved from first." />
      <DemoNote what="warehouses" live="The codes match your real warehouses, and their racks are live: add and edit them inside each warehouse." />
      <Warehouses initialWarehouses={DEMO_WAREHOUSES} initialLocations={locations.success ? locations.data : []} />
    </div>
  )
}
