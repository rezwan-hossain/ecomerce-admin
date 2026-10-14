"use client"

// The Warehouses and Suppliers pages, both on the live API. Racks come from the locations API.

import { useEffect, useState } from "react"
import Link from "next/link"
import { ChevronLeftIcon, ChevronRightIcon, MapIcon, PencilIcon, PlusIcon, SearchIcon } from "lucide-react"
import { toast } from "sonner"

import { createLocation, getLocations, updateLocation } from "@/app/actions/inventory.actions"
import { createSupplier, getSuppliers, updateSupplier } from "@/app/actions/supplier.actions"
import { createWarehouse, deleteWarehouse, getWarehouse, getWarehouseStock, updateWarehouse } from "@/app/actions/warehouse.actions"
import { ListTable, type ListColumn } from "@/components/list-table"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
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
import { cn } from "@/lib/utils"
import type { LocationDto, StorageLocation } from "@/types/inventory.type"
import type { Supplier, SupplierDto } from "@/types/supplier.type"
import type { Warehouse, WarehouseDto, WarehouseStockRow, WarehouseType } from "@/types/warehouse.type"

import { DocSheet } from "./doc-bits"
import { Card, fmtDate, Kpis, n0, Pill, RackTag, StatusPill, taka, WarehouseTag } from "./inventory-ui"
import { LOCATION_TYPE_LABEL, LocationFormSheet } from "./location-form-sheet"

export const WAREHOUSE_TYPE_LABEL: Record<WarehouseType, string> = {
  PHYSICAL: "Warehouse",
  STORE: "Retail store",
  VIRTUAL_DAMAGE: "Damage hold",
  VIRTUAL_QC: "Quality check hold",
  VIRTUAL_RETURN: "Returns processing",
}

// Only active warehouses and stores count toward what shoppers can buy.
const sellable = (type: WarehouseType, isActive: boolean) => isActive && (type === "PHYSICAL" || type === "STORE")

function TextField({
  id,
  text,
  value,
  onChange,
  placeholder,
  maxLength,
}: {
  id: string
  text: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  maxLength?: number
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{text}</FieldLabel>
      <Input id={id} placeholder={placeholder} maxLength={maxLength} value={value} onChange={(e) => onChange(e.target.value)} />
    </Field>
  )
}

/* ---------- Warehouses ---------- */

export function Warehouses({ initialWarehouses, initialLocations }: { initialWarehouses: Warehouse[]; initialLocations: StorageLocation[] }) {
  const [warehouses, setWarehouses] = useState(initialWarehouses)
  const [locations, setLocations] = useState(initialLocations)
  const [editing, setEditing] = useState<Warehouse | null | undefined>(undefined)

  const racksOf = (id: string) => locations.filter((l) => l.warehouse.id === id)

  // Saving a default un-defaults the old one, and a new warehouse gets an UNASSIGNED rack, so reload both.
  async function refresh() {
    const [w, l] = await Promise.all([getWarehouse(), getLocations()])
    if (w.success) setWarehouses(w.data)
    if (l.success) setLocations(l.data)
    return w.success ? w.data : null
  }

  const active = warehouses.filter((w) => w.isActive)
  const columns: ListColumn<Warehouse>[] = [
    {
      key: "name",
      header: "Warehouse",
      cell: (w) => (
        <Link href={`/inventory/setup/warehouses/${w.id}`} className="group block min-w-44">
          <span className="font-medium group-hover:text-primary">{w.name}</span>
          <span className="block text-xs text-muted-foreground">{[w.addressLine1, w.city].filter(Boolean).join(", ") || "No address"}</span>
        </Link>
      ),
    },
    { key: "code", header: "Code", cell: (w) => <WarehouseTag code={w.code} /> },
    {
      key: "type",
      header: "Type",
      className: "hidden md:table-cell",
      cell: (w) => (
        <span className="flex flex-col">
          {WAREHOUSE_TYPE_LABEL[w.type]}
          {!sellable(w.type, true) && <span className="text-xs text-muted-foreground">Not for sale</span>}
        </span>
      ),
    },
    { key: "priority", header: "Priority", className: "hidden text-right tabular-nums lg:table-cell", cell: (w) => w.priority },
    { key: "racks", header: "Racks", className: "hidden text-right tabular-nums lg:table-cell", cell: (w) => n0(w.counts.locations) },
    { key: "skus", header: "SKUs", className: "hidden text-right tabular-nums xl:table-cell", cell: (w) => n0(w.counts.variantsStocked) },
    { key: "units", header: "Units", className: "text-right tabular-nums", cell: (w) => <span className="font-semibold">{n0(w.counts.unitsOnHand)}</span> },
    { key: "value", header: "Value", className: "hidden text-right tabular-nums md:table-cell", cell: (w) => <span className="text-muted-foreground">{taka(Number(w.counts.stockValue))}</span> },
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
      cell: (w) => (
        <span className="flex justify-end gap-1">
          <Button size="sm" variant="outline" nativeButton={false} render={<Link href={`/inventory/setup/warehouses/${w.id}/map`} />}>
            <MapIcon data-icon="inline-start" />
            Rack map
          </Button>
          <Button size="icon-sm" variant="ghost" aria-label={`Edit ${w.name}`} title="Edit details" onClick={() => setEditing(w)}>
            <PencilIcon />
          </Button>
        </span>
      ),
    },
  ]

  return (
    <>
      <Kpis
        className="mx-4 xl:grid-cols-4 lg:mx-6"
        items={[
          { label: "Warehouses", value: n0(warehouses.length), hint: `${n0(active.length)} active` },
          { label: "Selling stock", value: n0(warehouses.filter((w) => sellable(w.type, w.isActive)).length), hint: "count toward the storefront" },
          { label: "Units on hand", value: n0(warehouses.reduce((s, w) => s + w.counts.unitsOnHand, 0)), hint: "in every warehouse" },
          { label: "Stock value", value: taka(warehouses.reduce((s, w) => s + Number(w.counts.stockValue), 0)), hint: "at unit cost" },
        ]}
      />
      <ListTable
        rows={warehouses}
        columns={columns}
        getRowId={(w) => w.id}
        searchText={(w) => `${w.name} ${w.code} ${w.city ?? ""}`}
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
          racks={editing ? racksOf(editing.id) : []}
          onChanged={refresh}
          onClose={() => setEditing(undefined)}
        />
      )}
    </>
  )
}

