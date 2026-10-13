"use client"

// The Reorder rules page (demo data; alerts are live in alerts.tsx).

import { useState } from "react"
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"

import { ListTable, type ListColumn } from "@/components/list-table"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { DEMO_ITEMS, type DemoRule, type DemoSupplier } from "@/lib/inventory-demo"

import { ItemSelect, WarehouseSelect, wholeNumber } from "./doc-bits"
import { Pill, rel, WarehouseTag } from "./inventory-ui"

export function ReorderRules({ initialRules, suppliers }: { initialRules: DemoRule[]; suppliers: DemoSupplier[] }) {
  const [rules, setRules] = useState(initialRules)
  // undefined = closed, null = adding
  const [editing, setEditing] = useState<DemoRule | null | undefined>(undefined)

  const supplierName = (id: string | null) => suppliers.find((s) => s.id === id)?.name ?? "Transfer in"

  function save(rule: DemoRule) {
    if (rules.some((r) => r.id !== rule.id && r.sku === rule.sku && r.warehouse === rule.warehouse)) {
      return toast.error("That item already has a rule for this warehouse.")
    }
    setRules((current) => (current.some((r) => r.id === rule.id) ? current.map((r) => (r.id === rule.id ? rule : r)) : [...current, rule]))
    toast.success(editing ? "Rule saved" : "Rule added")
    setEditing(undefined)
  }

  const num = "text-right tabular-nums"
  const columns: ListColumn<DemoRule>[] = [
    {
      key: "item",
      header: "Item",
      cell: (r) => (
        <div>
          <div className="font-semibold">{r.name}, {r.variant}</div>
          <div className="font-mono text-xs text-muted-foreground">{r.sku}</div>
        </div>
      ),
    },
    { key: "warehouse", header: "Warehouse", cell: (r) => <WarehouseTag code={r.warehouse} /> },
    { key: "point", header: "Reorder at", className: num, cell: (r) => r.reorderPoint },
    { key: "qty", header: "Order qty", className: num, cell: (r) => r.reorderQty },
    { key: "safety", header: "Safety", className: `hidden ${num} 2xl:table-cell`, cell: (r) => r.safetyStock },
    { key: "ceiling", header: "Ceiling", className: `hidden ${num} xl:table-cell`, cell: (r) => r.maxStock ?? "—" },
    { key: "supplier", header: "Supplier", className: "hidden xl:table-cell", cell: (r) => <span className="text-muted-foreground">{supplierName(r.supplierId)}</span> },
    {
      key: "auto",
      header: "Automatic",
      cell: (r) => (
        <span className="flex flex-wrap items-center gap-1">
          {r.autoReorder ? <Pill tone="blue">Drafts a PO</Pill> : <span className="text-muted-foreground">Alert only</span>}
          {!r.isActive && <Pill tone="grey">Paused</Pill>}
        </span>
      ),
    },
    { key: "last", header: "Last triggered", className: "hidden whitespace-nowrap 2xl:table-cell", cell: (r) => <span className="text-muted-foreground">{(r.lastTriggeredAt ? rel(r.lastTriggeredAt) : "Never")}</span> },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      className: "w-20 text-right whitespace-nowrap",
      cell: (r) => (
        <>
          <Button size="icon-sm" variant="ghost" aria-label={`Edit rule for ${r.sku}`} onClick={() => setEditing(r)}>
            <PencilIcon />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            className="hover:text-destructive"
            aria-label={`Delete rule for ${r.sku}`}
            onClick={() => {
              setRules((current) => current.filter((x) => x.id !== r.id))
              toast.success("Rule deleted. Alerts fall back to the low-stock threshold.")
            }}
          >
            <Trash2Icon />
          </Button>
        </>
      ),
    },
  ]

  return (
    <>
      <ListTable
        rows={rules}
        columns={columns}
        getRowId={(r) => r.id}
        searchText={(r) => `${r.sku} ${r.name}`}
        searchPlaceholder="Search by item or SKU..."
        emptyText="No reorder rules. Add one to get warned before a shelf runs empty."
        toolbar={
          <Button size="sm" onClick={() => setEditing(null)}>
            <PlusIcon data-icon="inline-start" />
            New rule
          </Button>
        }
      />
      {editing !== undefined && (
        <RuleDialog key={editing?.id ?? "new"} rule={editing} suppliers={suppliers} onSave={save} onClose={() => setEditing(undefined)} />
      )}
    </>
  )
}

const NO_SUPPLIER = "none"

