"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
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
import { Textarea } from "@/components/ui/textarea"
import type { ActionResponse } from "@/lib/action-response"
import type { LocationDto, LocationType, StorageLocation } from "@/types/inventory.type"

import type { Warehouse } from "./stock-sheet"

export const LOCATION_TYPE_LABEL: Record<LocationType, string> = {
  ZONE: "Zone",
  AISLE: "Aisle",
  RACK: "Rack",
  SHELF: "Shelf",
  BIN: "Bin",
  RECEIVING: "Receiving dock",
  STAGING: "Staging",
  PACKING: "Packing",
  DAMAGE: "Damage section",
}

// The damage section is made by the system, one per warehouse, so it's never a choice here.
const typeItems = Object.entries(LOCATION_TYPE_LABEL)
  .filter(([value]) => value !== "DAMAGE")
  .map(([value, label]) => ({ value, label }))

const NO_PARENT = "none"

// The "Add rack" / "Edit rack" side panel. Render with a key so each opening starts fresh.
export function LocationFormSheet({
  location,
  locations,
  warehouses,
  onClose,
  onSave,
}: {
  location: StorageLocation | null // null when adding
  locations: StorageLocation[]
  warehouses: Warehouse[]
  onClose: () => void
  onSave: (dto: LocationDto) => Promise<ActionResponse<unknown>>
}) {
  const isNew = !location
  const [warehouseId, setWarehouseId] = useState(location?.warehouseId ?? warehouses[0]?.id ?? "")
  const [code, setCode] = useState(location?.code ?? "")
  const [name, setName] = useState(location?.name ?? "")
  const [type, setType] = useState<LocationType>(location?.type ?? "RACK")
  const [parentId, setParentId] = useState(location?.parentId ?? NO_PARENT)
  const [isPickable, setIsPickable] = useState(location?.isPickable ?? true)
  const [pickSequence, setPickSequence] = useState(String(location?.pickSequence ?? 0))
  const [note, setNote] = useState(location?.note ?? "")
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const parents = locations.filter(
    (l) => l.warehouseId === warehouseId && l.id !== location?.id && l.code !== "UNASSIGNED" && l.type !== "DAMAGE"
  )
  const parentItems = [
    { value: NO_PARENT, label: "None" },
    ...parents.map((p) => ({ value: p.id, label: p.name ? `${p.code} · ${p.name}` : p.code })),
  ]
  const warehouseItems = warehouses.map((w) => ({ value: w.id, label: w.code }))

  async function save() {
    const found: Record<string, string> = {}
    if (!/^[A-Za-z0-9._-]{1,50}$/.test(code.trim())) found.code = "Use 1–50 letters, digits, “.”, “_” or “-”."
    else if (code.trim().toUpperCase() === "DAMAGE") found.code = "DAMAGE is reserved for the damage section."
    if (!/^\d+$/.test(pickSequence.trim())) found.pickSequence = "Enter a whole number."
    setErrors(found)
    if (Object.keys(found).length > 0) return

    // Create rejects null, so empty fields are left out; update sends null to clear them.
    const empty = isNew ? undefined : null
    setSaving(true)
    const res = await onSave({
      ...(isNew && { warehouseId }),
      code: code.trim(),
      name: name.trim() || empty,
      type,
      parentId: parentId === NO_PARENT ? empty : parentId,
      isPickable,
      pickSequence: Number(pickSequence),
      note: note.trim() || empty,
    })
    setSaving(false)
    if (!res.success) setErrors(res.fieldErrors ?? {})
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full gap-0 sm:max-w-md">
        <form
          noValidate
          className="flex h-full flex-col"
          onSubmit={(event) => {
            event.preventDefault()
            save()
          }}
        >
          <SheetHeader className="border-b">
            <SheetTitle>{isNew ? "Add rack" : `Edit ${location.code}`}</SheetTitle>
            <SheetDescription>
              Racks, shelves and bins inside a warehouse. Stock is received to them and picked from them.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto p-4">
            <FieldGroup>
              {isNew && warehouses.length > 1 && (
                <Field>
                  <FieldLabel>Warehouse</FieldLabel>
                  <Select
                    value={warehouseId}
                    items={warehouseItems}
                    onValueChange={(value) => {
                      setWarehouseId(value as string)
                      setParentId(NO_PARENT)
                    }}
                  >
                    <SelectTrigger aria-label="Warehouse" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {warehouseItems.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}

              <div className="grid grid-cols-2 gap-3">
                <Field data-invalid={Boolean(errors.code)}>
                  <FieldLabel htmlFor="location-code">Code</FieldLabel>
                  <Input
                    id="location-code"
                    placeholder="A-03"
                    className="font-mono uppercase"
                    autoFocus
                    aria-invalid={Boolean(errors.code)}
                    value={code}
                    onChange={(event) => setCode(event.target.value.toUpperCase())}
                  />
                  <FieldError>{errors.code}</FieldError>
                </Field>
                <Field>
                  <FieldLabel>Type</FieldLabel>
                  <Select value={type} items={typeItems} onValueChange={(value) => setType(value as LocationType)}>
                    <SelectTrigger aria-label="Type" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {typeItems.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <Field>
                <FieldLabel htmlFor="location-name">Name</FieldLabel>
                <Input
                  id="location-name"
                  placeholder="Optional, e.g. Aisle A, rack 3"
                  maxLength={100}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </Field>

              <Field>
                <FieldLabel>Inside</FieldLabel>
                <Select value={parentId} items={parentItems} onValueChange={(value) => setParentId(value as string)}>
                  <SelectTrigger aria-label="Parent location" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {parentItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldDescription>For example, a shelf inside a rack.</FieldDescription>
              </Field>

              <Field orientation="horizontal">
                <Switch id="location-pickable" checked={isPickable} onCheckedChange={setIsPickable} />
                <FieldLabel htmlFor="location-pickable" className="font-normal">
                  Pick orders from here
                </FieldLabel>
              </Field>

              <Field data-invalid={Boolean(errors.pickSequence)}>
                <FieldLabel htmlFor="location-sequence">Pick order</FieldLabel>
                <Input
                  id="location-sequence"
                  inputMode="numeric"
                  aria-invalid={Boolean(errors.pickSequence)}
                  value={pickSequence}
                  onChange={(event) => setPickSequence(event.target.value)}
                />
                {errors.pickSequence ? (
                  <FieldError>{errors.pickSequence}</FieldError>
                ) : (
                  <FieldDescription>Pickers walk lower numbers first.</FieldDescription>
                )}
              </Field>

              <Field>
                <FieldLabel htmlFor="location-note">Note</FieldLabel>
                <Textarea
                  id="location-note"
                  placeholder="Optional"
                  maxLength={500}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                />
              </Field>
            </FieldGroup>
          </div>

          <SheetFooter className="flex-row justify-end border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : isNew ? "Add rack" : "Save changes"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