const warehouseTypeItems = Object.entries(WAREHOUSE_TYPE_LABEL).map(([value, text]) => ({ value, label: text }))

// The two system locations explain themselves; other racks show their name.
function rackNote(r: StorageLocation) {
  if (r.code === "UNASSIGNED") return "Rack not known yet"
  if (r.type === "DAMAGE") return "Damaged units, not for sale"
  return r.name
}

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

// The form keeps text as typed; blanks are sent as null.
type WarehouseForm = {
  code: string
  name: string
  type: WarehouseType
  addressLine1: string
  addressLine2: string
  city: string
  state: string
  postalCode: string
  priority: string
  isDefault: boolean
  isActive: boolean
}

function toForm(w: Warehouse | null): WarehouseForm {
  return {
    code: w?.code ?? "",
    name: w?.name ?? "",
    type: w?.type ?? "PHYSICAL",
    addressLine1: w?.addressLine1 ?? "",
    addressLine2: w?.addressLine2 ?? "",
    city: w?.city ?? "",
    state: w?.state ?? "",
    postalCode: w?.postalCode ?? "",
    priority: String(w?.priority ?? 0),
    isDefault: w?.isDefault ?? false,
    isActive: w?.isActive ?? true,
  }
}

const blankToNull = (s: string) => s.trim() || null

