"use client"

// The Warehouses and Suppliers pages. Racks and suppliers come from the API; warehouses are still demo data.

import { useState } from "react"
import Link from "next/link"
import { MapIcon, PencilIcon, PlusIcon } from "lucide-react"
import { toast } from "sonner"

import { createLocation, getLocations, updateLocation } from "@/app/actions/inventory.actions"
import { createSupplier, getSuppliers, updateSupplier } from "@/app/actions/supplier.actions"
import { ListTable, type ListColumn } from "@/components/list-table"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import type { DemoWarehouse, WarehouseType } from "@/lib/inventory-demo"
import type { LocationDto, StorageLocation } from "@/types/inventory.type"
import type { Supplier, SupplierDto } from "@/types/supplier.type"

import { DocSheet } from "./doc-bits"
import { Card, fmtDate, Pill, RackTag, StatusPill, WarehouseTag } from "./inventory-ui"
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
      cell: (w) => {
        const mapId = racksOf(w.code)[0]?.warehouse.id
        const content = (
          <>
            <span className="font-medium group-hover:text-primary">{w.name}</span>
            <span className="block text-xs text-muted-foreground">{w.addressLine1}</span>
          </>
        )
        // A warehouse with a backend counterpart opens its rack map; a demo-only one opens its details.
        if (mapId) {
          return (
            <Link href={`/inventory/setup/warehouses/${mapId}`} className="group block">
              {content}
            </Link>
          )
        }
        return (
          <button type="button" className="group text-left" onClick={() => setEditing(w)}>
            {content}
          </button>
        )
      },
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
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      className: "w-36 text-right",
      cell: (w) => {
        const mapId = racksOf(w.code)[0]?.warehouse.id
        return (
          <span className="flex justify-end gap-1">
            {mapId && (
              <Button size="sm" variant="outline" nativeButton={false} render={<Link href={`/inventory/setup/warehouses/${mapId}`} />}>
                <MapIcon data-icon="inline-start" />
                Rack map
              </Button>
            )}
            <Button size="icon-sm" variant="ghost" aria-label={`Edit ${w.name}`} title="Edit details" onClick={() => setEditing(w)}>
              <PencilIcon />
            </Button>
          </span>
        )
      },
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
            {realWarehouse && (
              <Button variant="outline" nativeButton={false} render={<Link href={`/inventory/setup/warehouses/${realWarehouse.id}`} />}>
                <MapIcon data-icon="inline-start" />
                Open rack map
              </Button>
            )}
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

const SUPPLIER_FIELDS = [
  "name", "code", "company", "website", "paymentTerms", "contactName", "contactEmail", "contactPhone",
  "addressLine1", "addressLine2", "city", "state", "postalCode", "country", "note",
] as const
type SupplierForm = Record<(typeof SUPPLIER_FIELDS)[number] | "leadTimeDays", string> & { isActive: boolean }

