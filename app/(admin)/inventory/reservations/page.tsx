import { connection } from "next/server"

import { Reservations } from "@/components/inventory/batches-reservations"
import { DemoNote } from "@/components/inventory/inventory-ui"
import { PageHeader } from "@/components/page-header"
import { DEMO_RESERVATIONS } from "@/lib/inventory-demo"

export default async function ReservationsPage() {
  // Demo dates are relative to now, so render per request.
  await connection()

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <PageHeader title="Reservations" description="Stock held for orders between checkout and shipment. Holds expire if the order isn’t completed." />
      <DemoNote what="listing reservations" live="Each variant’s real holds show in its detail panel on Stock levels." />
      <Reservations initialReservations={DEMO_RESERVATIONS} />
    </div>
  )
}
