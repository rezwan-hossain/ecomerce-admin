import { connection } from "next/server"

import { getLocations, getStock } from "@/app/actions/inventory.actions"
import { getProducts } from "@/app/actions/product.actions"
import { MeterKey } from "@/components/inventory/inventory-ui"
import { ProductShelf } from "@/components/inventory/product-shelf"
import { PageHeader } from "@/components/page-header"

export default async function InventoryProductsPage() {
  // Load fresh data on every request instead of once at build time.
  await connection()

  const [products, stock, locations] = await Promise.all([getProducts(), getStock(), getLocations()])

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <PageHeader title="Products" description="Every product with how much of each variant you can sell right now.">
        <MeterKey />
      </PageHeader>
      {products.success && stock.success ? (
        <ProductShelf products={products.data} initialStock={stock.data} locations={locations.success ? locations.data : []} />
      ) : (
        <p className="px-4 text-muted-foreground lg:px-6">
          Couldn’t load products: {!products.success ? products.error : !stock.success && stock.error}
        </p>
      )}
    </div>
  )
}
