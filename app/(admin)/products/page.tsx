import { PageHeader } from "@/components/page-header"
import { ProductsTable } from "@/components/products/products-table"
import { StatCards } from "@/components/stat-cards"
import { currency, products } from "@/lib/demo-data"

export default function ProductsPage() {
  const inventoryValue = products.reduce((sum, p) => sum + p.price * p.stock, 0)

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <PageHeader
        title="Products"
        description="Manage your catalog, pricing and stock levels."
      />
      <StatCards
        stats={[
          { label: "Total Products", value: String(products.length), hint: "Across all categories" },
          { label: "Active", value: String(products.filter((p) => p.status === "Active").length), hint: "Visible in the store" },
          { label: "Low / Out of Stock", value: String(products.filter((p) => p.stock < 10).length), hint: "Need restocking" },
          { label: "Inventory Value", value: currency.format(inventoryValue), hint: "At retail price" },
        ]}
      />
      <ProductsTable products={products} />
    </div>
  )
}
