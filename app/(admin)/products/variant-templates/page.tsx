import { connection } from "next/server"

import { getOptions } from "@/app/actions/option.actions"
import { getVariantTemplates } from "@/app/actions/variant-template.actions"
import { VariantTemplatesManager } from "@/components/variant-templates/variant-templates-manager"

export default async function VariantTemplatesPage() {
  // Load fresh data on every request instead of once at build time.
  await connection()

  // The form needs every option and its values to pick from.
  const [templatesRes, optionsRes] = await Promise.all([getVariantTemplates(), getOptions()])

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <VariantTemplatesManager
        initialTemplates={templatesRes.success ? templatesRes.data : []}
        options={optionsRes.success ? optionsRes.data : []}
      />
    </div>
  )
}
