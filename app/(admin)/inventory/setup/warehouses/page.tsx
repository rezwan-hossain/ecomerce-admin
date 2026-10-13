import { connection } from "next/server"

import { getLocations } from "@/app/actions/inventory.actions"
import { getWarehouse } from "@/app/actions/warehouse.actions"
import { Warehouses } from "@/components/inventory/setup"
import { PageHeader } from "@/components/page-header"

export default async function WarehousesPage() {
  // Load fresh data on every request instead of once at build time.
  await connection()

  const [warehouses, locations] = await Promise.all([getWarehouse(), getLocations()])

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <PageHeader title="Warehouses" description="Where stock lives. Higher-priority warehouses are reserved from first." />
      {warehouses.success ? (
        <Warehouses initialWarehouses={warehouses.data} initialLocations={locations.success ? locations.data : []} />
      ) : (
        <p className="px-4 text-muted-foreground lg:px-6">Couldn’t load warehouses: {warehouses.error}</p>
      )}
    </div>
  )
}
