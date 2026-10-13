import { connection } from "next/server"

import { getAlerts, getAlertSummary } from "@/app/actions/inventory-alert.actions"
import { Alerts } from "@/components/inventory/alerts"
import { PageHeader } from "@/components/page-header"

export default async function AlertsPage() {
  // Load fresh data on every request instead of once at build time.
  await connection()

  const [alerts, summary] = await Promise.all([getAlerts("OPEN"), getAlertSummary()])

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <PageHeader title="Alerts" description="Raised and cleared by the server after every stock change. Acknowledge what you're handling; the rest resolves itself." />
      {alerts.success ? (
        <Alerts initialAlerts={alerts.data} initialSummary={summary.success ? summary.data : null} />
      ) : (
        <p className="px-4 text-muted-foreground lg:px-6">Couldn’t load alerts: {alerts.error}</p>
      )}
    </div>
  )
}
