import Link from "next/link"
import { DownloadIcon, PlusIcon } from "lucide-react"

import { ChartAreaInteractive } from "@/components/chart-area-interactive"
import { SalesByCategory, TopProducts } from "@/components/dashboard-insights"
import { DataTable } from "@/components/data-table"
import { SectionCards } from "@/components/section-cards"
import { Button } from "@/components/ui/button"
import { getProductByName, orders } from "@/lib/demo-data"

import data from "@/lib/data/orders.json"

const paidOrders = orders.filter((o) => o.payment === "Paid")

function salesByCategory() {
  const totals = new Map<string, number>()
  for (const o of paidOrders) {
    totals.set(o.category, (totals.get(o.category) ?? 0) + Number(o.total))
  }
  return [...totals]
    .map(([category, revenue]) => ({ category, revenue }))
    .sort((a, b) => b.revenue - a.revenue)
}

function topProducts() {
  const totals = new Map<string, { units: number; revenue: number }>()
  for (const o of paidOrders) {
    const current = totals.get(o.product) ?? { units: 0, revenue: 0 }
    current.units += Number(o.quantity)
    current.revenue += Number(o.total)
    totals.set(o.product, current)
  }
  return [...totals]
    .map(([name, t]) => {
      const product = getProductByName(name)
      return {
        id: product?.id ?? name,
        name,
        category: product?.category ?? "",
        ...t,
      }
    })
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5)
}

export default function Page() {
  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="flex flex-col gap-4 px-4 sm:flex-row sm:items-end sm:justify-between lg:px-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Welcome back, Store Admin
          </h1>
          <p className="text-sm text-muted-foreground">
            Here&apos;s what&apos;s happening with your store today.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <DownloadIcon data-icon="inline-start" />
            Download report
          </Button>
          <Button
            size="sm"
            nativeButton={false}
            render={<Link href="/products/new" />}
          >
            <PlusIcon data-icon="inline-start" />
            Add product
          </Button>
        </div>
      </div>
      <SectionCards />
      <div className="px-4 lg:px-6">
        <ChartAreaInteractive />
      </div>
      <div className="grid gap-4 px-4 lg:px-6 @4xl/main:grid-cols-2">
        <SalesByCategory data={salesByCategory()} />
        <TopProducts data={topProducts()} />
      </div>
      <DataTable data={data} />
    </div>
  )
}
