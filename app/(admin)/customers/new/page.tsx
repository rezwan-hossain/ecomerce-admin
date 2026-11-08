import { connection } from "next/server"

import { getOrders } from "@/app/actions/order.actions"
import { CustomerForm } from "@/components/customers/customer-form"
import { PageHeader } from "@/components/page-header"

export default async function NewCustomerPage() {
  await connection()

  // Lets the form warn when the phone or email already belongs to someone who has ordered.
  const res = await getOrders()

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <PageHeader title="Add customer" description="Create a customer account, for phone orders or someone who shops in person." />
      <CustomerForm orders={res.success ? res.data : []} />
    </div>
  )
}
