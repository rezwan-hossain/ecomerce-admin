"use client"

import { useState } from "react"
import { PlusIcon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"

import { ListTable, type ListColumn } from "@/components/list-table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  DEMO_ITEMS,
  type AdjustmentReason,
  type AdjustmentType,
  type DemoAdjustment,
  type DemoAdjustmentItem,
} from "@/lib/inventory-demo"
import { cn } from "@/lib/utils"

import { cellInput, DocSheet, ItemSelect, statusFilters, WarehouseSelect, wholeNumber } from "./doc-bits"
import { Card, fmtDate, label, RackTag, signed, StatusPill, WarehouseTag } from "./inventory-ui"

const TYPES: AdjustmentType[] = ["CYCLE_COUNT", "INCREASE", "DECREASE"]
const REASONS: AdjustmentReason[] = ["CYCLE_COUNT", "DAMAGE", "THEFT", "LOSS", "EXPIRY", "CORRECTION", "OPENING_STOCK", "PROMOTIONAL", "OTHER"]

const net = (a: DemoAdjustment) => a.items.reduce((sum, i) => sum + i.quantity, 0)

function nextNumber(adjustments: DemoAdjustment[]) {
  const last = Math.max(0, ...adjustments.map((a) => Number(a.adjustmentNumber.split("-").at(-1))))
  return `ADJ-${new Date().getFullYear()}-${String(last + 1).padStart(5, "0")}`
}

const newLine = (type: AdjustmentType): DemoAdjustmentItem => ({
  ...DEMO_ITEMS[0],
  id: crypto.randomUUID(),
  warehouse: "MAIN",
  rack: null,
  expected: type === "CYCLE_COUNT" ? 0 : null,
  counted: type === "CYCLE_COUNT" ? 0 : null,
  quantity: type === "DECREASE" ? -1 : type === "INCREASE" ? 1 : 0,
})

function Change({ n }: { n: number }) {
  if (n > 0) return <span className="font-bold text-emerald-700 dark:text-emerald-400">{signed(n)}</span>
  if (n < 0) return <span className="font-bold text-destructive">{signed(n)}</span>
  return <span className="text-muted-foreground">0</span>
}

export function Adjustments({ initialAdjustments }: { initialAdjustments: DemoAdjustment[] }) {
  const [adjustments, setAdjustments] = useState(initialAdjustments)
  const [openId, setOpenId] = useState<string | null>(null)
  const [draft, setDraft] = useState<DemoAdjustment | null>(null)

  const open = draft ?? adjustments.find((a) => a.id === openId) ?? null

  function save(a: DemoAdjustment, message: string) {
    const withNumber = { ...a, adjustmentNumber: a.adjustmentNumber || nextNumber(adjustments) }
    setAdjustments((current) => (current.some((x) => x.id === a.id) ? current.map((x) => (x.id === a.id ? withNumber : x)) : [withNumber, ...current]))
    setDraft(null)
    setOpenId(a.id)
    toast.success(message)
  }

  function validate(a: DemoAdjustment) {
    if (a.items.length === 0) return "Add at least one line."
    if (a.type !== "CYCLE_COUNT" && a.items.some((i) => i.quantity === 0)) return "Enter a quantity on every line."
    return ""
  }

  const columns: ListColumn<DemoAdjustment>[] = [
    {
      key: "number",
      header: "Adjustment",
      cell: (a) => (
        <button type="button" className="text-left" onClick={() => setOpenId(a.id)}>
          <span className="font-semibold text-primary hover:underline">{a.adjustmentNumber}</span>
          {a.note && <span className="block max-w-64 truncate text-xs text-muted-foreground">{a.note}</span>}
        </button>
      ),
    },
    { key: "type", header: "Type", className: "hidden md:table-cell", cell: (a) => label(a.type) },
    { key: "reason", header: "Reason", cell: (a) => label(a.reason) },
    { key: "status", header: "Status", cell: (a) => <StatusPill status={a.status} /> },
    {
      key: "where",
      header: "Where",
      className: "hidden lg:table-cell",
      cell: (a) => (
        <div className="flex gap-1">
          {[...new Set(a.items.map((i) => i.warehouse))].map((code) => (
            <WarehouseTag key={code} code={code} />
          ))}
        </div>
      ),
    },
    { key: "net", header: "Net change", className: "text-right tabular-nums", cell: (a) => <Change n={net(a)} /> },
    { key: "created", header: "Created", className: "hidden whitespace-nowrap xl:table-cell", cell: (a) => <span className="text-muted-foreground">{fmtDate(a.createdAt)}</span> },
    { key: "by", header: "By", className: "hidden xl:table-cell", cell: (a) => <span className="text-muted-foreground">{a.createdBy}</span> },
  ]

  return (
    <>
      <ListTable
        rows={adjustments}
        columns={columns}
        getRowId={(a) => a.id}
        searchText={(a) => `${a.adjustmentNumber} ${a.note} ${a.items.map((i) => i.sku).join(" ")}`}
        searchPlaceholder="Search adjustments..."
        filters={statusFilters<DemoAdjustment>([
          ["Open", ["PENDING", "APPROVED"]],
          ["Done", ["APPLIED", "REJECTED", "CANCELLED"]],
          ["All", null],
        ])}
        emptyText="No adjustments here."
        toolbar={
          <Button
            size="sm"
            onClick={() =>
              setDraft({
                id: crypto.randomUUID(), adjustmentNumber: "", type: "CYCLE_COUNT", reason: "CYCLE_COUNT", status: "PENDING",
                items: [newLine("CYCLE_COUNT")], note: "", createdBy: "You", approvedBy: null, createdAt: new Date().toISOString(),
              })
            }
          >
            <PlusIcon data-icon="inline-start" />
            New adjustment
          </Button>
        }
      />

      {open && (
        <AdjustmentSheet
          key={open.id}
          adjustment={open}
          isNew={draft !== null}
          onClose={() => {
            setDraft(null)
            setOpenId(null)
          }}
          onSave={(a) => {
            const error = validate(a)
            if (error) return toast.error(error)
            save(a, "Saved")
          }}
          onApprove={(a) => {
            const error = validate(a)
            if (error) return toast.error(error)
            save({ ...a, status: "APPROVED", approvedBy: "You" }, "Adjustment approved")
          }}
          onStatus={(status, message) => save({ ...open, status }, message)}
        />
      )}
    </>
  )
}

