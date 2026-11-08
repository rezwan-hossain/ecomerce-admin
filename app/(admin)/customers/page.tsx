import { connection } from "next/server"

import { getListDetails, getOrders } from "@/app/actions/order.actions"
import { CustomersTable } from "@/components/customers/customers-table"
import { PageHeader } from "@/components/page-header"

export default async function CustomersPage() {
  await connection()

  // There's no customers API yet: customers are the people behind the orders.
  const res = await getOrders()
  const { addresses } = res.success ? await getListDetails(res.data.map((o) => o.id)) : { addresses: {} }

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <PageHeader title="Customers" description="Everyone who has ordered from your store, matched by phone or email." />
      {res.success ? (
        <CustomersTable orders={res.data} addresses={addresses} />
      ) : (
        <p className="px-4 text-muted-foreground lg:px-6">Couldn’t load customers: {res.error}</p>
      )}
    </div>
  )
}
