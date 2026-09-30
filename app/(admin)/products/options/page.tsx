import { connection } from "next/server"

import { getOptions } from "@/app/actions/option.actions"
import { OptionsManager } from "@/components/options/options-manager"

export default async function OptionsPage() {
  // Load fresh data on every request instead of once at build time.
  await connection()

  const res = await getOptions()

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <OptionsManager initialOptions={res.success ? res.data : []} />
    </div>
  )
}
