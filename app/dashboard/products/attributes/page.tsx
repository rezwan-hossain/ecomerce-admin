import { PageHeader } from "@/components/page-header"
import { AttributesManager } from "@/components/products/catalog-managers"
import { attributes } from "@/lib/demo-data"

export default function AttributesPage() {
  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <PageHeader
        title="Attributes"
        description="Define options such as size and color for product variants."
      />
      <AttributesManager initial={attributes} />
    </div>
  )
}
