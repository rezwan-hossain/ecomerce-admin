import { connection } from "next/server"

import { getLocations } from "@/app/actions/inventory.actions"
import { LocationsManager } from "@/components/inventory/locations-manager"
import { PageHeader } from "@/components/page-header"

export default async function LocationsPage() {
  await connection()

  const res = await getLocations()

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <PageHeader title="Racks" description="Racks, shelves and bins in each warehouse, and how much stock they hold." />
      {res.success ? (
        <LocationsManager initialLocations={res.data} />
      ) : (
        <p className="px-4 text-muted-foreground lg:px-6">Couldn’t load racks: {res.error}</p>
      )}
    </div>
  )
}
