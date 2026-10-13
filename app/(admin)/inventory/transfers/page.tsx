import { connection } from "next/server"

import { getLocations, getStock } from "@/app/actions/inventory.actions"
import { getTransfers } from "@/app/actions/transfer.actions"
import { getWarehouse } from "@/app/actions/warehouse.actions"
import { Transfers } from "@/components/inventory/transfers"
import { PageHeader } from "@/components/page-header"

export default async function TransfersPage() {
  // Load fresh data on every request instead of once at build time.
  await connection()

  const [transfers, warehouses, stock, locations] = await Promise.all([getTransfers(), getWarehouse(), getStock(), getLocations()])

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <PageHeader title="Transfers" description="Stock moving between warehouses. Shipping takes units off the source; they count as incoming at the destination until received." />
      {transfers.success ? (
        <Transfers
          initialTransfers={transfers.data}
          warehouses={warehouses.success ? warehouses.data.filter((w) => w.isActive) : []}
          stock={stock.success ? stock.data : []}
          locations={locations.success ? locations.data : []}
        />
      ) : (
        <p className="px-4 text-muted-foreground lg:px-6">Couldn’t load transfers: {transfers.error}</p>
      )}
    </div>
  )
}
