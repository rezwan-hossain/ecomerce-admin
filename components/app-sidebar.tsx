"use client"

import * as React from "react"

import { NavDocuments } from "@/components/nav-documents"
import { NavMain } from "@/components/nav-main"
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
    { title: "Orders", url: "#", icon: <ShoppingCartIcon /> },
    { title: "Products", url: "#", icon: <PackageIcon /> },
    { title: "Customers", url: "#", icon: <UsersIcon /> },
    { title: "Analytics", url: "#", icon: <ChartBarIcon /> },
  ],
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
