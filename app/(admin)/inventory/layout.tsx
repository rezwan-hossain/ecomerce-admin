import { connection } from "next/server"

import { getAlertSummary } from "@/app/actions/inventory-alert.actions"
import { InventoryNav } from "@/components/inventory/inventory-nav"

export default async function InventoryLayout({ children }: LayoutProps<"/inventory">) {
  // The Alerts tab shows a live count of open alerts.
  await connection()
  const summary = await getAlertSummary()

  return (
    <>
      <InventoryNav openAlerts={summary.success ? summary.data.open : 0} />
      {children}
    </>
  )
}
