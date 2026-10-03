"use client"

import { usePathname } from "next/navigation"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { ChevronRightIcon, MoreHorizontalIcon, FolderIcon, ShareIcon, Trash2Icon } from "lucide-react"

type NavLink = { title: string; url: string }
// A sub-item is a link, or a folder of links (one level deep), like Inventory › Setup.
type NavSubItem = NavLink & { icon?: React.ReactNode; items?: NavLink[] }

const panelClass =
  "h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-200 ease-out data-ending-style:h-0 data-starting-style:h-0"

const isUnder = (pathname: string, item: NavSubItem): boolean =>
  pathname.startsWith(item.url) || (item.items ?? []).some((sub) => pathname.startsWith(sub.url))

export function NavDocuments({
  items,
}: {
  items: {
    name: string
    url: string
    icon: React.ReactNode
    items?: NavSubItem[]
  }[]
}) {
  const { isMobile } = useSidebar()
  const pathname = usePathname()
  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>Store</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) =>
          item.items ? (
            // Same collapsible group as the main nav.
            <Collapsible
              key={item.name}
              // Sub-pages can live outside the item's own URL, like a folder of pages.
              defaultOpen={pathname.startsWith(item.url) || item.items.some((sub) => isUnder(pathname, sub))}
              render={<SidebarMenuItem />}
            >
              <CollapsibleTrigger render={<SidebarMenuButton />}>
                {item.icon}
                <span>{item.name}</span>
                <ChevronRightIcon className="ml-auto transition-transform duration-200 in-data-panel-open:rotate-90" />
              </CollapsibleTrigger>
              <CollapsibleContent className={panelClass}>
                <SidebarMenuSub className="mt-1">
                  {item.items.map((sub) =>
                    sub.items ? (
                      <Collapsible key={sub.title} defaultOpen={isUnder(pathname, sub)} render={<SidebarMenuSubItem />}>
                        {/* Scoped group, so this chevron follows its own folder, not Inventory's. */}
                        <CollapsibleTrigger render={<SidebarMenuSubButton render={<button type="button" />} className="group/folder w-full" />}>
                          {sub.icon}
                          <span>{sub.title}</span>
                          <ChevronRightIcon className="ml-auto transition-transform duration-200 group-data-panel-open/folder:rotate-90" />
                        </CollapsibleTrigger>
                        <CollapsibleContent className={panelClass}>
                          <SidebarMenuSub className="mr-0 pr-0">
                            {sub.items.map((link) => (
                              <SidebarMenuSubItem key={link.title}>
                                <SidebarMenuSubButton href={link.url} isActive={link.url === pathname}>
                                  <span>{link.title}</span>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            ))}
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      </Collapsible>
                    ) : (
                      <SidebarMenuSubItem key={sub.title}>
                        <SidebarMenuSubButton href={sub.url} isActive={sub.url === pathname}>
                          <span>{sub.title}</span>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    )
                  )}
                </SidebarMenuSub>
              </CollapsibleContent>
            </Collapsible>
          ) : (
            <SidebarMenuItem key={item.name}>
              <SidebarMenuButton render={<a href={item.url} />}>
                {item.icon}
                <span>{item.name}</span>
              </SidebarMenuButton>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <SidebarMenuAction
                      showOnHover
                      className="aria-expanded:bg-muted"
                    />
                  }
                >
                  <MoreHorizontalIcon
                  />
                  <span className="sr-only">More</span>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-24"
                  side={isMobile ? "bottom" : "right"}
                  align={isMobile ? "end" : "start"}
                >
                  <DropdownMenuItem>
                    <FolderIcon
                    />
                    <span>Open</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <ShareIcon
                    />
                    <span>Share</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive">
                    <Trash2Icon
                    />
                    <span>Delete</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          )
        )}
        <SidebarMenuItem>
          <SidebarMenuButton className="text-sidebar-foreground/70">
            <MoreHorizontalIcon className="text-sidebar-foreground/70" />
            <span>More</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroup>
  )
}
