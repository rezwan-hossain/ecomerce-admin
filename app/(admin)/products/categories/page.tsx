import { connection } from "next/server"

import { getCategoryTree } from "@/app/actions/category.actions"
import { CategoriesManager } from "@/components/categories/categories-manager"

export default async function CategoriesPage() {
  // Load fresh data on every request instead of once at build time.
  await connection()

  const res = await getCategoryTree()

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <CategoriesManager initialTree={res.success ? res.data : []} />
    </div>
  )
}
