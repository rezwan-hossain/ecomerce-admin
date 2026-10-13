import { connection } from "next/server"

import { getAdjustments } from "@/app/actions/adjustment.actions"
import { getLocations, getStock } from "@/app/actions/inventory.actions"
import { getWarehouse } from "@/app/actions/warehouse.actions"
import { Adjustments } from "@/components/inventory/adjustments"
import { PageHeader } from "@/components/page-header"

export default async function AdjustmentsPage() {
  // Load fresh data on every request instead of once at build time.
  await connection()

  const [adjustments, warehouses, stock, locations] = await Promise.all([getAdjustments(), getWarehouse(), getStock(), getLocations()])

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <PageHeader title="Adjustments" description="Counts, write-offs and corrections. Each one is approved, then applied: stock only changes on apply." />
      {adjustments.success ? (
        <Adjustments
          initialAdjustments={adjustments.data}
          warehouses={warehouses.success ? warehouses.data.filter((w) => w.isActive) : []}
          stock={stock.success ? stock.data : []}
          locations={locations.success ? locations.data : []}
        />
      ) : (
        <p className="px-4 text-muted-foreground lg:px-6">Couldn’t load adjustments: {adjustments.error}</p>
      )}
    </div>
  )
}
