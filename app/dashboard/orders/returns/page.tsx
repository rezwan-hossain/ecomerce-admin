import { ReturnsTable } from "@/components/orders/returns-table"
import { PageHeader } from "@/components/page-header"
import { StatCards } from "@/components/stat-cards"
import { currency, returns } from "@/lib/demo-data"

export default function ReturnsPage() {
  const refunded = returns
    .filter((r) => r.status === "Refunded")
    .reduce((sum, r) => sum + r.amount, 0)

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <PageHeader
        title="Returns & Refunds"
        description="Review return requests and issue refunds."
      />
      <StatCards
        stats={[
          { label: "Open Requests", value: String(returns.filter((r) => r.status === "Requested").length), hint: "Waiting for review" },
          { label: "Approved", value: String(returns.filter((r) => r.status === "Approved").length), hint: "Awaiting refund" },
          { label: "Refunded", value: currency.format(refunded), hint: "Returned to customers" },
          { label: "Return Rate", value: "2.1%", hint: "Of orders this month" },
        ]}
      />
      <ReturnsTable returns={returns} />
    </div>
  )
}
