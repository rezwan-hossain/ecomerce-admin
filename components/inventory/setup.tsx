"use client"

// The Warehouses and Suppliers pages. Racks come from the real racks API; the rest is demo data.

import { useState } from "react"
import Link from "next/link"
import { PencilIcon, PlusIcon } from "lucide-react"
import { toast } from "sonner"

import { createLocation, getLocations, updateLocation } from "@/app/actions/inventory.actions"
import { ListTable, type ListColumn } from "@/components/list-table"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import type { DemoPurchaseOrder, DemoSupplier, DemoWarehouse, WarehouseType } from "@/lib/inventory-demo"
import type { LocationDto, StorageLocation } from "@/types/inventory.type"

import { DocSheet } from "./doc-bits"
import { Card, Pill, RackTag, StatusPill, taka, WarehouseTag } from "./inventory-ui"
import { LOCATION_TYPE_LABEL, LocationFormSheet } from "./location-form-sheet"

export const WAREHOUSE_TYPE_LABEL: Record<WarehouseType, string> = {
  PHYSICAL: "Warehouse",
  STORE: "Retail store",
  VIRTUAL_DAMAGE: "Damage hold",
  VIRTUAL_QC: "Quality check hold",
  VIRTUAL_RETURN: "Returns processing",
}

function TextField({ id, text, value, onChange, placeholder }: { id: string; text: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{text}</FieldLabel>
      <Input id={id} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
    </Field>
  )
}