function AdjustmentSheet({
  adjustment: saved,
  isNew,
  onClose,
  onSave,
  onApprove,
  onStatus,
}: {
  adjustment: DemoAdjustment
  isNew: boolean
  onClose: () => void
  onSave: (a: DemoAdjustment) => void
  onApprove: (a: DemoAdjustment) => void
  onStatus: (status: DemoAdjustment["status"], message: string) => void
}) {
  // Local edits only matter while it's pending; after that the sheet shows the saved adjustment.
  const [edited, setA] = useState(saved)
  const editing = saved.status === "PENDING"
  const a = editing ? { ...edited, adjustmentNumber: saved.adjustmentNumber } : saved
  const count = a.type === "CYCLE_COUNT"

  function updateLine(id: string, patch: Partial<DemoAdjustmentItem>) {
    setA({ ...a, items: a.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) })
  }

  // Typing a count or a quantity updates the signed change.
  function setAmount(i: DemoAdjustmentItem, raw: string) {
    if (!wholeNumber(raw || "0")) return
    const n = Number(raw)
    if (count) updateLine(i.id, { counted: n, quantity: n - (i.expected ?? 0) })
    else updateLine(i.id, { quantity: a.type === "DECREASE" ? -n : n })
  }

  function changeType(type: AdjustmentType) {
    // Keeps each line's item and place; only the amounts start over.
    const fresh = newLine(type)
    const items = a.items.map((i) => ({ ...i, expected: fresh.expected, counted: fresh.counted, quantity: fresh.quantity }))
    setA({ ...a, type, reason: type === "CYCLE_COUNT" ? "CYCLE_COUNT" : a.reason, items })
  }

  let footer: React.ReactNode
  if (a.status === "PENDING") {
    footer = (
      <>
        {!isNew && <Button variant="ghost" className="text-destructive" onClick={() => onStatus("CANCELLED", "Adjustment cancelled")}>Cancel</Button>}
        {!isNew && <Button variant="ghost" onClick={() => onStatus("REJECTED", "Adjustment rejected")}>Reject</Button>}
        <span className="flex-1" />
        <Button variant="outline" onClick={() => onSave(a)}>Save</Button>
        <Button onClick={() => onApprove(a)}>Approve</Button>
      </>
    )
  } else if (a.status === "APPROVED") {
    footer = (
      <>
        <Button variant="ghost" className="text-destructive" onClick={() => onStatus("CANCELLED", "Adjustment cancelled")}>Cancel</Button>
        <span className="flex-1" />
        <Button onClick={() => onStatus("APPLIED", "Applied. Stock and the ledger are updated.")}>Apply to stock</Button>
      </>
    )
  } else {
    footer = (
      <>
        <span className="flex-1" />
        <Button variant="outline" onClick={onClose}>Done</Button>
      </>
    )
  }

  const typeItems = TYPES.map((t) => ({ value: t, label: label(t) }))
  const reasonItems = REASONS.map((r) => ({ value: r, label: label(r) }))

  return (
    <DocSheet kind="Stock adjustment" title={a.adjustmentNumber || "New adjustment"} status={a.status} footer={footer} onClose={onClose}>
      <section className="flex flex-wrap gap-x-7 gap-y-3 rounded-xl border bg-card px-4 py-3.5">
        <div className="min-w-44">
          <span className="mb-1 block text-xs text-muted-foreground">Type</span>
          {editing ? (
            <Select value={a.type} items={typeItems} onValueChange={(v) => changeType(v as AdjustmentType)}>
              <SelectTrigger aria-label="Type" size="sm" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {typeItems.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          ) : (
            <div className="font-semibold">{label(a.type)}</div>
          )}
        </div>
        <div className="min-w-44">
          <span className="mb-1 block text-xs text-muted-foreground">Reason</span>
          {editing ? (
            <Select value={a.reason} items={reasonItems} onValueChange={(v) => setA({ ...a, reason: v as AdjustmentReason })}>
              <SelectTrigger aria-label="Reason" size="sm" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {reasonItems.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
          ) : (
            <div className="font-semibold">{label(a.reason)}</div>
          )}
        </div>
        <p className="basis-full text-[12.5px] text-muted-foreground">
          Created {fmtDate(a.createdAt)} by {a.createdBy}
          {a.approvedBy && ` · approved by ${a.approvedBy}`}
        </p>
      </section>

      {count && editing && (
        <p className="rounded-md bg-primary/10 px-3 py-2.5 text-[13px] text-primary">
          Enter what you physically counted. The change is counted minus expected.
        </p>
      )}

      <Card title="Lines">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="text-left text-xs text-muted-foreground">
              <tr className="border-y [&>th]:px-3 [&>th]:py-2 [&>th]:font-medium">
                <th>Item</th>
                <th>Warehouse</th>
                <th>Rack</th>
                {count && <th className="text-right">Expected</th>}
                <th className="text-right">{count ? "Counted" : "Quantity"}</th>
                <th className="text-right">Change</th>
                {editing && <th />}
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {a.items.map((i) => (
                <tr key={i.id} className="border-b last:border-b-0 [&>td]:px-3 [&>td]:py-2">
                  <td>
                    {editing ? (
                      <ItemSelect value={i.sku} onChange={(sku) => updateLine(i.id, DEMO_ITEMS.find((d) => d.sku === sku)!)} />
                    ) : (
                      <div>
                        <div className="font-semibold">{i.name}, {i.variant}</div>
                        <div className="font-mono text-xs text-muted-foreground">{i.sku}</div>
                      </div>
                    )}
                  </td>
                  <td>{editing ? <WarehouseSelect value={i.warehouse} onChange={(code) => updateLine(i.id, { warehouse: code })} /> : <WarehouseTag code={i.warehouse} />}</td>
                  <td>
                    {editing ? (
                      <Input aria-label="Rack" placeholder="Whole warehouse" className="h-8 w-32 font-mono uppercase" value={i.rack ?? ""} onChange={(e) => updateLine(i.id, { rack: e.target.value.toUpperCase() || null })} />
                    ) : i.rack ? (
                      <RackTag code={i.rack} />
                    ) : (
                      <span className="text-muted-foreground">Whole warehouse</span>
                    )}
                  </td>
                  {count && (
                    <td className="text-right">
                      {editing ? (
                        <Input aria-label="Expected" inputMode="numeric" className={cn(cellInput, "ml-auto")} value={i.expected ?? 0} onChange={(e) => wholeNumber(e.target.value || "0") && updateLine(i.id, { expected: Number(e.target.value), quantity: (i.counted ?? 0) - Number(e.target.value) })} />
                      ) : (
                        i.expected
                      )}
                    </td>
                  )}
                  <td className="text-right">
                    {editing ? (
                      <Input aria-label={count ? "Counted" : "Quantity"} inputMode="numeric" className={cn(cellInput, "ml-auto")} value={count ? (i.counted ?? 0) : Math.abs(i.quantity)} onChange={(e) => setAmount(i, e.target.value)} />
                    ) : count ? (
                      i.counted
                    ) : (
                      Math.abs(i.quantity)
                    )}
                  </td>
                  <td className="text-right"><Change n={i.quantity} /></td>
                  {editing && (
                    <td className="w-10">
                      <Button size="icon-sm" variant="ghost" aria-label="Remove line" onClick={() => setA({ ...a, items: a.items.filter((x) => x.id !== i.id) })}>
                        <Trash2Icon />
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {editing && (
          <div className="border-t px-4 py-2.5">
            <Button size="sm" variant="outline" onClick={() => setA({ ...a, items: [...a.items, newLine(a.type)] })}>
              <PlusIcon data-icon="inline-start" />
              Add line
            </Button>
          </div>
        )}
      </Card>

      <Card title="Note">
        <div className="px-4 pb-4">
          {editing ? (
            <Textarea rows={2} placeholder="What happened" value={a.note} onChange={(e) => setA({ ...a, note: e.target.value })} />
          ) : (
            <p className="text-muted-foreground">{a.note || "No note."}</p>
          )}
        </div>
      </Card>
    </DocSheet>
  )
}
