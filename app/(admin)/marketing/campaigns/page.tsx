import { connection } from "next/server"

import { loadMarketing } from "@/app/actions/marketing.actions"
import { MarketingWorkspace } from "@/components/marketing/marketing-workspace"

export default async function CampaignsPage() {
  // Load fresh data on every request instead of once at build time.
  await connection()

  const res = await loadMarketing()
  if (!res.success) {
    return <p className="p-6 text-muted-foreground">Couldn’t load marketing data: {res.error}</p>
  }

  return <MarketingWorkspace view="campaigns" initialData={res.data} now={Date.now()} />
}
