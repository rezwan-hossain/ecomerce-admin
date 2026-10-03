import { connection } from "next/server"

import { getInventorySummary, getLocations, getRecentMovements, getStock } from "@/app/actions/inventory.actions"
import { InventoryOverview } from "@/components/inventory/inventory-overview"
import { PageHeader } from "@/components/page-header"
import { DEMO_ADJUSTMENTS, DEMO_PURCHASE_ORDERS, DEMO_SUPPLIERS, DEMO_TRANSFERS } from "@/lib/inventory-demo"

export default async function InventoryOverviewPage() {
  // Load fresh data on every request instead of once at build time.
  await connection()

  const [summary, stock, movements, locations] = await Promise.all([
    getInventorySummary(),
    getStock(),
    getRecentMovements(8),
    getLocations(),
  ])

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <PageHeader title="Overview" description="What’s on the shelves, what’s moving and what needs a decision today." />
      {summary.success && stock.success ? (
        <InventoryOverview
          summary={summary.data}
          stock={stock.data}
          movements={movements.success ? movements.data : []}
          locations={locations.success ? locations.data : []}
          demo={{
            purchaseOrders: DEMO_PURCHASE_ORDERS,
            transfers: DEMO_TRANSFERS,
            adjustments: DEMO_ADJUSTMENTS,
            supplierNames: Object.fromEntries(DEMO_SUPPLIERS.map((s) => [s.id, s.name])),
          }}
        />
      ) : (
        <p className="px-4 text-muted-foreground lg:px-6">
          Couldn’t load inventory: {!summary.success ? summary.error : !stock.success && stock.error}
        </p>
      )}
    </div>
  )
}
