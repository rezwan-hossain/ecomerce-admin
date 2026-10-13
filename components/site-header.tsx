"use client"

import { Fragment } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"

const labels: Record<string, string> = {
  dashboard: "Dashboard",
  orders: "Orders",
  pending: "Pending",
  returns: "Returns & Refunds",
  abandoned: "Abandoned Carts",
  products: "Products",
  new: "New product",
  edit: "Edit",
  categories: "Categories",
  brands: "Brands",
  tags: "Tags",
  options: "Options",
  "variant-templates": "Variant Templates",
  marketing: "Marketing",
  inventory: "Inventory",
  movements: "Movements",
  setup: "Setup",
  racks: "Racks",
  stock: "Stock levels",
  batches: "Batches",
  "purchase-orders": "Purchase orders",
  transfers: "Transfers",
  adjustments: "Adjustments",
  reservations: "Reservations",
  alerts: "Alerts",
  rules: "Reorder rules",
  warehouses: "Warehouses",
  map: "Rack map",
  shipping: "Shipping",
  reports: "Reports",
  "stock-value": "Stock value",
  "slow-moving": "Slow-moving & dead",
  turnover: "Turnover",
  history: "SKU stock history",
  suppliers: "Suppliers",
  planner: "Planner",
  campaigns: "Campaigns",
  promotions: "Promotions",
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// "3209" -> "#3209", "wireless-headphones" -> "Wireless Headphones"
function formatId(segment: string) {
  if (/^\d+$/.test(segment)) return `#${segment}`
  return segment.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

export function SiteHeader() {
  const pathname = usePathname()
  const segments = pathname.split("/").filter(Boolean)
  const crumbs = segments
    .map((segment, index) => ({
      segment,
      href: "/" + segments.slice(0, index + 1).join("/"),
      label: labels[segment] ?? formatId(decodeURIComponent(segment)),
    }))
    // Database UUIDs mean nothing to a reader: "/products/<uuid>/edit" reads "Products › Edit".
    .filter((crumb) => !UUID.test(crumb.segment))

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 h-4 data-vertical:self-auto"
        />
        <Breadcrumb>
          <BreadcrumbList>
            {crumbs.map((crumb, index) => (
              <Fragment key={crumb.href}>
                {index > 0 && <BreadcrumbSeparator />}
                <BreadcrumbItem>
                  {index === crumbs.length - 1 ? (
                    <BreadcrumbPage className="font-medium">
                      {crumb.label}
                    </BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink render={<Link href={crumb.href} />}>
                      {crumb.label}
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      </div>
    </header>
  )
}
