"use client"

// Pieces shared by the demo document pages (purchase orders, transfers, adjustments).

import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { DEMO_ITEMS, DEMO_WAREHOUSES } from "@/lib/inventory-demo"
import { cn } from "@/lib/utils"

import { n0, StatusPill } from "./inventory-ui"

// The side panel every document opens in: kind and number on top, actions in the footer.
export function DocSheet({
  kind,
  title,
  status,
  badge,
  footer,
  children,
  onClose,
}: {
  kind: string
  title: string
  status?: string
  badge?: React.ReactNode // shown next to the title instead of a status
  footer: React.ReactNode
  children: React.ReactNode
  onClose: () => void
}) {
  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full gap-0 bg-muted/50 data-[side=right]:sm:max-w-3xl">
        <SheetHeader className="border-b bg-card">
          <SheetDescription>{kind}</SheetDescription>
          <div className="flex items-center gap-3 pr-8">
            <SheetTitle className="text-xl">{title}</SheetTitle>
            {status && <StatusPill status={status} />}
            {badge}
          </div>
        </SheetHeader>
        <div className="flex-1 space-y-4 overflow-y-auto p-4 text-sm">{children}</div>
        <SheetFooter className="flex-row flex-wrap items-center gap-2 border-t bg-card">{footer}</SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

const itemOptions = DEMO_ITEMS.map((i) => ({ value: i.sku, label: `${i.name}, ${i.variant}` }))

export function ItemSelect({ value, onChange }: { value: string; onChange: (sku: string) => void }) {
  return (
    <Select value={value} items={itemOptions} onValueChange={(v) => onChange(v as string)}>
      <SelectTrigger aria-label="Item" size="sm" className="w-full min-w-48">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {itemOptions.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
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

export type ReceiveLine = { id: string; label: string; remaining: number }

// "Receive items": good and damaged units per line, each up to what's left.
export function ReceiveDialog({
  title,
  description,
  lines,
  onReceive,
  onClose,
}: {
  title: string
  description: string
  lines: ReceiveLine[]
  onReceive: (counts: Record<string, { good: number; damaged: number }>) => void
  onClose: () => void
}) {
  const [values, setValues] = useState<Record<string, { good: string; damaged: string }>>(
    Object.fromEntries(lines.map((l) => [l.id, { good: String(l.remaining), damaged: "0" }]))
  )
  const [error, setError] = useState("")

  function submit() {
    const counts: Record<string, { good: number; damaged: number }> = {}
    for (const line of lines) {
      const v = values[line.id]
      if (!wholeNumber(v.good) || !wholeNumber(v.damaged)) return setError("Enter whole numbers.")
      const good = Number(v.good)
      const damaged = Number(v.damaged)
      if (good + damaged > line.remaining) return setError(`${line.label}: only ${line.remaining} left to receive.`)
      counts[line.id] = { good, damaged }
    }
    if (Object.values(counts).every((c) => c.good + c.damaged === 0)) return setError("Enter a quantity for at least one line.")
    onReceive(counts)
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr className="border-b [&>th]:py-2 [&>th]:font-medium">
              <th>Item</th>
              <th className="text-right">Left</th>
              <th className="text-right">Good</th>
              <th className="text-right">Damaged</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.id} className="border-b last:border-b-0 [&>td]:py-2">
                <td className="pr-3">{line.label}</td>
                <td className="text-right tabular-nums">{line.remaining}</td>
                {(["good", "damaged"] as const).map((field) => (
                  <td key={field} className="pl-2 text-right">
                    <Input
                      aria-label={`${field === "good" ? "Good" : "Damaged"} units of ${line.label}`}
                      inputMode="numeric"
                      className={cn(cellInput, "ml-auto")}
                      value={values[line.id][field]}
                      onChange={(e) => {
                        setValues({ ...values, [line.id]: { ...values[line.id], [field]: e.target.value } })
                        setError("")
                      }}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <DialogFooter className="items-center">
          {error && <p className="mr-auto text-[13px] font-medium text-destructive">{error}</p>}
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit}>Receive</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Filter tabs built from groups of statuses: { label, statuses }.
export function statusFilters<T extends { status: string }>(groups: [string, string[] | null][]) {
  return groups.map(([text, statuses]) => ({
    label: text,
    value: text.toLowerCase().replace(/\s+/g, "-"),
    match: (row: T) => statuses === null || statuses.includes(row.status),
  }))
}
