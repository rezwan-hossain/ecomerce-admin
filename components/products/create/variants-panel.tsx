"use client"

import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

import { Swatch } from "./options-panel"
import {
  checkRows,
  isColorOption,
  isPrice,
  isStock,
  money,
  plural,
  rowLabel,
  type Bulk,
  type ProductImage,
  type VariantRow,
  type VariantState,
} from "./product-utils"

const cellInput =
  "h-8 w-full rounded-md border border-input bg-transparent px-2 outline-none focus:border-ring focus:ring-3 focus:ring-ring/50 aria-invalid:border-destructive aria-invalid:focus:ring-destructive/20"

export function VariantsPanel({
  rows,
  totalCombos,
  images,
  bulk,
  hasError,
  showErrors,
  onBulkChange,
  onApplyBulk,
  onUpdate,
  onRemoveRow,
  onRestoreAll,
}: {
  rows: VariantRow[]
  totalCombos: number
  images: ProductImage[]
  bulk: Bulk
  hasError: boolean
  showErrors: boolean // false until the first Publish, so a fresh form isn't all red
  onBulkChange: (bulk: Bulk) => void
  onApplyBulk: () => void
  onUpdate: (keys: string[], patch: Partial<VariantState>) => void
  onRemoveRow: (key: string) => void
  onRestoreAll: () => void
}) {
  const [pickerKey, setPickerKey] = useState<string | null>(null)
  const [pickAll, setPickAll] = useState(true)
  const [configKey, setConfigKey] = useState<string | null>(null)
  const [config, setConfig] = useState({ compareAt: "", cost: "", barcode: "", weight: "" })

  const { cells, totals } = checkRows(rows)
  const selectedCount = rows.filter((r) => r.v.selected).length
  const removedCount = totalCombos - rows.length

  const active = rows.filter((r) => r.v.active)
  const units = active.reduce((sum, r) => sum + (isStock(r.v.stock) ? Number(r.v.stock) : 0), 0)
  const prices = active.filter((r) => isPrice(r.v.price)).map((r) => Number(r.v.price))
  let priceRange = ""
  if (prices.length > 0) {
    const low = Math.min(...prices)
    const high = Math.max(...prices)
    priceRange = low === high ? money(low) : `${money(low)} to ${money(high)}`
  }

  const issues: string[] = []
  if (totals.dup) issues.push(`${totals.dup} variants share a SKU.`)
  if (totals.empty) issues.push(`${totals.empty} ${plural(totals.empty, "variant is", "variants are")} missing a SKU.`)
  if (totals.badPrice) issues.push(`${totals.badPrice} ${plural(totals.badPrice, "price needs", "prices need")} fixing.`)
  if (totals.badStock) issues.push(`${totals.badStock} stock ${plural(totals.badStock, "count needs", "counts need")} fixing.`)

  // Picks an image for one variant, or for every variant of the same color.
  function pickImage(row: VariantRow, imageId: string | null) {
    const colorPart = row.parts.find((p) => isColorOption(p.option))
    if (pickAll && colorPart && images.length > 0) {
      const keys = rows
        .filter((r) => r.parts.some((p) => p.option.id === colorPart.option.id && p.value === colorPart.value))
        .map((r) => r.key)
      onUpdate(keys, { imageId })
      toast.success(
        imageId
          ? `Image assigned to ${keys.length} ${colorPart.value} variants`
          : `Image removed from ${keys.length} ${colorPart.value} variants`
      )
    } else {
      onUpdate([row.key], { imageId })
    }
    setPickerKey(null)
  }

  function openConfig(row: VariantRow) {
    setConfig({ compareAt: row.v.compareAt, cost: row.v.cost, barcode: row.v.barcode, weight: row.v.weight })
    setConfigKey(row.key)
  }

  function saveConfig() {
    const row = rows.find((r) => r.key === configKey)!
    const compareAt = config.compareAt.trim()
    const cost = config.cost.trim()
    const weight = config.weight.trim()
    if (compareAt && !isPrice(compareAt)) return toast.error("Enter the compare-at price as a number, like 150.00.")
    if (compareAt && isPrice(row.v.price) && Number(compareAt) <= Number(row.v.price)) {
      return toast.error("The compare-at price must be higher than the variant price.")
    }
    if (cost && !isPrice(cost)) return toast.error("Enter the cost as a number, like 42.50.")
    if (weight && !isStock(weight)) return toast.error("Enter the weight in whole grams.")

    onUpdate([row.key], { compareAt, cost, barcode: config.barcode.trim(), weight })
    setConfigKey(null)
    toast.success("Variant saved")
  }

  const configRow = rows.find((r) => r.key === configKey)

  return (
    <section
      id="fMatrix"
      className={cn("mb-5 rounded-[10px] border bg-card p-5", hasError && "border-destructive")}
    >
      <div className="mb-3.5 flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-base font-semibold">Variants</h2>
        <p className="text-[13px] text-muted-foreground">
          {rows.length > 0
            ? rows[0].parts.length === 0
              ? "Default variant (no options)"
              : `${rows.length} ${plural(rows.length, "combination", "combinations")}`
            : "No combinations yet"}
        </p>
      </div>

      <div className="mb-3.5 flex flex-wrap items-end gap-3 rounded-lg border bg-muted/60 p-3.5">
        <span className="mr-1 self-center font-semibold">Bulk edit</span>
        <div>
          <label htmlFor="bulkPrice" className="mb-1 block text-xs text-muted-foreground">
            Price (৳)
          </label>
          <Input
            id="bulkPrice"
            inputMode="decimal"
            value={bulk.price}
            className="h-8 w-32.5 bg-card"
            onChange={(event) => onBulkChange({ ...bulk, price: event.target.value })}
          />
        </div>
        <div>
          <label htmlFor="bulkStock" className="mb-1 block text-xs text-muted-foreground">
            Stock
          </label>
          <Input
            id="bulkStock"
            inputMode="numeric"
            value={bulk.stock}
            className="h-8 w-32.5 bg-card"
            onChange={(event) => onBulkChange({ ...bulk, stock: event.target.value })}
          />
        </div>
        <div>
          <label htmlFor="bulkPrefix" className="mb-1 block text-xs text-muted-foreground">
            SKU prefix
          </label>
          <Input
            id="bulkPrefix"
            spellCheck={false}
            value={bulk.prefix}
            className="h-8 w-37.5 bg-card font-mono text-[13px]"
            onChange={(event) => onBulkChange({ ...bulk, prefix: event.target.value })}
          />
        </div>
        <Button type="button" className="md:ml-auto" disabled={rows.length === 0} onClick={onApplyBulk}>
          {selectedCount > 0 ? `Apply to selected (${selectedCount})` : `Apply to all (${rows.length})`}
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-235 border-collapse">
          <thead>
            <tr className="[&>th]:border-b [&>th]:bg-muted/60 [&>th]:px-3 [&>th]:py-2.5 [&>th]:text-left [&>th]:text-[12.5px] [&>th]:font-semibold [&>th]:whitespace-nowrap [&>th]:text-muted-foreground">
              <th className="w-10 !pr-0">
                <Checkbox
                  aria-label="Select all variants"
                  disabled={rows.length === 0}
                  checked={rows.length > 0 && selectedCount === rows.length}
                  indeterminate={selectedCount > 0 && selectedCount < rows.length}
                  onCheckedChange={(checked) => onUpdate(rows.map((r) => r.key), { selected: checked })}
                />
              </th>
              <th>Variant</th>
              <th className="w-21">Image</th>
              <th className="w-[22%]">
                SKU<span className="ml-0.5 text-destructive">*</span>
              </th>
              <th className="w-[12%]">
                Price (৳)<span className="ml-0.5 text-destructive">*</span>
              </th>
              <th className="w-[12%]">Stock</th>
              <th>Active</th>
              <th className="!text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-9 text-center text-muted-foreground">
                  {totalCombos > 0
                    ? "Every combination was removed. Restore them below."
                    : "Add option values above to generate variants."}
                </td>
              </tr>
            )}
            {rows.map((row) => {
              const { key, parts, v } = row
              const errors = cells[key]
              const image = images.find((i) => i.id === v.imageId)
              const colorPart = parts.find((p) => isColorOption(p.option))
              const label = rowLabel(parts)
              const dim = cn(!v.active && "opacity-50")

              return (
                <tr key={key} className="border-b last:border-b-0 hover:bg-muted/40 [&>td]:px-3 [&>td]:py-2 [&>td]:align-middle">
                  <td className="!pr-0">
                    <Checkbox
                      aria-label={`Select ${label}`}
                      checked={v.selected}
                      onCheckedChange={(checked) => onUpdate([key], { selected: checked })}
                    />
                  </td>
                  <td className={dim}>
                    <div className="flex items-center gap-2 font-semibold whitespace-nowrap">
                      {parts.map((p, i) => (
                        <span key={p.option.id} className="inline-flex items-center gap-1.5">
                          {i > 0 && <span className="mr-0.5 font-normal text-muted-foreground/50">/</span>}
                          {isColorOption(p.option) && <Swatch value={p.value} />}
                          {p.value}
                        </span>
                      ))}
                      {parts.length === 0 && "Default"}
                    </div>
                  </td>
                  <td className={dim}>
                    <Popover
                      open={pickerKey === key}
                      onOpenChange={(open) => {
                        setPickerKey(open ? key : null)
                        setPickAll(true)
                      }}
                    >
                      <PopoverTrigger
                        aria-label={`${image ? "Change" : "Assign"} image for ${label}`}
                        className={cn(
                          "grid h-10.5 w-14 place-items-center overflow-hidden rounded-md border border-dashed border-input bg-muted/60 p-0 text-[11.5px] text-muted-foreground hover:border-primary hover:text-primary",
                          image && "border-solid border-border"
                        )}
                      >
                        {image ? (
                          // eslint-disable-next-line @next/next/no-img-element -- local data URLs
                          <img src={image.src} alt="" className="size-full object-cover" />
                        ) : (
                          "Assign"
                        )}
                      </PopoverTrigger>
                      <PopoverContent align="start" className="w-63">
                        {images.length > 0 ? (
                          <div className="grid grid-cols-3 gap-1.5">
                            {images.map((img) => (
                              <button
                                key={img.id}
                                type="button"
                                aria-pressed={v.imageId === img.id}
                                aria-label={`Use image: ${img.alt || "untitled"}`}
                                className={cn(
                                  "aspect-[4/3] overflow-hidden rounded-md border-2 border-transparent bg-muted p-0 hover:border-input",
                                  v.imageId === img.id && "border-primary hover:border-primary"
                                )}
                                onClick={() => pickImage(row, img.id)}
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element -- local data URLs */}
                                <img src={img.src} alt="" className="size-full object-cover" />
                              </button>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[12.5px] text-muted-foreground">Upload images in the media gallery first.</p>
                        )}
                        {colorPart && images.length > 0 && (
                          <label className="flex cursor-pointer items-center gap-2 text-[12.5px]">
                            <Checkbox checked={pickAll} onCheckedChange={setPickAll} />
                            Use for every {colorPart.value} variant
                          </label>
                        )}
                        <div className="flex items-center justify-between text-[12.5px]">
                          <button type="button" className="font-medium text-primary hover:underline" onClick={() => pickImage(row, null)}>
                            Remove image
                          </button>
                          <button type="button" className="font-medium text-primary hover:underline" onClick={() => setPickerKey(null)}>
                            Close
                          </button>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </td>
                  <td className={dim}>
                    <input
                      value={v.sku}
                      spellCheck={false}
                      aria-label="SKU"
                      aria-invalid={showErrors && Boolean(errors.sku)}
                      title={showErrors ? errors.sku : undefined}
                      className={cn(cellInput, "font-mono text-[13px]")}
                      onChange={(event) => onUpdate([key], { sku: event.target.value })}
                      onBlur={(event) => onUpdate([key], { sku: event.target.value.trim().toUpperCase() })}
                    />
                  </td>
                  <td className={dim}>
                    <input
                      value={v.price}
                      inputMode="decimal"
                      aria-label="Price"
                      aria-invalid={showErrors && Boolean(errors.price)}
                      title={showErrors ? errors.price : undefined}
                      className={cn(cellInput, "text-right tabular-nums")}
                      onChange={(event) => onUpdate([key], { price: event.target.value })}
                    />
                  </td>
                  <td className={dim}>
                    <input
                      value={v.stock}
                      inputMode="numeric"
                      aria-label="Stock"
                      aria-invalid={showErrors && Boolean(errors.stock)}
                      title={showErrors ? errors.stock : undefined}
                      className={cn(cellInput, "text-right tabular-nums")}
                      onChange={(event) => onUpdate([key], { stock: event.target.value })}
                    />
                  </td>
                  <td>
                    <Switch
                      aria-label="Active"
                      checked={v.active}
                      className="data-checked:bg-emerald-600"
                      onCheckedChange={(checked) => onUpdate([key], { active: checked })}
                    />
                  </td>
                  <td>
                    <div className="flex items-center justify-end gap-1">
                      <Button type="button" variant="outline" size="sm" onClick={() => openConfig(row)}>
                        Configure
                      </Button>
                      {/* The default variant is the product's only sellable item, so it can't be removed. */}
                      <button
                        type="button"
                        aria-label={`Remove variant ${label}`}
                        className={cn(
                          "h-7 min-w-7 rounded-md text-[13px] text-muted-foreground hover:bg-destructive/10 hover:text-destructive",
                          parts.length === 0 && "invisible"
                        )}
                        onClick={() => onRemoveRow(key)}
                      >
                        ✕
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap justify-between gap-3 px-0.5 pt-3 text-[13px] text-muted-foreground">
        <div>
          {showErrors && <span className="font-medium text-destructive">{issues.join(" ")}</span>}{" "}
          {removedCount > 0 && (
            <>
              {removedCount} removed.{" "}
              <button type="button" className="font-medium text-primary hover:underline" onClick={onRestoreAll}>
                Restore all
              </button>
            </>
          )}
        </div>
        {rows.length > 0 && (
          <div>
            {active.length} active, {units.toLocaleString()} units in stock
            {priceRange && `, ${priceRange}`}
          </div>
        )}
      </div>

      <Dialog open={configKey !== null} onOpenChange={(open) => !open && setConfigKey(null)}>
        <DialogContent className="sm:max-w-120">
          <DialogHeader>
            <DialogTitle>Variant settings: {configRow && rowLabel(configRow.parts)}</DialogTitle>
            <DialogDescription>SKU {configRow?.v.sku || "not set"}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {(
              [
                ["compareAt", "Compare-at price (৳)", "0.00"],
                ["cost", "Cost per item (৳)", "0.00"],
                ["barcode", "Barcode (GTIN, UPC)", ""],
                ["weight", "Shipping weight (g)", "0"],
              ] as const
            ).map(([field, label, placeholder]) => (
              <div key={field}>
                <label htmlFor={`cfg-${field}`} className="mb-1.5 block text-[13px] font-medium">
                  {label}
                </label>
                <Input
                  id={`cfg-${field}`}
                  autoFocus={field === "compareAt"}
                  value={config[field]}
                  placeholder={placeholder}
                  className="h-9"
                  onChange={(event) => setConfig({ ...config, [field]: event.target.value })}
                />
              </div>
            ))}
          </div>
          <p className="text-[12.5px] text-muted-foreground">
            These aren&apos;t in the backend schema yet, so they stay in this form.
          </p>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setConfigKey(null)}>
              Cancel
            </Button>
            <Button type="button" onClick={saveConfig}>
              Save variant
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
