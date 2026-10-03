import { connection } from "next/server"

import { DemoNote } from "@/components/inventory/inventory-ui"
import { ReorderRules } from "@/components/inventory/planning"
import { PageHeader } from "@/components/page-header"
import { DEMO_RULES, DEMO_SUPPLIERS } from "@/lib/inventory-demo"

export default async function RulesPage() {
  // Demo dates are relative to now, so render per request.
  await connection()

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <PageHeader title="Reorder rules" description="When available plus incoming stock drops to the reorder point, an alert is raised. With automatic ordering on, a line is added to a draft purchase order." />
      <DemoNote what="reorder rules" />
      <ReorderRules initialRules={DEMO_RULES} suppliers={DEMO_SUPPLIERS} />
    </div>
  )
}
