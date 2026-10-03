import { connection } from "next/server"

import { DemoNote } from "@/components/inventory/inventory-ui"
import { Alerts } from "@/components/inventory/planning"
import { PageHeader } from "@/components/page-header"
import { DEMO_ALERTS } from "@/lib/inventory-demo"

export default async function AlertsPage() {
  // Demo dates are relative to now, so render per request.
  await connection()

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <PageHeader title="Alerts" description="Raised by the stock sweep after every change. An alert resolves itself once the condition clears." />
      <DemoNote what="alerts" />
      <Alerts initialAlerts={DEMO_ALERTS} />
    </div>
  )
}
