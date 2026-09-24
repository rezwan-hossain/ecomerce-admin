import { PageHeader } from "@/components/page-header"
import { BrandsManager } from "@/components/products/catalog-managers"
import { brands } from "@/lib/demo-data"

export default function BrandsPage() {
  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <PageHeader
        title="Brands"
        description="Manage the brands your products are sold under."
      />
      <BrandsManager initial={brands} />
    </div>
  )
}