function FormSheet({
  title,
  description,
  submit,
  onSubmit,
  onClose,
  children,
}: {
  title: string
  description: string
  submit: string
  onSubmit: () => void
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full gap-0 sm:max-w-lg">
        <form
          noValidate
          className="flex h-full flex-col"
          onSubmit={(e) => {
            e.preventDefault()
            onSubmit()
          }}
        >
          <SheetHeader className="border-b">
            <SheetTitle>{title}</SheetTitle>
            <SheetDescription>{description}</SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto p-4">
            <FieldGroup>{children}</FieldGroup>
          </div>
          <SheetFooter className="flex-row justify-end border-t">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit">{submit}</Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}

/* ---------- Warehouses ---------- */

export function Warehouses({ initialWarehouses, initialLocations }: { initialWarehouses: DemoWarehouse[]; initialLocations: StorageLocation[] }) {
  const [warehouses, setWarehouses] = useState(initialWarehouses)
  const [locations, setLocations] = useState(initialLocations)
  const [editing, setEditing] = useState<DemoWarehouse | null | undefined>(undefined)

  // Racks are real; they're matched to the demo warehouses by code.
  const racksOf = (code: string) => locations.filter((l) => l.warehouse.code === code)

  async function refreshLocations() {
    const res = await getLocations()
    if (res.success) setLocations(res.data)
  }

  function save(w: DemoWarehouse) {
    if (!w.name.trim()) return toast.error("Enter a name.")
    if (!/^[A-Z0-9][A-Z0-9-]{1,11}$/.test(w.code)) return toast.error("Use 2 to 12 letters, numbers or dashes for the code.")
    if (warehouses.some((x) => x.id !== w.id && x.code === w.code)) return toast.error("Another warehouse already uses that code.")
    if (w.isDefault && !w.isActive) return toast.error("The default warehouse must be active.")
    setWarehouses((current) => {
      // Only one warehouse can be the default.
      const others = current.map((x) => (w.isDefault ? { ...x, isDefault: false } : x))
      return others.some((x) => x.id === w.id) ? others.map((x) => (x.id === w.id ? w : x)) : [...others, w]
    })
    toast.success(editing ? `${w.code} saved` : `${w.code} created`)
    setEditing(undefined)
  }

  const columns: ListColumn<DemoWarehouse>[] = [
    {
      key: "name",
      header: "Warehouse",
      cell: (w) => (
        <button type="button" className="text-left" onClick={() => setEditing(w)}>
          <span className="font-semibold hover:underline">{w.name}</span>
          <span className="block text-xs text-muted-foreground">{w.addressLine1}</span>
        </button>
      ),
    },
    { key: "code", header: "Code", cell: (w) => <WarehouseTag code={w.code} /> },
    { key: "type", header: "Type", className: "hidden md:table-cell", cell: (w) => WAREHOUSE_TYPE_LABEL[w.type] },
    { key: "city", header: "City", className: "hidden lg:table-cell", cell: (w) => w.city || "—" },
    { key: "priority", header: "Priority", className: "text-right tabular-nums", cell: (w) => w.priority },
    {
      key: "racks",
      header: "Racks",
      className: "text-right tabular-nums",
      cell: (w) => racksOf(w.code).filter((l) => l.code !== "UNASSIGNED").length,
    },
    {
      key: "status",
      header: "Status",
      cell: (w) => (
        <span className="flex flex-wrap gap-1">
          {w.isActive ? <StatusPill status="ACTIVE" text="Active" /> : <StatusPill status="DISMISSED" text="Inactive" />}
          {w.isDefault && <Pill tone="blue">Default</Pill>}
        </span>
      ),
    },
  ]

  return (
    <>
      <ListTable
        rows={[...warehouses].sort((a, b) => b.priority - a.priority)}
        columns={columns}
        getRowId={(w) => w.id}
        searchText={(w) => `${w.name} ${w.code} ${w.city}`}
        searchPlaceholder="Search warehouses..."
        toolbar={
          <Button size="sm" onClick={() => setEditing(null)}>
            <PlusIcon data-icon="inline-start" />
            New warehouse
          </Button>
        }
      />
      {editing !== undefined && (
        <WarehouseSheet
          key={editing?.id ?? "new"}
          warehouse={editing}
          racks={editing ? racksOf(editing.code) : []}
          onSave={save}
          onRacksChanged={refreshLocations}
          onClose={() => setEditing(undefined)}
        />
      )}
    </>
  )
}

const warehouseTypeItems = Object.entries(WAREHOUSE_TYPE_LABEL).map(([value, text]) => ({ value, label: text }))

// Parents first, each followed by its children, like the rack tree on the floor.
function rackTree(racks: StorageLocation[]) {
  const ordered: { rack: StorageLocation; depth: number }[] = []
  const walk = (parentId: string | null, depth: number) => {
    racks
      .filter((r) => r.parentId === parentId)
      .sort((a, b) => a.pickSequence - b.pickSequence || a.code.localeCompare(b.code))
      .forEach((rack) => {
        ordered.push({ rack, depth })
        walk(rack.id, depth + 1)
      })
  }
  walk(null, 0)
  return ordered
}

function WarehouseSheet({
  warehouse,
  racks,
  onSave,
  onRacksChanged,
  onClose,
}: {
  warehouse: DemoWarehouse | null
  racks: StorageLocation[]
  onSave: (w: DemoWarehouse) => void
  onRacksChanged: () => Promise<void>
  onClose: () => void
}) {
  const [w, setW] = useState<DemoWarehouse>(
    warehouse ?? {
      id: crypto.randomUUID(), name: "", code: "", type: "PHYSICAL", addressLine1: "", addressLine2: "", city: "", state: "",
      postalCode: "", priority: 0, isDefault: false, isActive: true,
    }
  )
  const [priority, setPriority] = useState(String(w.priority))
  // undefined = closed, null = adding
  const [rack, setRack] = useState<StorageLocation | null | undefined>(undefined)
  const set = (patch: Partial<DemoWarehouse>) => setW({ ...w, ...patch })

  // The backend warehouse this one maps to, through any of its racks (each has UNASSIGNED).
  const realWarehouse = racks[0]?.warehouse

  async function saveRack(dto: LocationDto) {
    const res = rack ? await updateLocation(rack.id, dto) : await createLocation({ ...dto, warehouseId: realWarehouse!.id })
    if (!res.success) {
      toast.error(res.error)
      return res
    }
    toast.success(rack ? `${dto.code} saved` : `${dto.code} added`)
    setRack(undefined)
    await onRacksChanged()
    return res
  }

  function submit() {
    if (!/^-?\d+$/.test(priority.trim())) return toast.error("Priority must be a whole number.")
    onSave({ ...w, name: w.name.trim(), code: w.code.trim().toUpperCase(), priority: Number(priority) })
  }

  return (
    <>
      <DocSheet
        kind="Warehouse"
        title={w.name || "New warehouse"}
        badge={warehouse && <WarehouseTag code={warehouse.code} />}
        onClose={onClose}
        footer={
          <>
            <span className="flex-1" />
            <Button variant="outline" onClick={onClose}>Close</Button>
            <Button onClick={submit}>{warehouse ? "Save warehouse" : "Create warehouse"}</Button>
          </>
        }
      >
        <Card title="Details">
          <div className="space-y-4 px-4 pb-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <TextField id="wh-name" text="Name" value={w.name} onChange={(name) => set({ name })} />
              <Field>
                <FieldLabel htmlFor="wh-code">Code</FieldLabel>
                <Input id="wh-code" placeholder="DHK-01" value={w.code} onChange={(e) => set({ code: e.target.value.toUpperCase() })} />
                <FieldDescription>Short and unique, like DHK-01.</FieldDescription>
              </Field>
              <Field>
                <FieldLabel>Type</FieldLabel>
                <Select value={w.type} items={warehouseTypeItems} onValueChange={(v) => set({ type: v as WarehouseType })}>
                  <SelectTrigger aria-label="Type" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {warehouseTypeItems.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField id="wh-address" text="Address" value={w.addressLine1} onChange={(addressLine1) => set({ addressLine1 })} />
              <TextField id="wh-address2" text="Address line 2" value={w.addressLine2} onChange={(addressLine2) => set({ addressLine2 })} />
            </div>
            <div className="grid gap-3 sm:grid-cols-4">
              <TextField id="wh-city" text="City" value={w.city} onChange={(city) => set({ city })} />
              <TextField id="wh-state" text="Division" value={w.state} onChange={(state) => set({ state })} />
              <TextField id="wh-postal" text="Postal code" value={w.postalCode} onChange={(postalCode) => set({ postalCode })} />
              <Field>
                <FieldLabel htmlFor="wh-priority">Priority</FieldLabel>
                <Input id="wh-priority" inputMode="numeric" className="text-right" value={priority} onChange={(e) => setPriority(e.target.value)} />
                <FieldDescription>Higher reserves first.</FieldDescription>
              </Field>
            </div>
            <div className="flex flex-wrap gap-6">
              <Field orientation="horizontal" className="w-auto">
                <Switch id="wh-active" checked={w.isActive} onCheckedChange={(isActive) => set({ isActive })} />
                <FieldLabel htmlFor="wh-active" className="font-normal">Active</FieldLabel>
              </Field>
              <Field orientation="horizontal" className="w-auto">
                <Switch id="wh-default" checked={w.isDefault} onCheckedChange={(isDefault) => set({ isDefault })} />
                <FieldLabel htmlFor="wh-default" className="font-normal">Default fulfillment center</FieldLabel>
              </Field>
            </div>
            <p className="text-[12.5px] text-muted-foreground">
              Only active warehouses and stores of type Warehouse or Retail store count toward storefront stock.
            </p>
          </div>
        </Card>

        {realWarehouse ? (
          <Card
            title="Racks and locations"
            action={
              <Button size="sm" variant="outline" onClick={() => setRack(null)}>
                <PlusIcon data-icon="inline-start" />
                Add location
              </Button>
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr className="border-y [&>th]:px-3 [&>th]:py-2 [&>th]:font-medium">
                    <th>Code</th>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Picking</th>
                    <th className="text-right">Walk order</th>
                    <th className="text-right">Units</th>
                    <th>Status</th>
                    <th><span className="sr-only">Edit</span></th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {rackTree(racks).map(({ rack: r, depth }) => (
                    <tr key={r.id} className="border-b last:border-b-0 [&>td]:px-3 [&>td]:py-2">
                      <td className="whitespace-nowrap">
                        <span className="inline-block" style={{ width: depth * 18 }} />
                        <RackTag code={r.code} />
                      </td>
                      <td>{r.code === "UNASSIGNED" ? "Rack not known yet" : r.name}</td>
                      <td className="text-muted-foreground">{LOCATION_TYPE_LABEL[r.type]}</td>
                      <td>{r.isPickable ? "Pickable" : <span className="text-muted-foreground">Not picked</span>}</td>
                      <td className="text-right">{r.pickSequence}</td>
                      <td className="text-right font-semibold">{r.totalUnits}</td>
                      <td>{!r.isActive && <Pill tone="grey">Inactive</Pill>}</td>
                      <td className="w-10 text-right">
                        {r.code !== "UNASSIGNED" && (
                          <Button size="icon-sm" variant="ghost" aria-label={`Edit ${r.code}`} onClick={() => setRack(r)}>
                            <PencilIcon />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ) : (
          <p className="rounded-md bg-primary/10 px-3 py-2.5 text-[13px] text-primary">
            {warehouse
              ? "This warehouse doesn’t exist in the backend yet, so it has no racks to manage."
              : "Racks can be added once the warehouse exists in the backend."}
          </p>
        )}
      </DocSheet>

      {rack !== undefined && realWarehouse && (
        <LocationFormSheet
          key={rack?.id ?? "new"}
          location={rack}
          locations={racks}
          warehouses={[realWarehouse]}
          onClose={() => setRack(undefined)}
          onSave={saveRack}
        />
      )}
    </>
  )
}

/* ---------- Suppliers ---------- */

const OPEN_PO = ["SUBMITTED", "CONFIRMED", "PARTIAL"]
const poTotal = (po: DemoPurchaseOrder) => po.items.reduce((sum, i) => sum + i.orderedQty * i.unitCost, 0) + po.taxAmount + po.shippingAmount

export function Suppliers({ initialSuppliers, purchaseOrders }: { initialSuppliers: DemoSupplier[]; purchaseOrders: DemoPurchaseOrder[] }) {
  const [suppliers, setSuppliers] = useState(initialSuppliers)
  const [editing, setEditing] = useState<DemoSupplier | null | undefined>(undefined)

  const ordersOf = (s: DemoSupplier) => purchaseOrders.filter((po) => po.supplierId === s.id)

  function save(s: DemoSupplier) {
    if (!s.name.trim()) return toast.error("Enter a name.")
    if (!s.code.trim()) return toast.error("Enter a code.")
    if (suppliers.some((x) => x.id !== s.id && x.code.toLowerCase() === s.code.toLowerCase())) return toast.error("Another supplier already uses that code.")
    if (s.contactEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s.contactEmail)) return toast.error("Check the email address.")
    setSuppliers((current) => (current.some((x) => x.id === s.id) ? current.map((x) => (x.id === s.id ? s : x)) : [...current, s]))
    toast.success(editing ? `${s.name} saved` : `${s.name} added`)
    setEditing(undefined)
  }

  const columns: ListColumn<DemoSupplier>[] = [
    {
      key: "name",
      header: "Supplier",
      cell: (s) => (
        <button type="button" className="text-left" onClick={() => setEditing(s)}>
          <span className="font-semibold hover:underline">{s.name}</span>
          <span className="block text-xs text-muted-foreground">{s.city}</span>
        </button>
      ),
    },
    { key: "code", header: "Code", cell: (s) => <span className="font-mono text-xs font-semibold">{s.code}</span> },
    {
      key: "contact",
      header: "Contact",
      className: "hidden md:table-cell",
      cell: (s) => (
        <div>
          {s.contactName || "—"}
          <div className="text-xs text-muted-foreground">{s.contactPhone}</div>
        </div>
      ),
    },
    { key: "terms", header: "Terms", className: "hidden lg:table-cell", cell: (s) => s.paymentTerms || "—" },
    { key: "lead", header: "Lead time", className: "hidden text-right tabular-nums lg:table-cell", cell: (s) => (s.leadTimeDays === null ? "—" : `${s.leadTimeDays} days`) },
    { key: "open", header: "Open orders", className: "text-right tabular-nums", cell: (s) => ordersOf(s).filter((po) => OPEN_PO.includes(po.status)).length },
    {
      key: "spent",
      header: "Spent",
      className: "hidden text-right tabular-nums md:table-cell",
      cell: (s) => taka(ordersOf(s).filter((po) => po.status !== "DRAFT" && po.status !== "CANCELLED").reduce((sum, po) => sum + poTotal(po), 0)),
    },
    { key: "status", header: "Status", cell: (s) => (s.isActive ? <StatusPill status="ACTIVE" text="Active" /> : <StatusPill status="DISMISSED" text="Inactive" />) },
  ]

  return (
    <>
      <ListTable
        rows={suppliers}
        columns={columns}
        getRowId={(s) => s.id}
        searchText={(s) => `${s.name} ${s.code} ${s.contactName} ${s.city}`}
        searchPlaceholder="Search suppliers..."
        filters={[
          { label: "All", value: "all", match: () => true },
          { label: "Active", value: "active", match: (s) => s.isActive },
          { label: "Inactive", value: "inactive", match: (s) => !s.isActive },
        ]}
        toolbar={
          <Button size="sm" onClick={() => setEditing(null)}>
            <PlusIcon data-icon="inline-start" />
            New supplier
          </Button>
        }
      />
      {editing !== undefined && <SupplierSheet key={editing?.id ?? "new"} supplier={editing} onSave={save} onClose={() => setEditing(undefined)} />}
    </>
  )
}

function SupplierSheet({ supplier, onSave, onClose }: { supplier: DemoSupplier | null; onSave: (s: DemoSupplier) => void; onClose: () => void }) {
  const [s, setS] = useState<DemoSupplier>(
    supplier ?? { id: crypto.randomUUID(), name: "", code: "", contactName: "", contactPhone: "", contactEmail: "", city: "", paymentTerms: "", leadTimeDays: null, isActive: true }
  )
  const [lead, setLead] = useState(s.leadTimeDays === null ? "" : String(s.leadTimeDays))
  const set = (patch: Partial<DemoSupplier>) => setS({ ...s, ...patch })

  return (
    <FormSheet
      title={supplier ? `Edit ${supplier.name}` : "New supplier"}
      description="Who you buy from, their terms and typical lead time."
      submit={supplier ? "Save supplier" : "Add supplier"}
      onSubmit={() => {
        if (lead.trim() && !/^\d+$/.test(lead.trim())) return toast.error("Lead time must be a whole number of days.")
        onSave({ ...s, name: s.name.trim(), code: s.code.trim(), leadTimeDays: lead.trim() ? Number(lead) : null })
      }}
      onClose={onClose}
    >
      <div className="grid grid-cols-2 gap-3">
        <TextField id="sup-name" text="Name" value={s.name} onChange={(name) => set({ name })} />
        <TextField id="sup-code" text="Code" placeholder="SUP-005" value={s.code} onChange={(code) => set({ code })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <TextField id="sup-terms" text="Payment terms" placeholder="Net 30, COD" value={s.paymentTerms} onChange={(paymentTerms) => set({ paymentTerms })} />
        <TextField id="sup-lead" text="Lead time in days" value={lead} onChange={setLead} />
      </div>
      <TextField id="sup-contact" text="Contact name" value={s.contactName} onChange={(contactName) => set({ contactName })} />
      <div className="grid grid-cols-2 gap-3">
        <TextField id="sup-email" text="Email" value={s.contactEmail} onChange={(contactEmail) => set({ contactEmail })} />
        <TextField id="sup-phone" text="Phone" value={s.contactPhone} onChange={(contactPhone) => set({ contactPhone })} />
      </div>
      <TextField id="sup-city" text="City" value={s.city} onChange={(city) => set({ city })} />
      <Field orientation="horizontal">
        <Switch id="sup-active" checked={s.isActive} onCheckedChange={(isActive) => set({ isActive })} />
        <FieldLabel htmlFor="sup-active" className="font-normal">Active</FieldLabel>
      </Field>
    </FormSheet>
  )
}