export function WarehouseSheet({
  warehouse,
  racks,
  onChanged,
  onClose,
}: {
  warehouse: Warehouse | null
  racks: StorageLocation[]
  onChanged: (deleted?: boolean) => Promise<unknown> // after a save or delete, to reload or leave
  onClose: () => void
}) {
  const [form, setForm] = useState(() => toForm(warehouse))
  const [saving, setSaving] = useState(false)
  const [confirming, setConfirming] = useState<"storefront" | "delete" | null>(null)
  // undefined = closed, null = adding
  const [rack, setRack] = useState<StorageLocation | null | undefined>(undefined)
  const set = (patch: Partial<WarehouseForm>) => setForm({ ...form, ...patch })

  // Mirrors the API's rules so most mistakes show before a round trip.
  function problem() {
    const name = form.name.trim()
    if (name.length < 2 || name.length > 100) return "Name must be 2 to 100 characters."
    if (!warehouse && !/^[A-Z0-9-]{2,20}$/.test(form.code.trim())) return "Code must be 2 to 20 capital letters, digits or hyphens, like DHK-01."
    if (!/^\d+$/.test(form.priority.trim()) || Number(form.priority) > 1000) return "Priority must be a whole number from 0 to 1000."
    if (form.isDefault && !form.isActive) return "The default warehouse can't be inactive."
    if (warehouse?.isDefault && !form.isDefault) return "Make another warehouse the default instead."
    return null
  }

  function submit() {
    const error = problem()
    if (error) return toast.error(error)
    // Changing whether this warehouse sells changes what shoppers can buy, so ask first.
    const before = warehouse ? sellable(warehouse.type, warehouse.isActive) : false
    if (warehouse && before !== sellable(form.type, form.isActive)) return setConfirming("storefront")
    save()
  }

  async function save() {
    setConfirming(null)
    const dto: WarehouseDto = {
      name: form.name.trim(),
      type: form.type,
      addressLine1: blankToNull(form.addressLine1),
      addressLine2: blankToNull(form.addressLine2),
      city: blankToNull(form.city),
      state: blankToNull(form.state),
      postalCode: blankToNull(form.postalCode),
      priority: Number(form.priority),
      isDefault: form.isDefault,
      isActive: form.isActive,
    }
    setSaving(true)
    const res = warehouse ? await updateWarehouse(warehouse.id, dto) : await createWarehouse({ ...dto, code: form.code.trim() })
    setSaving(false)
    if (!res.success) return toast.error(res.error)
    toast.success(warehouse ? `${res.data.code} saved` : `${res.data.code} created`, {
      description: !warehouse ? "It has an UNASSIGNED rack; add racks from its rack map or below." : undefined,
    })
    await onChanged()
    onClose()
  }

  async function deactivate() {
    const res = await updateWarehouse(warehouse!.id, { isActive: false })
    if (!res.success) return toast.error(res.error)
    toast.success(`${warehouse!.code} deactivated`, { description: "Its stock no longer counts toward the storefront." })
    await onChanged()
    onClose()
  }

  async function remove() {
    setConfirming(null)
    setSaving(true)
    const res = await deleteWarehouse(warehouse!.id)
    setSaving(false)
    if (res.success) {
      toast.success(`${warehouse!.code} deleted`)
      await onChanged(true)
      return onClose()
    }
    // A warehouse in use can't be deleted; switching it off is the way out.
    if (res.error.includes("Deactivate it instead") && warehouse!.isActive) {
      return toast.error(res.error, { action: { label: "Deactivate", onClick: deactivate } })
    }
    toast.error(res.error)
  }

  async function saveRack(dto: LocationDto) {
    const res = rack ? await updateLocation(rack.id, dto) : await createLocation({ ...dto, warehouseId: warehouse!.id })
    if (!res.success) {
      toast.error(res.error)
      return res
    }
    toast.success(rack ? `${dto.code} saved` : `${dto.code} added`)
    setRack(undefined)
    await onChanged()
    return res
  }

  const nowSellable = sellable(form.type, form.isActive)
  let saveText = warehouse ? "Save warehouse" : "Create warehouse"
  if (saving) saveText = "Saving..."

  return (
    <>
      <DocSheet
        kind="Warehouse"
        title={form.name || "New warehouse"}
        badge={warehouse && <WarehouseTag code={warehouse.code} />}
        onClose={onClose}
        footer={
          <>
            {warehouse && !warehouse.isDefault && (
              <Button variant="ghost" className="text-destructive" onClick={() => setConfirming("delete")} disabled={saving}>
                Delete
              </Button>
            )}
            {warehouse && (
              <Button variant="outline" nativeButton={false} render={<Link href={`/inventory/setup/warehouses/${warehouse.id}/map`} />}>
                <MapIcon data-icon="inline-start" />
                Open rack map
              </Button>
            )}
            <span className="flex-1" />
            <Button variant="outline" onClick={onClose}>Close</Button>
            <Button onClick={submit} disabled={saving}>
              {saveText}
            </Button>
          </>
        }
      >
        {warehouse && (
          <section className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-4">
            {[
              { label: "Racks and bins", value: n0(warehouse.counts.locations) },
              { label: "SKUs in stock", value: n0(warehouse.counts.variantsStocked) },
              { label: "Units on hand", value: n0(warehouse.counts.unitsOnHand) },
              { label: "Stock value", value: taka(Number(warehouse.counts.stockValue)) },
            ].map((s) => (
              <div key={s.label} className="bg-card px-4 py-3">
                <span className="block text-xs text-muted-foreground">{s.label}</span>
                <strong className="block truncate text-xl font-bold tabular-nums">{s.value}</strong>
              </div>
            ))}
          </section>
        )}

        <Card title="Details">
          <div className="space-y-4 px-4 pb-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <TextField id="wh-name" text="Name" maxLength={100} value={form.name} onChange={(name) => set({ name })} />
              <Field>
                <FieldLabel htmlFor="wh-code">Code</FieldLabel>
                <Input
                  id="wh-code"
                  placeholder="DHK-01"
                  maxLength={20}
                  className="font-mono uppercase"
                  value={form.code}
                  readOnly={!!warehouse}
                  disabled={!!warehouse}
                  onChange={(e) => set({ code: e.target.value.toUpperCase() })}
                />
                <FieldDescription>{warehouse ? "Fixed: racks and documents show it." : "Capitals, digits and hyphens. Can't change later."}</FieldDescription>
              </Field>
              <Field>
                <FieldLabel>Type</FieldLabel>
                <Select value={form.type} items={warehouseTypeItems} onValueChange={(v) => set({ type: v as WarehouseType })}>
                  <SelectTrigger aria-label="Type" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {warehouseTypeItems.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FieldDescription>{sellable(form.type, true) ? "Its stock can be sold." : "Holds stock that isn't for sale."}</FieldDescription>
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField id="wh-address" text="Address" maxLength={255} value={form.addressLine1} onChange={(addressLine1) => set({ addressLine1 })} />
              <TextField id="wh-address2" text="Address line 2" maxLength={255} value={form.addressLine2} onChange={(addressLine2) => set({ addressLine2 })} />
            </div>
            <div className="grid gap-3 sm:grid-cols-4">
              <TextField id="wh-city" text="City" maxLength={100} value={form.city} onChange={(city) => set({ city })} />
              <TextField id="wh-state" text="Division" maxLength={100} value={form.state} onChange={(state) => set({ state })} />
              <TextField id="wh-postal" text="Postal code" maxLength={20} value={form.postalCode} onChange={(postalCode) => set({ postalCode })} />
              <Field>
                <FieldLabel htmlFor="wh-priority">Priority</FieldLabel>
                <Input id="wh-priority" inputMode="numeric" className="text-right" value={form.priority} onChange={(e) => set({ priority: e.target.value })} />
                <FieldDescription>0–1000. Higher reserves first.</FieldDescription>
              </Field>
            </div>
            <div className="flex flex-wrap gap-6">
              <Field orientation="horizontal" className="w-auto">
                <Switch id="wh-active" checked={form.isActive} onCheckedChange={(isActive) => set({ isActive })} />
                <FieldLabel htmlFor="wh-active" className="font-normal">Active</FieldLabel>
              </Field>
              <Field orientation="horizontal" className="w-auto">
                <Switch
                  id="wh-default"
                  checked={form.isDefault}
                  // The default can only move: tick it on another warehouse instead.
                  disabled={warehouse?.isDefault}
                  onCheckedChange={(isDefault) => set({ isDefault })}
                />
                <FieldLabel htmlFor="wh-default" className="font-normal">Default fulfillment center</FieldLabel>
              </Field>
            </div>
            <p className={cn("rounded-lg px-3 py-2 text-[12.5px]", nowSellable ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" : "bg-muted text-muted-foreground")}>
              {nowSellable
                ? "Its stock counts toward what shoppers can buy."
                : "Its stock doesn't count toward the storefront: only active warehouses and retail stores do."}
              {warehouse?.isDefault && " This is the default warehouse; to change it, make another one the default."}
            </p>
          </div>
        </Card>

        {warehouse && <StockCard warehouseId={warehouse.id} />}

        {warehouse && (
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
                      <td>{rackNote(r)}</td>
                      <td className="text-muted-foreground">{LOCATION_TYPE_LABEL[r.type]}</td>
                      <td>{r.isPickable ? "Pickable" : <span className="text-muted-foreground">Not picked</span>}</td>
                      <td className="text-right">{r.pickSequence}</td>
                      <td className="text-right font-semibold">{r.totalUnits}</td>
                      <td>{!r.isActive && <Pill tone="grey">Inactive</Pill>}</td>
                      <td className="w-10 text-right">
                        {r.code !== "UNASSIGNED" && r.type !== "DAMAGE" && (
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
        )}
        {!warehouse && (
          <p className="rounded-md bg-primary/10 px-3 py-2.5 text-[13px] text-primary">
            Saving creates the warehouse with an UNASSIGNED rack. Add racks and lay them out on its rack map afterwards.
          </p>
        )}
      </DocSheet>

      {rack !== undefined && warehouse && (
        <LocationFormSheet
          key={rack?.id ?? "new"}
          location={rack}
          locations={racks}
          warehouses={[{ id: warehouse.id, code: warehouse.code }]}
          onClose={() => setRack(undefined)}
          onSave={saveRack}
        />
      )}

      {confirming === "storefront" && (
        <Dialog open onOpenChange={(open) => !open && setConfirming(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{nowSellable ? "Put this stock back on sale?" : "Take this stock off sale?"}</DialogTitle>
              <DialogDescription>
                {nowSellable
                  ? `The ${n0(warehouse!.counts.unitsOnHand)} units in ${warehouse!.code} will count toward what shoppers can buy again.`
                  : `The ${n0(warehouse!.counts.unitsOnHand)} units in ${warehouse!.code} will stop counting toward the storefront. Products only stocked here will show as out of stock.`}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirming(null)}>Go back</Button>
              <Button variant={nowSellable ? "default" : "destructive"} onClick={save}>Save warehouse</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {confirming === "delete" && (
        <Dialog open onOpenChange={(open) => !open && setConfirming(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Delete {warehouse!.code}?</DialogTitle>
              <DialogDescription>
                Only for a warehouse created by mistake. One that has stock, racks, movements or documents can’t be deleted;
                deactivate it instead.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirming(null)}>Keep it</Button>
              <Button variant="destructive" onClick={remove}>Delete warehouse</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}

// The warehouse's stock, 20 rows a page, searchable by SKU or product name.
export function StockCard({ warehouseId }: { warehouseId: string }) {
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState("")
  const [search, setSearch] = useState("")
  const [rows, setRows] = useState<WarehouseStockRow[] | null>(null)
  const [meta, setMeta] = useState({ total: 0, totalPages: 1 })

  useEffect(() => {
    let stale = false
    getWarehouseStock(warehouseId, page, search).then((res) => {
      if (stale) return
      if (!res.success) return toast.error(res.error)
      setRows(res.data.data)
      setMeta(res.data.meta)
    })
    return () => {
      stale = true
    }
  }, [warehouseId, page, search])

  return (
    <Card
      title="Stock"
      action={
        <form
          className="relative"
          onSubmit={(e) => {
            e.preventDefault()
            setPage(1)
            setSearch(query.trim())
          }}
        >
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input aria-label="Search stock" placeholder="SKU or product, Enter" className="h-8 w-56 pl-8" value={query} onChange={(e) => setQuery(e.target.value)} />
        </form>
      }
    >
      {rows === null && <p className="px-4 pb-4 text-sm text-muted-foreground">Loading stock...</p>}
      {rows?.length === 0 && (
        <p className="px-4 pb-4 text-sm text-muted-foreground">{search ? `Nothing matches “${search}”.` : "No stock here yet."}</p>
      )}
      {rows && rows.length > 0 && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:font-medium [&>th:first-child]:pl-4 [&>th:last-child]:pr-4">
                  <th>Product</th>
                  <th className="hidden sm:table-cell">Rack</th>
                  <th className="text-right">On hand</th>
                  <th className="hidden text-right md:table-cell">Reserved</th>
                  <th className="text-right">Available</th>
                  <th className="hidden text-right md:table-cell">Value</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-border/60 [&>td]:px-3 [&>td]:py-2 [&>td:first-child]:pl-4 [&>td:last-child]:pr-4">
                    <td>
                      <div className="font-medium">
                        {r.variant.productName}
                        {r.variant.label && <span className="font-normal text-muted-foreground"> · {r.variant.label}</span>}
                      </div>
                      <div className="font-mono text-[11.5px] text-muted-foreground">{r.variant.sku}</div>
                    </td>
                    <td className="hidden sm:table-cell">
                      <RackTag code={r.defaultLocation?.code ?? null} />
                    </td>
                    <td className="text-right text-muted-foreground">{n0(r.onHand)}</td>
                    <td className="hidden text-right text-muted-foreground md:table-cell">{n0(r.reserved)}</td>
                    <td className="text-right font-semibold">{n0(r.available)}</td>
                    <td className="hidden text-right text-muted-foreground md:table-cell">{taka(Number(r.totalCost))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t px-4 py-2 text-xs text-muted-foreground">
            <span>{n0(meta.total)} SKUs</span>
            <span className="flex items-center gap-2">
              Page {page} of {Math.max(1, meta.totalPages)}
              <Button size="icon-sm" variant="outline" aria-label="Previous page" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                <ChevronLeftIcon />
              </Button>
              <Button size="icon-sm" variant="outline" aria-label="Next page" disabled={page >= meta.totalPages} onClick={() => setPage(page + 1)}>
                <ChevronRightIcon />
              </Button>
            </span>
          </div>
        </>
      )}
    </Card>
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
