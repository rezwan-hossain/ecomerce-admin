import { connection } from "next/server"

import { getLocations, getStock } from "@/app/actions/inventory.actions"
import { MeterKey } from "@/components/inventory/inventory-ui"
import { StockManager } from "@/components/inventory/stock-manager"
import { PageHeader } from "@/components/page-header"

export default async function StockLevelsPage() {
  // Load fresh data on every request instead of once at build time.
  await connection()

  const [stock, locations] = await Promise.all([getStock(), getLocations()])

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <PageHeader
        title="Stock levels"
        description="Every variant across all warehouses. Pick a warehouse to see racks, costs and alert points."
      >
        <MeterKey />
      </PageHeader>
      {stock.success ? (
        <StockManager initialStock={stock.data} locations={locations.success ? locations.data : []} />
      ) : (
        <p className="px-4 text-muted-foreground lg:px-6">Couldn’t load stock: {stock.error}</p>
      )}
    </div>
  )
}