export function Suppliers({ initialSuppliers }: { initialSuppliers: Supplier[] }) {
  const [suppliers, setSuppliers] = useState(initialSuppliers)
  const [editing, setEditing] = useState<Supplier | null | undefined>(undefined)

  async function refresh() {
    const res = await getSuppliers()
    if (res.success) setSuppliers(res.data)
  }

  const columns: ListColumn<Supplier>[] = [
    {
      key: "name",
      header: "Supplier",
      cell: (s) => (
        <button type="button" className="group text-left" onClick={() => setEditing(s)}>
          <span className="font-medium group-hover:text-primary">{s.name}</span>
          {(s.company || s.city) && <span className="block text-xs text-muted-foreground">{[s.company, s.city].filter(Boolean).join(" · ")}</span>}
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
          {s.contactName || <span className="text-muted-foreground">—</span>}
          <div className="text-xs text-muted-foreground">{s.contactPhone || s.contactEmail}</div>
        </div>
      ),
    },
    { key: "terms", header: "Terms", className: "hidden lg:table-cell", cell: (s) => s.paymentTerms || <span className="text-muted-foreground">—</span> },
    {
      key: "lead",
      header: "Lead time",
      className: "hidden text-right tabular-nums lg:table-cell",
      cell: (s) => (s.leadTimeDays === null ? <span className="text-muted-foreground">—</span> : `${s.leadTimeDays} days`),
    },
    { key: "batches", header: "Deliveries", className: "hidden text-right tabular-nums md:table-cell", cell: (s) => <span className="text-muted-foreground">{s._count.batches}</span> },
    { key: "orders", header: "Orders", className: "hidden text-right tabular-nums md:table-cell", cell: (s) => <span className="text-muted-foreground">{s._count.purchaseOrders}</span> },
    { key: "status", header: "Status", cell: (s) => (s.isActive ? <StatusPill status="ACTIVE" text="Active" /> : <StatusPill status="DISMISSED" text="Inactive" />) },
  ]

  return (
    <>
      <ListTable
        rows={suppliers}
        columns={columns}
        getRowId={(s) => s.id}
        searchText={(s) => `${s.name} ${s.code} ${s.company ?? ""} ${s.contactName ?? ""} ${s.city ?? ""}`}
        searchPlaceholder="Search suppliers..."
        filters={[
          { label: "All", value: "all", match: () => true },
          { label: "Active", value: "active", match: (s) => s.isActive },
          { label: "Inactive", value: "inactive", match: (s) => !s.isActive },
        ]}
        emptyText="No suppliers yet. Add the companies you buy stock from."
        toolbar={
          <Button size="sm" onClick={() => setEditing(null)}>
            <PlusIcon data-icon="inline-start" />
            New supplier
          </Button>
        }
      />
      {editing !== undefined && (
        <SupplierSheet
          key={editing?.id ?? "new"}
          supplier={editing}
          onSaved={async () => {
            setEditing(undefined)
            await refresh()
          }}
          onClose={() => setEditing(undefined)}
        />
      )}
    </>
  )
}

