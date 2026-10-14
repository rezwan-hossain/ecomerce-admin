import { connection } from "next/server"

import { getDamagedStock } from "@/app/actions/damaged-stock.actions"
import { getWarehouse } from "@/app/actions/warehouse.actions"
import { DamagedStock } from "@/components/inventory/damaged-stock"
import { param } from "@/components/inventory/reports/format"
import { PageHeader } from "@/components/page-header"

export default async function DamagedPage({ searchParams }: PageProps<"/inventory/damaged">) {
  // Filters live in the URL, and damage can arrive any time, so render per request.
  await connection()
  const search = await searchParams
  const filters = {
    warehouseId: param(search, "warehouseId"),
    search: param(search, "search"),
    sortBy: param(search, "sortBy") || "lastDamagedAt",
    sortOrder: param(search, "sortOrder") || "desc",
  }

  const [damaged, warehouses] = await Promise.all([getDamagedStock({ ...filters, page: param(search, "page") || "1" }), getWarehouse()])

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <PageHeader
        title="Damaged stock"
        description="Damaged units go here automatically when stock is marked damaged, a batch is written off as damaged, a transfer arrives damaged, or a Damage adjustment is applied. They're not sellable."
      />
      {damaged.success ? (
        <DamagedStock list={damaged.data} filters={filters} warehouses={warehouses.success ? warehouses.data : []} />
      ) : (
        <p className="px-4 text-muted-foreground lg:px-6">Couldn’t load damaged stock: {damaged.error}</p>
      )}
    </div>
  )
}
