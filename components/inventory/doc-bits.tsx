"use client"

// Pieces shared by the document pages (purchase orders, transfers, adjustments).

import { XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { DEMO_ITEMS, DEMO_WAREHOUSES, type DemoItem } from "@/lib/inventory-demo"
import { cn } from "@/lib/utils"

import { n0, StatusPill } from "./inventory-ui"

// The side panel every document opens in: kind and number on top, actions in the footer.
export function DocSheet({
  kind,
  title,
  status,
  badge,
  narrow,
  footer,
  children,
  onClose,
}: {
  kind: string
  title: string
  status?: string
  badge?: React.ReactNode // shown next to the title instead of a status
  narrow?: boolean // forms need less room than documents with line tables
  footer: React.ReactNode
  children: React.ReactNode
  onClose: () => void
}) {
  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        showCloseButton={false}
        className={cn(
          "w-full gap-0 border-l-0 bg-sidebar shadow-[-20px_0_60px_rgba(10,14,22,0.22)]",
          narrow ? "data-[side=right]:sm:max-w-3xl" : "data-[side=right]:sm:max-w-5xl"
        )}
      >
        <SheetHeader className="flex-row items-center gap-3 border-b bg-card px-5 py-3">
          <SheetClose render={<Button variant="ghost" size="icon-sm" className="shrink-0" />}>
            <XIcon />
            <span className="sr-only">Close</span>
          </SheetClose>
          <div className="min-w-0 flex-1">
            <SheetDescription className="text-[12.5px] leading-tight">{kind}</SheetDescription>
            <SheetTitle className="truncate text-[21px] leading-snug font-bold tracking-tight">{title}</SheetTitle>
          </div>
          {status && <StatusPill status={status} />}
          {badge}
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-5 pt-[18px] pb-7 text-sm *:shrink-0">{children}</div>
        <SheetFooter className="flex-row flex-wrap items-center gap-2 border-t bg-card px-5 py-3">{footer}</SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

const itemLabel = (i: DemoItem) => `${i.name}, ${i.variant}`

// Type part of a name or SKU to find an item; picking from the list keeps every line tied to a real SKU.
export function ItemSelect({ value, onChange }: { value: string; onChange: (sku: string) => void }) {
  const selected = DEMO_ITEMS.find((i) => i.sku === value) ?? null
  return (
    <Combobox
      items={DEMO_ITEMS}
      autoHighlight
      value={selected}
      onValueChange={(item) => item && onChange((item as DemoItem).sku)}
      itemToStringLabel={(item) => itemLabel(item as DemoItem)}
      filter={(item: DemoItem, query) => {
        const q = query.trim().toLowerCase()
        // While the box still shows the picked item, list everything.
        if (!q || (selected && q === itemLabel(selected).toLowerCase())) return true
        return `${itemLabel(item)} ${item.sku}`.toLowerCase().includes(q)
      }}
    >
      <ComboboxInput aria-label="Item" placeholder="Search name or SKU..." className="h-8 w-full min-w-56" />
      <ComboboxContent className="min-w-80">
        <ComboboxEmpty>No item matches.</ComboboxEmpty>
        <ComboboxList>
          {(item: DemoItem) => (
            <ComboboxItem key={item.sku} value={item}>
              <span className="min-w-0">
                <span className="block truncate">{itemLabel(item)}</span>
                <span className="block truncate font-mono text-[11px] text-muted-foreground">{item.sku}</span>
              </span>
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}

// A real variant for live document lines: "Product, Red / XL" and its SKU.
export type VariantOption = { id: string; sku: string; label: string }

// Type part of a name or SKU; picking ties the line to a real variant.
export function VariantSelect({ options, value, onChange }: { options: VariantOption[]; value: string; onChange: (id: string) => void }) {
  const selected = options.find((o) => o.id === value) ?? null
  return (
    <Combobox
      items={options}
      autoHighlight
      value={selected}
      onValueChange={(item) => item && onChange((item as VariantOption).id)}
      itemToStringLabel={(item) => (item as VariantOption).label}
      filter={(item: VariantOption, query) => {
        const q = query.trim().toLowerCase()
        // While the box still shows the picked item, list everything.
        if (!q || (selected && q === selected.label.toLowerCase())) return true
        return `${item.label} ${item.sku}`.toLowerCase().includes(q)
      }}
    >
      <ComboboxInput aria-label="Item" placeholder="Search name or SKU..." className="h-8 w-full min-w-56" />
      <ComboboxContent className="min-w-80">
        <ComboboxEmpty>No item matches.</ComboboxEmpty>
        <ComboboxList>
          {(item: VariantOption) => (
            <ComboboxItem key={item.id} value={item}>
              <span className="min-w-0">
                <span className="block truncate">{item.label}</span>
                <span className="block truncate font-mono text-[11px] text-muted-foreground">{item.sku}</span>
              </span>
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}

export function WarehouseSelect({
  value,
  onChange,
  sellableOnly,
  label = "Warehouse",
}: {
  value: string
  onChange: (code: string) => void
  sellableOnly?: boolean
  label?: string
}) {
  const options = DEMO_WAREHOUSES.filter((w) => !sellableOnly || w.type === "PHYSICAL" || w.type === "STORE").map((w) => ({
    value: w.code,
    label: w.code,
  }))
  return (
    <Select value={value} items={options} onValueChange={(v) => onChange(v as string)}>
      <SelectTrigger aria-label={label} size="sm" className="w-full min-w-28">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

// Received (green) and damaged (red) out of the total, with "x of y".
export function Progress({ done, damaged = 0, total }: { done: number; damaged?: number; total: number }) {
  const pct = (n: number) => `${total ? (n / total) * 100 : 0}%`
  return (
    <div className="flex min-w-32 items-center gap-2">
      <div className="flex h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <i className="block h-full bg-emerald-600" style={{ width: pct(done) }} />
        <i className="block h-full bg-red-600" style={{ width: pct(damaged) }} />
      </div>
      <span className="text-[12.5px] whitespace-nowrap text-muted-foreground">
        {n0(done)} of {n0(total)}
      </span>
    </div>
  )
}

export const cellInput = "h-8 w-20 text-right tabular-nums"

export const wholeNumber = (s: string) => /^\d+$/.test(s.trim())

// Filter tabs built from groups of statuses: { label, statuses }.
export function statusFilters<T extends { status: string }>(groups: [string, string[] | null][]) {
  return groups.map(([text, statuses]) => ({
    label: text,
    value: text.toLowerCase().replace(/\s+/g, "-"),
    match: (row: T) => statuses === null || statuses.includes(row.status),
  }))
}
