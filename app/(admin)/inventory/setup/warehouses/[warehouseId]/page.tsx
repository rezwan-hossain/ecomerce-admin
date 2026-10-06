import { connection } from "next/server"
import { notFound } from "next/navigation"

import { getLocations } from "@/app/actions/inventory.actions"
import { getFloorPlan, getPutAway } from "@/app/actions/rack-map.actions"
import { RackMap } from "@/components/inventory/rack-map/rack-map"
import type { Mode } from "@/components/inventory/rack-map/rack-panels"
import { DEMO_WAREHOUSES } from "@/lib/inventory-demo"

const MODES: Mode[] = ["units", "value", "activity", "route"]

export default async function WarehouseMapPage({ params, searchParams }: PageProps<"/inventory/setup/warehouses/[warehouseId]">) {
  await connection()
  const { warehouseId } = await params
  const search = await searchParams
  const one = (key: string) => (typeof search[key] === "string" ? (search[key] as string) : null)

  const [plan, putAway, locations] = await Promise.all([getFloorPlan(warehouseId), getPutAway(warehouseId), getLocations()])
  if (!plan.success) notFound()

  // There's no warehouses endpoint: every warehouse has racks (at least UNASSIGNED), so the tabs come from them.
  const seen = new Map<string, { id: string; code: string; name: string }>()
  for (const l of locations.success ? locations.data : []) {
    const name = DEMO_WAREHOUSES.find((w) => w.code === l.warehouse.code)?.name ?? ""
    seen.set(l.warehouse.id, { id: l.warehouse.id, code: l.warehouse.code, name })
  }
  const mode = one("mode") as Mode

  return (
    <RackMap
      key={warehouseId}
      initialPlan={plan.data}
      initialPutAway={putAway.success ? putAway.data : []}
      warehouses={[...seen.values()].sort((a, b) => a.code.localeCompare(b.code))}
      initial={{ mode: MODES.includes(mode) ? mode : "units", rack: one("rack"), bin: one("bin"), q: one("q") ?? "", edit: one("edit") === "1" }}
    />
  )
}
