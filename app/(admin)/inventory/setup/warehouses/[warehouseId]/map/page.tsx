import { connection } from "next/server"
import { notFound } from "next/navigation"

import { getFloorPlan, getPutAway } from "@/app/actions/rack-map.actions"
import { getWarehouse } from "@/app/actions/warehouse.actions"
import { RackMap } from "@/components/inventory/rack-map/rack-map"
import type { Mode } from "@/components/inventory/rack-map/rack-panels"

const MODES: Mode[] = ["units", "value", "activity", "route"]

export default async function WarehouseMapPage({ params, searchParams }: PageProps<"/inventory/setup/warehouses/[warehouseId]/map">) {
  await connection()
  const { warehouseId } = await params
  const search = await searchParams
  const one = (key: string) => (typeof search[key] === "string" ? (search[key] as string) : null)

  const [plan, putAway, warehouses] = await Promise.all([getFloorPlan(warehouseId), getPutAway(warehouseId), getWarehouse()])
  if (!plan.success) notFound()

  const mode = one("mode") as Mode

  return (
    <RackMap
      key={warehouseId}
      initialPlan={plan.data}
      initialPutAway={putAway.success ? putAway.data : []}
      warehouses={warehouses.success ? warehouses.data.map((w) => ({ id: w.id, code: w.code, name: w.name, type: w.type, isActive: w.isActive })) : []}
      initial={{ mode: MODES.includes(mode) ? mode : "units", rack: one("rack"), bin: one("bin"), q: one("q") ?? "", edit: one("edit") === "1" }}
    />
  )
}
