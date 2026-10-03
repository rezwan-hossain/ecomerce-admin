"use client"

import { useState } from "react"
import { toast } from "sonner"

import { adjustStock, countStock, moveStock, updateThreshold } from "@/app/actions/inventory.actions"
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
import { Textarea } from "@/components/ui/textarea"
import type { ManualMovementType, StorageLocation, VariantStock } from "@/types/inventory.type"

export type StockAction = "adjust" | "count" | "move" | "threshold"

export type Warehouse = { id: string; code: string }

const ADJUST_TYPES: { value: ManualMovementType; label: string; inbound: boolean }[] = [
  { value: "PURCHASE_RECEIVED", label: "Received from supplier", inbound: true },
  { value: "RETURN_RESTOCKED", label: "Customer return restocked", inbound: true },
  { value: "ADJUSTMENT_INCREASE", label: "Correction: add", inbound: true },
  { value: "ADJUSTMENT_DECREASE", label: "Correction: remove", inbound: false },
  { value: "DAMAGED", label: "Damaged", inbound: false },
  { value: "LOST", label: "Lost or stolen", inbound: false },
  { value: "EXPIRED", label: "Expired", inbound: false },
  { value: "SAMPLE", label: "Given as sample", inbound: false },
  { value: "WRITE_OFF", label: "Other write-off", inbound: false },
]

const TITLES: Record<StockAction, { title: string; description: string; submit: string }> = {
  adjust: {
    title: "Adjust stock",
    description: "Add received goods or remove damaged, lost or written-off units. Every change is kept in the movement history.",
    submit: "Save adjustment",
  },
  count: {
    title: "Count stock",
    description: "Enter what you physically counted. The difference is recorded as a correction.",
    submit: "Save count",
  },
  move: {
    title: "Move between racks",
    description: "Moves units from one rack to another in the same warehouse. Sellable stock doesn't change.",
    submit: "Move stock",
  },
  threshold: {
    title: "Low-stock alert",
    description: "The storefront and this page flag the variant as low once sellable stock falls to this number.",
    submit: "Save threshold",
  },
}

// Racks can be left empty: stock coming in goes to the default rack, stock going out is picked automatically.
const AUTO_RACK = "auto"

const isWholeNumber = (s: string) => /^\d+$/.test(s.trim())

