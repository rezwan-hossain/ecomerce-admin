import { connection } from "next/server"

import { DemoNote } from "@/components/inventory/inventory-ui"
import { Transfers } from "@/components/inventory/transfers"
import { PageHeader } from "@/components/page-header"
import { DEMO_TRANSFERS } from "@/lib/inventory-demo"

export default async function TransfersPage() {
  // Demo dates are relative to now, so render per request.
  await connection()

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <PageHeader title="Transfers" description="Stock moving between warehouses. Shipping takes units off the source; they count as incoming at the destination until received." />
      <DemoNote what="transfers" />
      <Transfers initialTransfers={DEMO_TRANSFERS} />
    </div>
  )
}
