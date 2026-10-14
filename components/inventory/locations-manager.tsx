"use client"

import Link from "next/link"
import { useState } from "react"
import { EllipsisVerticalIcon, PlusIcon } from "lucide-react"
import { toast } from "sonner"

import { createLocation, deleteLocation, getLocations, updateLocation } from "@/app/actions/inventory.actions"
import { ListTable, type ListColumn } from "@/components/list-table"
import { StatCards } from "@/components/stat-cards"
import { StatusBadge } from "@/components/status-badge"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { LocationDto, StorageLocation } from "@/types/inventory.type"

import { RackTag, WarehouseTag } from "./inventory-ui"
import { LOCATION_TYPE_LABEL, LocationFormSheet } from "./location-form-sheet"
import type { Warehouse } from "./stock-sheet"

// Every warehouse has both, made by the system: UNASSIGNED catches stock whose rack isn't known,
// DAMAGE holds damaged units. Neither can be edited or deleted here.
const isSystem = (l: StorageLocation) => l.code === "UNASSIGNED" || l.type === "DAMAGE"

function systemNote(l: StorageLocation) {
  if (l.type === "DAMAGE") return "Damaged units, not for sale"
  if (l.code === "UNASSIGNED") return "Stock without a rack"
  return null
}

export function LocationsManager({ initialLocations }: { initialLocations: StorageLocation[] }) {
  const [locations, setLocations] = useState(initialLocations)
  // undefined = closed, null = adding
  const [editing, setEditing] = useState<StorageLocation | null | undefined>(undefined)
  const [deleting, setDeleting] = useState<StorageLocation | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const warehouses: Warehouse[] = [...new Map(locations.map((l) => [l.warehouse.id, l.warehouse])).values()]
  const racks = locations.filter((l) => !isSystem(l))

  async function refresh() {
    const res = await getLocations()
    if (res.success) setLocations(res.data)
  }

  async function save(dto: LocationDto) {
    const res = editing ? await updateLocation(editing.id, dto) : await createLocation(dto)
    if (!res.success) {
      toast.error(res.error)
      return res
    }
    toast.success(editing ? `${dto.code} saved` : `${dto.code} added`)
    setEditing(undefined)
    await refresh()
    return res
  }

  async function toggleActive(location: StorageLocation) {
    const res = await updateLocation(location.id, { isActive: !location.isActive })
    if (!res.success) {
      toast.error(res.error)
      return
    }
    toast.success(`${location.code} ${location.isActive ? "deactivated" : "activated"}`)
    await refresh()
  }

  async function handleDelete() {
    const location = deleting!
    setIsDeleting(true)
    const res = await deleteLocation(location.id)
    setIsDeleting(false)
    if (!res.success) {
      toast.error(res.error)
      return
    }
    toast.success(`${location.code} deleted`)
    setDeleting(null)
    await refresh()
  }

  const columns: ListColumn<StorageLocation>[] = [
    {
      key: "code",
      header: "Location",
      cell: (l) => (
        <div className="flex min-w-0 flex-col">
          <span className="flex items-center gap-1">
            {l.parent && <span className="font-mono text-xs text-muted-foreground">{l.parent.code} /</span>}
            <RackTag code={l.code} />
            {isSystem(l) && <span className="rounded bg-muted px-1.5 text-[10.5px] font-semibold text-muted-foreground">System</span>}
          </span>
          <span className="truncate text-xs text-muted-foreground">{systemNote(l) ?? l.name ?? LOCATION_TYPE_LABEL[l.type]}</span>
        </div>
      ),
    },
    { key: "type", header: "Type", className: "hidden md:table-cell", cell: (l) => LOCATION_TYPE_LABEL[l.type] },
    { key: "warehouse", header: "Warehouse", cell: (l) => <WarehouseTag code={l.warehouse.code} /> },
    {
      key: "stock",
      header: "Stock",
      className: "text-right tabular-nums",
      cell: (l) => {
        // This endpoint reports the damage section as empty; its units are on the damaged-stock page.
        if (l.type === "DAMAGE") {
          return (
            <Link href={`/inventory/damaged?warehouseId=${l.warehouseId}`} className="text-xs font-medium text-primary hover:underline">
              See damaged stock
            </Link>
          )
        }
        return (
        <div className="flex flex-col items-end">
          <span>{l.totalUnits.toLocaleString("en-IN")} units</span>
          <span className="text-xs text-muted-foreground">
            {l.variantCount} {l.variantCount === 1 ? "variant" : "variants"}
          </span>
        </div>
        )
      },
    },
    {
      key: "picking",
      header: "Picking",
      className: "hidden text-muted-foreground lg:table-cell",
      cell: (l) => {
        if (l.type === "DAMAGE") return "Never picked"
        if (isSystem(l)) return "Last resort"
        return l.isPickable ? `Order ${l.pickSequence}` : "Not picked from"
      },
    },
    {
      key: "status",
      header: "Status",
      cell: (l) => <StatusBadge status={l.isActive ? "Active" : "Inactive"} />,
    },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      className: "w-12 text-right",
      cell: (l) =>
        !isSystem(l) && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="icon" className="size-8 text-muted-foreground data-open:bg-muted" />}
            >
              <EllipsisVerticalIcon />
              <span className="sr-only">Actions for {l.code}</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36">
              <DropdownMenuItem onClick={() => setEditing(l)}>Edit</DropdownMenuItem>
              <DropdownMenuItem onClick={() => toggleActive(l)}>{l.isActive ? "Deactivate" : "Activate"}</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => setDeleting(l)}>
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
    },
  ]

  return (
    <>
      <StatCards
        stats={[
          { label: "Racks", value: String(racks.length), hint: `Across ${warehouses.length} warehouses` },
          { label: "In use", value: String(racks.filter((l) => l.totalUnits > 0).length), hint: "Holding stock" },
          {
            label: "Unassigned units",
            value: locations.filter(isSystem).reduce((sum, l) => sum + l.totalUnits, 0).toLocaleString("en-IN"),
            hint: "Stock not put away on a rack",
          },
          { label: "Inactive", value: String(racks.filter((l) => !l.isActive).length), hint: "Not used for new stock" },
        ]}
      />

      <ListTable
        rows={locations}
        columns={columns}
        getRowId={(l) => l.id}
        searchText={(l) => `${l.code} ${l.name ?? ""} ${l.warehouse.code} ${LOCATION_TYPE_LABEL[l.type]}`}
        searchPlaceholder="Search racks..."
        filters={[
          { label: "All", value: "all", match: () => true },
          ...warehouses.map((w) => ({ label: w.code, value: w.id, match: (l: StorageLocation) => l.warehouseId === w.id })),
          { label: "Inactive", value: "inactive", match: (l) => !l.isActive },
        ]}
        emptyText="No racks match."
        toolbar={
          <Button size="sm" onClick={() => setEditing(null)}>
            <PlusIcon data-icon="inline-start" />
            Add rack
          </Button>
        }
      />

      {editing !== undefined && (
        <LocationFormSheet
          key={editing?.id ?? "new"}
          location={editing}
          locations={locations}
          warehouses={warehouses}
          onClose={() => setEditing(undefined)}
          onSave={save}
        />
      )}

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.code}?</AlertDialogTitle>
            <AlertDialogDescription>
              Only an empty rack with no movement history can be deleted. Otherwise, deactivate it instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? "Deleting..." : "Delete rack"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
