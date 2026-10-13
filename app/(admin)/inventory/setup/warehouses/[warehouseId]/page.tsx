import { notFound } from "next/navigation"
import { connection } from "next/server"

import { getLocations, getStock, getWarehouseMovements } from "@/app/actions/inventory.actions"
import { getFloorPlan, getPutAway } from "@/app/actions/rack-map.actions"
import { getWarehouseById } from "@/app/actions/warehouse.actions"
import { WarehouseDetail } from "@/components/inventory/warehouse-detail"

export default async function WarehousePage({ params }: PageProps<"/inventory/setup/warehouses/[warehouseId]">) {
  await connection()
  const { warehouseId } = await params

  const [warehouse, plan, locations, stock, movements, putAway] = await Promise.all([
    getWarehouseById(warehouseId),
    getFloorPlan(warehouseId),
    getLocations(),
    getStock(),
    // Enough to sum the last 30 days on a normal day; the table shows the newest few.
    getWarehouseMovements(warehouseId, 100),
    getPutAway(warehouseId),
  ])
  if (!warehouse.success) notFound()

  // Each variant's stock in this warehouse only, with the variant's low-stock alert.
  const levels = (stock.success ? stock.data : []).flatMap((v) => {
    const level = v.levels.find((l) => l.warehouseId === warehouseId)
    return level ? [{ variant: v, level }] : []
  })

  return (
    <WarehouseDetail
      warehouse={warehouse.data}
      totals={plan.success ? plan.data.totals : null}
      racks={(locations.success ? locations.data : []).filter((l) => l.warehouse.id === warehouseId)}
      levels={levels}
      movements={movements.success ? movements.data : []}
      putAway={putAway.success ? putAway.data : []}
    />
  )
}
