import { connection } from "next/server"

import { Batches } from "@/components/inventory/batches-reservations"
import { DemoNote } from "@/components/inventory/inventory-ui"
import { PageHeader } from "@/components/page-header"
import { DEMO_BATCHES, DEMO_SUPPLIERS } from "@/lib/inventory-demo"

export default async function BatchesPage() {
  // Demo dates are relative to now, so render per request.
  await connection()

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <PageHeader title="Batches" description="Lot tracking for products that need it. Sales and transfers use the batch that expires first." />
      <DemoNote what="batches" />
      <Batches initialBatches={DEMO_BATCHES} suppliers={DEMO_SUPPLIERS} />
    </div>
  )
}
