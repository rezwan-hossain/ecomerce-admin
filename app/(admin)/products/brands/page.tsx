import { BrandsManager } from "@/components/brands/brands-manager"
import { brands } from "@/lib/demo-data"

export default function BrandsPage() {
  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <BrandsManager initial={brands} />
    </div>
  )
}
