import { ReportTabs } from "@/components/inventory/reports/report-bits"
import { PageHeader } from "@/components/page-header"

export default function ReportsLayout({ children }: LayoutProps<"/inventory/reports">) {
  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <PageHeader title="Reports" description="Read-only views of stock value, slow sellers, turnover and each SKU's history. Nothing here changes stock." />
      <ReportTabs />
      {children}
    </div>
  )
}
