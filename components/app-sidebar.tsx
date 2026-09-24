"use client"

import * as React from "react"

import { NavDocuments } from "@/components/nav-documents"
import { NavMain, type NavMainItem } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import {
  LayoutDashboardIcon,
  ShoppingCartIcon,
  PackageIcon,
  UsersIcon,
  ChartBarIcon,
  TagIcon,
  WarehouseIcon,
  TruckIcon,
  StarIcon,
  Settings2Icon,
  CircleHelpIcon,
  SearchIcon,
  StoreIcon,
} from "lucide-react"

const data = {
  user: {
    name: "Store Admin",
    email: "admin@example.com",
    avatar: "/avatars/admin.jpg",
  },
  navMain: [
    { title: "Dashboard", url: "/dashboard", icon: <LayoutDashboardIcon /> },
    {
      title: "Orders",
      url: "/dashboard/orders",
      icon: <ShoppingCartIcon />,
      items: [
        { title: "All Orders", url: "/dashboard/orders" },
        { title: "Pending", url: "/dashboard/orders/pending", badge: "12" },
        { title: "Returns & Refunds", url: "/dashboard/orders/returns" },
        { title: "Abandoned Carts", url: "/dashboard/orders/abandoned" },
      ],
    },
    {
      title: "Products",
      url: "/dashboard/products",
      icon: <PackageIcon />,
      items: [
        { title: "All Products", url: "/dashboard/products" },
        { title: "Create Product", url: "/dashboard/products/new" },
        { title: "Categories", url: "/dashboard/products/categories" },
        { title: "Brands", url: "/dashboard/products/brands" },
        { title: "Attributes", url: "/dashboard/products/attributes" },
      ],
    },
    {
      title: "Customers",
      url: "/dashboard/customers",
      icon: <UsersIcon />,
      items: [
        { title: "All Customers", url: "/dashboard/customers" },
        { title: "Add Customer", url: "/dashboard/customers/new" },
        { title: "Customer Groups", url: "/dashboard/customers/groups" },
      ],
    },
    {
      title: "Analytics",
      url: "/dashboard/analytics",
      icon: <ChartBarIcon />,
      items: [
        { title: "Sales Report", url: "/dashboard/analytics/sales" },
        { title: "Top Products", url: "/dashboard/analytics/products" },
        { title: "Traffic", url: "/dashboard/analytics/traffic" },
      ],
    },
  ] satisfies NavMainItem[],
  navSecondary: [
    { title: "Settings", url: "#", icon: <Settings2Icon /> },
    { title: "Get Help", url: "#", icon: <CircleHelpIcon /> },
    { title: "Search", url: "#", icon: <SearchIcon /> },
  ],
  documents: [
    { name: "Inventory", url: "#", icon: <WarehouseIcon /> },
    { name: "Discounts", url: "#", icon: <TagIcon /> },
    { name: "Shipping", url: "#", icon: <TruckIcon /> },
    { name: "Reviews", url: "#", icon: <StarIcon /> },
  ],
}
export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="data-[slot=sidebar-menu-button]:p-1.5!"
              render={<a href="/dashboard" />}
            >
              <StoreIcon className="size-5!" />
              <span className="text-base font-semibold">Acme Store</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavDocuments items={data.documents} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  )
}
