import { connection } from "next/server"

import { getProducts } from "@/app/actions/product.actions"
import { TrafficReport } from "@/components/analytics/traffic-report"
import { PageHeader } from "@/components/page-header"
import { trafficDays } from "@/lib/traffic-demo"

export default async function TrafficPage() {
  await connection()

  const products = await getProducts()
  const catalog = (products.success ? products.data : [])
    .filter((p) => p.status === "ACTIVE")
    .map((p) => ({
      id: p.id,
      name: p.name,
      image: (p.images.find((i) => i.isPrimary) ?? p.images[0])?.url,
      category: (p.categories.find((c) => c.isPrimary) ?? p.categories[0])?.category.name ?? null,
    }))

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <PageHeader title="Traffic" description="Who visits the store, where they come from, and how many of them buy." />
      <TrafficReport days={trafficDays()} products={catalog} />
    </div>
  )
}
