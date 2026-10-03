import { InventoryNav } from "@/components/inventory/inventory-nav"

export default function InventoryLayout({ children }: LayoutProps<"/inventory">) {
  return (
    <>
      <InventoryNav />
      {children}
    </>
  )
}
