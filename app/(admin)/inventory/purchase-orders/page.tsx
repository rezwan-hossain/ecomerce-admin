import { connection } from "next/server"

import { getLocations, getStock } from "@/app/actions/inventory.actions"
import { getPurchaseOrders } from "@/app/actions/purchase-order.actions"
import { getSuppliers } from "@/app/actions/supplier.actions"
import { getWarehouse } from "@/app/actions/warehouse.actions"
import { PurchaseOrders } from "@/components/inventory/purchase-orders"
import { PageHeader } from "@/components/page-header"

export default async function PurchaseOrdersPage() {
  // Load fresh data on every request instead of once at build time.
  await connection()

  const [orders, suppliers, warehouses, stock, locations] = await Promise.all([
    getPurchaseOrders(),
    getSuppliers(),
    getWarehouse(),
    getStock(),
    getLocations(),
  ])

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <PageHeader
        title="Purchase orders"
        description="Inbound stock from suppliers. Submitting an order counts its units as incoming; receiving puts them on a rack."
      />
      {orders.success ? (
        <PurchaseOrders
          initialOrders={orders.data}
          suppliers={suppliers.success ? suppliers.data : []}
          warehouses={warehouses.success ? warehouses.data.filter((w) => w.isActive) : []}
          // Every SKU, for the line picker: "Product, Red / XL".
          variants={(stock.success ? stock.data : []).map((v) => ({
            id: v.variantId,
            sku: v.sku,
            label: v.name !== v.sku ? `${v.product.name}, ${v.name}` : v.product.name,
          }))}
          locations={locations.success ? locations.data : []}
        />
      ) : (
        <p className="px-4 text-muted-foreground lg:px-6">Couldn’t load purchase orders: {orders.error}</p>
      )}
    </div>
  )
}
