"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  ArrowLeftRightIcon,
  BarcodeIcon,
  BellIcon,
  ChartColumnIcon,
  ClipboardListIcon,
  LayersIcon,
  LayoutDashboardIcon,
  ListIcon,
  LockIcon,
  PackageIcon,
  PackageXIcon,
  RepeatIcon,
  ShoppingCartIcon,
  TruckIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"

const GROUPS = [
  {
    title: "Stock",
    links: [
      { href: "/inventory", text: "Overview", icon: LayoutDashboardIcon },
      { href: "/inventory/products", text: "Products", icon: PackageIcon },
      { href: "/inventory/stock", text: "Stock levels", icon: LayersIcon },
      { href: "/inventory/movements", text: "Movements", icon: ListIcon },
      { href: "/inventory/batches", text: "Batches", icon: BarcodeIcon },
      { href: "/inventory/damaged", text: "Damaged", icon: PackageXIcon },
    ],
  },
  {
    title: "Operations",
    links: [
      { href: "/inventory/purchase-orders", text: "Purchase orders", icon: ShoppingCartIcon },
      { href: "/inventory/transfers", text: "Transfers", icon: TruckIcon },
      { href: "/inventory/adjustments", text: "Adjustments", icon: ClipboardListIcon },
      { href: "/inventory/reservations", text: "Reservations", icon: LockIcon },
    ],
  },
  {
    title: "Planning",
    links: [
      { href: "/inventory/alerts", text: "Alerts", icon: BellIcon },
      { href: "/inventory/rules", text: "Reorder rules", icon: RepeatIcon },
      { href: "/inventory/reports/stock-value", text: "Reports", icon: ChartColumnIcon },
    ],
  },
]

// The inventory section's own tabs: one segmented rail per group, the current page raised.
export function InventoryNav({ openAlerts }: { openAlerts: number }) {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Inventory"
      className="sticky top-0 z-10 overflow-x-auto border-b bg-background/85 px-4 py-2 backdrop-blur supports-backdrop-filter:bg-background/70 lg:px-6"
    >
      <div className="flex min-w-max items-center gap-1.5">
        {GROUPS.map((group) => (
          <div key={group.title} role="group" aria-label={group.title} title={group.title} className="flex items-center gap-0.5 rounded-lg bg-muted p-0.5">
            {group.links.map(({ href, text, icon: Icon }) => {
              // Every report page lights up the one Reports tab.
              const active = pathname === href || (href.startsWith("/inventory/reports") && pathname.startsWith("/inventory/reports"))
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-7 items-center gap-1 rounded-md px-1.5 text-[12.5px] font-medium whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
                    active && "bg-background text-foreground shadow-xs ring-1 ring-foreground/5 dark:bg-input/40"
                  )}
                >
                  <Icon className={cn("size-3.5 shrink-0", active ? "text-primary" : "opacity-70")} />
                  {text}
                  {href === "/inventory/alerts" && openAlerts > 0 && (
                    <span className="ml-0.5 rounded-full bg-amber-500 px-1.5 text-[10.5px] leading-4 font-bold text-white tabular-nums">{openAlerts}</span>
                  )}
                </Link>
              )
            })}
          </div>
        ))}
      </div>
    </nav>
  )
}