// One side panel for every stock action on a variant. Render with a key so each opening starts fresh.
export function StockSheet({
  action,
  variant,
  warehouseId: initialWarehouseId,
  warehouses,
  locations,
  onClose,
  onDone,
}: {
  action: StockAction
  variant: VariantStock
  warehouseId?: string // which warehouse to start on; defaults to the variant's main one
  warehouses: Warehouse[]
  locations: StorageLocation[]
  onClose: () => void
  onDone: () => void
}) {
  const [warehouseId, setWarehouseId] = useState(
    initialWarehouseId ?? variant.levels[0]?.warehouseId ?? warehouses[0]?.id ?? ""
  )
  const [type, setType] = useState<ManualMovementType>("PURCHASE_RECEIVED")
  const [quantity, setQuantity] = useState("")
  const [unitCost, setUnitCost] = useState("")
  const [rackId, setRackId] = useState(AUTO_RACK)
  const [toRackId, setToRackId] = useState("")
  const [threshold, setThreshold] = useState(String(variant.lowStockThreshold))
  const [note, setNote] = useState("")
  const [saving, setSaving] = useState(false)

  const level = variant.levels.find((l) => l.warehouseId === warehouseId)
  const onHand = level?.onHand ?? 0
  const racks = locations.filter((l) => l.warehouseId === warehouseId && l.isActive)
  const stockedRacks = level?.locationStocks ?? []
  const fromRack = stockedRacks.find((s) => s.location.id === rackId)
  const inbound = ADJUST_TYPES.find((t) => t.value === type)!.inbound
  const qty = Number(quantity)

  let preview = ""
  // Removing more than is on hand gets an error on save instead of a negative preview.
  if (action === "adjust" && isWholeNumber(quantity) && qty > 0 && (inbound || qty <= onHand)) {
    preview = `On hand ${onHand} → ${inbound ? onHand + qty : onHand - qty}`
  } else if (action === "count" && isWholeNumber(quantity)) {
    const diff = qty - onHand
    preview = diff === 0 ? "Matches the current count" : `On hand ${onHand} → ${qty} (${diff > 0 ? "+" : "−"}${Math.abs(diff)})`
  }

  function validate() {
    if (action === "threshold") return isWholeNumber(threshold) ? "" : "Enter the threshold as a whole number."
    if (!isWholeNumber(quantity)) return "Enter the quantity as a whole number."
    if (action !== "count" && qty === 0) return "Enter a quantity above 0."
    if (action === "adjust" && !inbound && qty > onHand) return `Only ${onHand} on hand in this warehouse.`
    if (action === "adjust" && unitCost.trim() && !(Number(unitCost) >= 0)) return "Enter the unit cost as a number."
    if (action === "move") {
      if (!fromRack) return "Choose the rack to move from."
      if (!toRackId) return "Choose the rack to move to."
      if (qty > fromRack.quantity) return `Only ${fromRack.quantity} on ${fromRack.location.code}.`
    }
    return ""
  }

  async function save() {
    const error = validate()
    if (error) {
      toast.error(error)
      return
    }
    const locationId = rackId === AUTO_RACK ? undefined : rackId
    const trimmedNote = note.trim() || undefined

    setSaving(true)
    let res
    if (action === "adjust") {
      res = await adjustStock({
        variantId: variant.variantId,
        warehouseId,
        locationId,
        type,
        quantity: qty,
        ...(inbound && unitCost.trim() && { unitCost: Number(unitCost) }),
        note: trimmedNote,
      })
    } else if (action === "count") {
      res = await countStock(variant.variantId, { warehouseId, locationId, countedQuantity: qty, note: trimmedNote })
    } else if (action === "move") {
      res = await moveStock({
        variantId: variant.variantId,
        warehouseId,
        fromLocationId: rackId,
        toLocationId: toRackId,
        quantity: qty,
        note: trimmedNote,
      })
    } else {
      res = await updateThreshold(variant.variantId, Number(threshold))
    }
    setSaving(false)

    if (!res.success) {
      toast.error(res.error)
      return
    }
    toast.success(action === "count" ? String(res.data) : `${variant.product.name} (${variant.name}) updated`)
    onDone()
  }

  const text = TITLES[action]
  const warehouseItems = warehouses.map((w) => ({ value: w.id, label: w.code }))
  const rackItems = [
    { value: AUTO_RACK, label: inbound || action === "count" ? "Default rack" : "Pick automatically" },
    ...racks.map((r) => ({ value: r.id, label: r.name ? `${r.code} · ${r.name}` : r.code })),
  ]
  const fromItems = stockedRacks.map((s) => ({ value: s.location.id, label: `${s.location.code} · ${s.quantity} units` }))
  const toItems = racks.filter((r) => r.id !== rackId).map((r) => ({ value: r.id, label: r.name ? `${r.code} · ${r.name}` : r.code }))

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
            <SheetTitle>{text.title}</SheetTitle>
            <SheetDescription>{text.description}</SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto p-4">
            <FieldGroup>
              <div className="rounded-lg border bg-muted/40 p-3">
                <div className="font-medium">{variant.product.name}</div>
                <div className="text-sm text-muted-foreground">
                  {variant.name !== variant.sku && `${variant.name} · `}
                  <span className="font-mono">{variant.sku}</span>
                </div>
                <div className="mt-2 flex gap-4 text-sm tabular-nums">
                  <span>
                    <span className="text-muted-foreground">Sellable </span>
                    {variant.stock}
                  </span>
                  <span>
                    <span className="text-muted-foreground">On hand </span>
                    {variant.onHand}
                  </span>
                  <span>
                    <span className="text-muted-foreground">Reserved </span>
                    {variant.reserved}
                  </span>
                </div>
              </div>

              {action !== "threshold" && warehouses.length > 1 && (
                <Field>
                  <FieldLabel>Warehouse</FieldLabel>
                  <Select
                    value={warehouseId}
                    items={warehouseItems}
                    onValueChange={(value) => {
                      setWarehouseId(value as string)
                      setRackId(AUTO_RACK)
                      setToRackId("")
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
                  <FieldDescription>{onHand} on hand here.</FieldDescription>
                </Field>
              )}

              {action === "adjust" && (
                <Field>
                  <FieldLabel>Reason</FieldLabel>
                  <Select value={type} items={ADJUST_TYPES} onValueChange={(value) => setType(value as ManualMovementType)}>
                    <SelectTrigger aria-label="Reason" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ADJUST_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          <span className={t.inbound ? "text-emerald-700 dark:text-emerald-400" : "text-destructive"}>
                            {t.inbound ? "+" : "−"}
                          </span>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}

              {action === "move" && (
                <>
                  <Field>
                    <FieldLabel>From rack</FieldLabel>
                    <Select value={rackId === AUTO_RACK ? null : rackId} items={fromItems} onValueChange={(value) => setRackId(value as string)}>
                      <SelectTrigger aria-label="From rack" className="w-full" disabled={fromItems.length === 0}>
                        <SelectValue placeholder={fromItems.length === 0 ? "No stock on any rack" : "Choose a rack"} />
                      </SelectTrigger>
                      <SelectContent>
                        {fromItems.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field>
                    <FieldLabel>To rack</FieldLabel>
                    <Select value={toRackId || null} items={toItems} onValueChange={(value) => setToRackId(value as string)}>
                      <SelectTrigger aria-label="To rack" className="w-full">
                        <SelectValue placeholder="Choose a rack" />
                      </SelectTrigger>
                      <SelectContent>
                        {toItems.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </>
              )}

              {action === "threshold" ? (
                <Field>
                  <FieldLabel htmlFor="stock-threshold">Alert at</FieldLabel>
                  <Input
                    id="stock-threshold"
                    inputMode="numeric"
                    value={threshold}
                    autoFocus
                    onChange={(event) => setThreshold(event.target.value)}
                  />
                  <FieldDescription>Units left. Use 0 to only flag it when it's out of stock.</FieldDescription>
                </Field>
              ) : (
                <Field>
                  <FieldLabel htmlFor="stock-quantity">{action === "count" ? "Counted quantity" : "Quantity"}</FieldLabel>
                  <Input
                    id="stock-quantity"
                    inputMode="numeric"
                    placeholder={action === "count" ? String(onHand) : "0"}
                    value={quantity}
                    autoFocus
                    onChange={(event) => setQuantity(event.target.value)}
                  />
                  {preview && <FieldDescription>{preview}</FieldDescription>}
                </Field>
              )}

              {action === "adjust" && inbound && (
                <Field>
                  <FieldLabel htmlFor="stock-cost">Unit cost (৳)</FieldLabel>
                  <Input
                    id="stock-cost"
                    inputMode="decimal"
                    placeholder="Optional"
                    value={unitCost}
                    onChange={(event) => setUnitCost(event.target.value)}
                  />
                  <FieldDescription>What one unit cost you. It updates the average cost and stock value.</FieldDescription>
                </Field>
              )}

              {(action === "adjust" || action === "count") && racks.length > 0 && (
                <Field>
                  <FieldLabel>Rack</FieldLabel>
                  <Select value={rackId} items={rackItems} onValueChange={(value) => setRackId(value as string)}>
                    <SelectTrigger aria-label="Rack" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {rackItems.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {action === "count" && <FieldDescription>Leave as default to count the whole warehouse.</FieldDescription>}
                </Field>
              )}

              {action !== "threshold" && (
                <Field>
                  <FieldLabel htmlFor="stock-note">Note</FieldLabel>
                  <Textarea
                    id="stock-note"
                    placeholder="Optional, e.g. supplier invoice number"
                    maxLength={500}
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                  />
                </Field>
              )}
            </FieldGroup>
          </div>

          <SheetFooter className="flex-row justify-end border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : text.submit}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
