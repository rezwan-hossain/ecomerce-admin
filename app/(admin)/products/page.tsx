import { connection } from "next/server"

import { getProducts } from "@/app/actions/product.actions"
import { PageHeader } from "@/components/page-header"
import { ProductsTable } from "@/components/products/products-table"

export default async function ProductsPage() {
  // Load fresh data on every request instead of once at build time.
  await connection()

  const res = await getProducts()

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <PageHeader title="Products" description="Manage your catalog, pricing and stock levels." />
      {res.success ? (
        <ProductsTable initialProducts={res.data} />
      ) : (
        <p className="px-4 text-muted-foreground lg:px-6">Couldn’t load products: {res.error}</p>
      )}
    </div>
  )
}
