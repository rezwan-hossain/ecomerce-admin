import { connection } from "next/server"

import { getBatches } from "@/app/actions/batch.actions"
import { getWarehouse } from "@/app/actions/warehouse.actions"
import { Batches } from "@/components/inventory/batches"
import { param } from "@/components/inventory/reports/format"
import { PageHeader } from "@/components/page-header"

export default async function BatchesPage({ searchParams }: PageProps<"/inventory/batches">) {
  // Filters live in the URL, and stock changes all the time, so render per request.
  await connection()
  const search = await searchParams
  const filters = {
    search: param(search, "search"),
    warehouseId: param(search, "warehouseId"),
    status: param(search, "status"),
    expiry: param(search, "expiry"),
    inStock: param(search, "inStock"),
    sortBy: param(search, "sortBy") || "expiresAt",
    sortOrder: param(search, "sortOrder") || "asc",
  }

  // The summary counts ask for one row each and read the totals.
  const [batches, warehouses, expiring, expired, quarantined] = await Promise.all([
    getBatches({ ...filters, page: param(search, "page") || "1" }),
    getWarehouse(),
    getBatches({ expiry: "EXPIRING", inStock: "true", limit: "1" }),
    getBatches({ expiry: "EXPIRED", inStock: "true", limit: "1" }),
    getBatches({ status: "QUARANTINED", inStock: "true", limit: "1" }),
  ])

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <PageHeader title="Batches" description="Lots with their expiry dates. Sales and transfers take the batch that expires first; expired ones wait for a write-off." />
      {batches.success ? (
        <Batches
          batches={batches.data.data}
          meta={batches.data.meta}
          filters={filters}
          warehouses={warehouses.success ? warehouses.data : []}
          summary={{
            expiring: expiring.success ? expiring.data.meta.total : 0,
            expired: expired.success ? expired.data.meta.total : 0,
            quarantined: quarantined.success ? quarantined.data.meta.total : 0,
          }}
        />
      ) : (
        <p className="px-4 text-muted-foreground lg:px-6">Couldn’t load batches: {batches.error}</p>
      )}
    </div>
  )
}
