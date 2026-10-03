import { connection } from "next/server"

import { Adjustments } from "@/components/inventory/adjustments"
import { DemoNote } from "@/components/inventory/inventory-ui"
import { PageHeader } from "@/components/page-header"
import { DEMO_ADJUSTMENTS } from "@/lib/inventory-demo"

export default async function AdjustmentsPage() {
  // Demo dates are relative to now, so render per request.
  await connection()

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <PageHeader title="Adjustments" description="Counts, write-offs and corrections. Each one is approved before it changes stock." />
      <DemoNote what="adjustment approvals" live="One-off adjustments and counts from Stock levels are live." />
      <Adjustments initialAdjustments={DEMO_ADJUSTMENTS} />
    </div>
  )
}