function SupplierSheet({ supplier, onSaved, onClose }: { supplier: Supplier | null; onSaved: () => void; onClose: () => void }) {
  const [form, setForm] = useState<SupplierForm>(() => ({
    ...(Object.fromEntries(SUPPLIER_FIELDS.map((f) => [f, supplier?.[f] ?? ""])) as Record<(typeof SUPPLIER_FIELDS)[number], string>),
    leadTimeDays: supplier?.leadTimeDays == null ? "" : String(supplier.leadTimeDays),
    isActive: supplier?.isActive ?? true,
  }))
  const [saving, setSaving] = useState(false)
  const field = (key: (typeof SUPPLIER_FIELDS)[number] | "leadTimeDays", text: string, placeholder?: string) => (
    <TextField id={`sup-${key}`} text={text} placeholder={placeholder} value={form[key]} onChange={(value) => setForm({ ...form, [key]: value })} />
  )

  async function save() {
    const lead = form.leadTimeDays.trim()
    if (form.name.trim().length < 2) return toast.error("Enter a name of at least 2 characters.")
    if (!/^[A-Z0-9-]{2,30}$/.test(form.code.trim())) return toast.error("Use 2 to 30 capital letters, digits or dashes for the code, like SUP-003.")
    if (lead && !/^\d+$/.test(lead)) return toast.error("Lead time must be a whole number of days.")
    if (form.website.trim() && !/^https?:\/\/\S+$/.test(form.website.trim())) return toast.error("Enter the website as a full link, like https://example.com.")

    // Blank fields are left out: the API rejects "" for the email and website.
    const dto: SupplierDto = { isActive: form.isActive, ...(lead && { leadTimeDays: Number(lead) }) }
    for (const key of SUPPLIER_FIELDS) {
      const value = form[key].trim()
      if (value) dto[key] = value
    }

    setSaving(true)
    const res = supplier ? await updateSupplier(supplier.id, dto) : await createSupplier(dto)
    setSaving(false)
    if (!res.success) return toast.error(res.error)
    toast.success(supplier ? `${res.data.name} saved` : `${res.data.name} added`)
    onSaved()
  }

  let submitText = supplier ? "Save supplier" : "Add supplier"
  if (saving) submitText = "Saving..."

  const stats = supplier && [
    ["Deliveries", String(supplier._count.batches)],
    ["Purchase orders", String(supplier._count.purchaseOrders)],
    ["Lead time", supplier.leadTimeDays === null ? "—" : `${supplier.leadTimeDays} days`],
    ["Supplier since", fmtDate(supplier.createdAt)],
  ]

  return (
    <DocSheet
      narrow
      kind="Supplier"
      title={form.name.trim() || "New supplier"}
      badge={
        supplier && (
          <>
            <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs font-semibold text-foreground/75">{supplier.code}</span>
            {supplier.isActive ? <StatusPill status="ACTIVE" text="Active" /> : <StatusPill status="DISMISSED" text="Inactive" />}
          </>
        )
      }
      onClose={onClose}
      footer={
        <>
          <Field orientation="horizontal" className="w-auto">
            <Switch id="sup-active" checked={form.isActive} onCheckedChange={(isActive) => setForm({ ...form, isActive })} />
            <FieldLabel htmlFor="sup-active" className="font-normal">Active</FieldLabel>
          </Field>
          <span className="flex-1" />
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{submitText}</Button>
        </>
      }
    >
      {stats && (
        // The 1px gap over a border-colored background draws the dividers.
        <section className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-4">
          {stats.map(([label, value]) => (
            <div key={label} className="min-w-0 bg-card px-4 py-3">
              <span className="block truncate text-[12.5px] text-muted-foreground">{label}</span>
              <strong className="mt-0.5 block truncate text-xl font-bold tracking-tight tabular-nums">{value}</strong>
            </div>
          ))}
        </section>
      )}

      <Card title="Company">
        <div className="grid gap-3 px-4 pb-4 sm:grid-cols-2">
          {field("name", "Name")}
          <Field>
            <FieldLabel htmlFor="sup-code">Code</FieldLabel>
            <Input id="sup-code" placeholder="SUP-003" className="font-mono" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
            <FieldDescription>Capital letters, digits and dashes.</FieldDescription>
          </Field>
          {field("company", "Registered company")}
          {field("website", "Website", "https://")}
        </div>
      </Card>

      <Card title="Buying terms">
        <div className="grid gap-3 px-4 pb-4 sm:grid-cols-2">
          {field("paymentTerms", "Payment terms", "Net 30, COD")}
          <Field>
            <FieldLabel htmlFor="sup-leadTimeDays">Lead time</FieldLabel>
            <div className="relative">
              <Input id="sup-leadTimeDays" inputMode="numeric" className="pr-12" value={form.leadTimeDays} onChange={(e) => setForm({ ...form, leadTimeDays: e.target.value })} />
              <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-muted-foreground">days</span>
            </div>
            <FieldDescription>From order to delivery, usually.</FieldDescription>
          </Field>
        </div>
      </Card>

      <Card title="Contact">
        <div className="grid gap-3 px-4 pb-4 sm:grid-cols-3">
          {field("contactName", "Name")}
          {field("contactEmail", "Email")}
          {field("contactPhone", "Phone")}
        </div>
      </Card>

      <Card title="Address">
        <div className="grid gap-3 px-4 pb-4 sm:grid-cols-2">
          {field("addressLine1", "Address")}
          {field("addressLine2", "Address line 2")}
        </div>
        <div className="grid gap-3 px-4 pb-4 sm:grid-cols-4">
          {field("city", "City")}
          {field("state", "Division")}
          {field("postalCode", "Postal code")}
          {field("country", "Country", "BD")}
        </div>
      </Card>

      <Card title="Note">
        <div className="px-4 pb-4">
          <Textarea id="sup-note" aria-label="Note" rows={3} placeholder="Anything the team should know when ordering" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          {supplier && (
            <p className="mt-2 text-[12.5px] text-muted-foreground">
              Suppliers can’t be deleted, because deliveries keep pointing at them. Switch Active off to retire one.
            </p>
          )}
        </div>
      </Card>
    </DocSheet>
  )
}
