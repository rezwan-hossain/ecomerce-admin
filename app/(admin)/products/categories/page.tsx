import { PageHeader } from "@/components/page-header"
import { CategoriesManager } from "@/components/products/catalog-managers"
import { categories } from "@/lib/demo-data"

export default function CategoriesPage() {
  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <PageHeader
        title="Categories"
        description="Organize products into categories for easier browsing."
      />
      <CategoriesManager initial={categories} />
    </div>
  )
}
