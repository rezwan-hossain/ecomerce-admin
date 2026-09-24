import { AbandonedCartsTable } from "@/components/orders/abandoned-carts-table"
import { PageHeader } from "@/components/page-header"
import { StatCards } from "@/components/stat-cards"
import { abandonedCarts, currency } from "@/lib/demo-data"

export default function AbandonedCartsPage() {
  const value = abandonedCarts.reduce((sum, c) => sum + c.value, 0)

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <PageHeader
        title="Abandoned Carts"
        description="Shoppers who left before checking out. Send a reminder to win them back."
      />
      <StatCards
        stats={[
          { label: "Abandoned Carts", value: String(abandonedCarts.length), hint: "Last 7 days" },
          { label: "Potential Revenue", value: currency.format(value), hint: "Left in carts" },
          { label: "Reminders Sent", value: String(abandonedCarts.filter((c) => c.reminderSent).length), hint: "Recovery emails" },
          { label: "Recovery Rate", value: "14%", hint: "Carts converted after reminder" },
        ]}
      />
      <AbandonedCartsTable carts={abandonedCarts} />
    </div>
  )
}