function RuleDialog({
  rule,
  suppliers,
  onSave,
  onClose,
}: {
  rule: DemoRule | null
  suppliers: DemoSupplier[]
  onSave: (rule: DemoRule) => void
  onClose: () => void
}) {
  const [sku, setSku] = useState(rule?.sku ?? DEMO_ITEMS[0].sku)
  const [warehouse, setWarehouse] = useState(rule?.warehouse ?? "MAIN")
  const [supplierId, setSupplierId] = useState(rule?.supplierId ?? NO_SUPPLIER)
  const [values, setValues] = useState({
    reorderPoint: String(rule?.reorderPoint ?? 5),
    reorderQty: String(rule?.reorderQty ?? 10),
    safetyStock: String(rule?.safetyStock ?? 0),
    maxStock: rule?.maxStock === null || rule?.maxStock === undefined ? "" : String(rule.maxStock),
  })
  const [autoReorder, setAutoReorder] = useState(rule?.autoReorder ?? false)
  const [isActive, setIsActive] = useState(rule?.isActive ?? true)
  const [error, setError] = useState("")

  const supplierItems = [{ value: NO_SUPPLIER, label: "None, replenish by transfer" }, ...suppliers.map((s) => ({ value: s.id, label: s.name }))]

  function submit() {
    const { reorderPoint, reorderQty, safetyStock, maxStock } = values
    if (![reorderPoint, reorderQty, safetyStock].every(wholeNumber) || (maxStock && !wholeNumber(maxStock))) return setError("Enter whole numbers.")
    if (Number(reorderQty) < 1) return setError("Order at least 1 unit.")
    if (maxStock && Number(maxStock) <= Number(reorderPoint)) return setError("The ceiling must be above the reorder point.")
    if (autoReorder && supplierId === NO_SUPPLIER) return setError("Choose a supplier to draft orders automatically.")
    onSave({
      ...DEMO_ITEMS.find((i) => i.sku === sku)!,
      id: rule?.id ?? crypto.randomUUID(),
      warehouse,
      reorderPoint: Number(reorderPoint),
      reorderQty: Number(reorderQty),
      safetyStock: Number(safetyStock),
      maxStock: maxStock ? Number(maxStock) : null,
      supplierId: supplierId === NO_SUPPLIER ? null : supplierId,
      autoReorder,
      isActive,
      lastTriggeredAt: rule?.lastTriggeredAt ?? null,
    })
  }

  const numberField = (key: keyof typeof values, text: string, placeholder?: string) => (
    <Field>
      <FieldLabel htmlFor={`rule-${key}`}>{text}</FieldLabel>
      <Input id={`rule-${key}`} inputMode="numeric" placeholder={placeholder} value={values[key]} onChange={(e) => setValues({ ...values, [key]: e.target.value })} />
    </Field>
  )

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{rule ? "Edit reorder rule" : "New reorder rule"}</DialogTitle>
          <DialogDescription>When available plus incoming stock drops to the reorder point, an alert is raised.</DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel>Item</FieldLabel>
            <ItemSelect value={sku} onChange={setSku} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel>Warehouse</FieldLabel>
              <WarehouseSelect sellableOnly value={warehouse} onChange={setWarehouse} />
            </Field>
            <Field>
              <FieldLabel>Supplier</FieldLabel>
              <Select value={supplierId} items={supplierItems} onValueChange={(v) => setSupplierId(v as string)}>
                <SelectTrigger aria-label="Supplier" size="sm" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {supplierItems.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {numberField("reorderPoint", "Reorder at")}
            {numberField("reorderQty", "Order qty")}
            {numberField("safetyStock", "Safety stock")}
            {numberField("maxStock", "Ceiling", "None")}
          </div>
          <div className="flex flex-wrap gap-6">
            <Field orientation="horizontal">
              <Switch id="rule-auto" checked={autoReorder} onCheckedChange={setAutoReorder} />
              <FieldLabel htmlFor="rule-auto" className="font-normal">Draft a purchase order automatically</FieldLabel>
            </Field>
            <Field orientation="horizontal">
              <Switch id="rule-active" checked={isActive} onCheckedChange={setIsActive} />
              <FieldLabel htmlFor="rule-active" className="font-normal">Rule is on</FieldLabel>
            </Field>
          </div>
        </FieldGroup>
        <DialogFooter className="items-center">
          {error && <p className="mr-auto text-[13px] font-medium text-destructive">{error}</p>}
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit}>{rule ? "Save rule" : "Add rule"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
