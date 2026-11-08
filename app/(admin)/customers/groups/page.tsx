import { connection } from "next/server"

import { getListDetails, getOrders } from "@/app/actions/order.actions"
import { CustomerGroups } from "@/components/customers/customer-groups"
import { PageHeader } from "@/components/page-header"

export default async function CustomerGroupsPage() {
  await connection()

  const res = await getOrders()
  const { addresses } = res.success ? await getListDetails(res.data.map((o) => o.id)) : { addresses: {} }

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <PageHeader title="Customer groups" description="Sort customers by rules: how much they spend, how often they order, where they live." />
      {res.success ? (
        <CustomerGroups orders={res.data} addresses={addresses} />
      ) : (
        <p className="px-4 text-muted-foreground lg:px-6">Couldn’t load customers: {res.error}</p>
      )}
    </div>
  )
}
