import { CategoriesManager } from "@/components/categories/categories-manager"
import { categories, productCategoryLinks } from "@/lib/demo-data"

export default function CategoriesPage() {
  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <CategoriesManager
        initialCategories={categories}
        initialLinks={productCategoryLinks}
      />
    </div>
  )
}
