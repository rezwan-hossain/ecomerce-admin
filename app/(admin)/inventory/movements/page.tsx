import { connection } from "next/server"

import { getMovements } from "@/app/actions/inventory.actions"
import { MovementsTable } from "@/components/inventory/movements-table"
import { PageHeader } from "@/components/page-header"

export default async function MovementsPage() {
  await connection()

  const res = await getMovements()

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <PageHeader
        title="Stock movements"
        description="Every stock change, newest first. Entries can't be edited; a mistake is fixed with a new adjustment."
      />
      {res.success ? (
        <MovementsTable movements={res.data} limited={res.data.length >= 500} />
      ) : (
        <p className="px-4 text-muted-foreground lg:px-6">Couldn’t load movements: {res.error}</p>
      )}
    </div>
  )
}
