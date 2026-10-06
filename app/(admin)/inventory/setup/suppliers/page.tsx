import { connection } from "next/server"

import { getSuppliers } from "@/app/actions/supplier.actions"
import { Suppliers } from "@/components/inventory/setup"
import { PageHeader } from "@/components/page-header"

export default async function SuppliersPage() {
  // Load fresh data on every request instead of once at build time.
  await connection()
  const suppliers = await getSuppliers()

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <PageHeader title="Suppliers" description="Who you buy from, their terms and typical lead times." />
      {suppliers.success ? (
        <Suppliers initialSuppliers={suppliers.data} />
      ) : (
        <p className="mx-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive lg:mx-6">
          Couldn’t load suppliers: {suppliers.error}
        </p>
      )}
    </div>
  )
}
