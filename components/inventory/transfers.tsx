"use client"

import { useState } from "react"
import { ArrowRightIcon, PlusIcon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"

import { ListTable, type ListColumn } from "@/components/list-table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { DEMO_ITEMS, type DemoTransfer, type DemoTransferItem } from "@/lib/inventory-demo"
import { cn } from "@/lib/utils"

import { cellInput, DocSheet, ItemSelect, Progress, ReceiveDialog, statusFilters, WarehouseSelect, wholeNumber } from "./doc-bits"
import { Card, fmtDate, StatusPill, WarehouseTag } from "./inventory-ui"

const remaining = (i: DemoTransferItem) => i.sentQty - i.receivedQty - i.damagedQty
const now = () => new Date().toISOString()

function nextNumber(transfers: DemoTransfer[]) {
  const last = Math.max(0, ...transfers.map((t) => Number(t.transferNumber.split("-").at(-1))))
  return `TRF-${new Date().getFullYear()}-${String(last + 1).padStart(5, "0")}`
}

const newLine = (): DemoTransferItem => ({ ...DEMO_ITEMS[0], id: crypto.randomUUID(), sentQty: 1, receivedQty: 0, damagedQty: 0 })

function Route({ from, to }: { from: string; to: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <WarehouseTag code={from} />
      <ArrowRightIcon className="size-3 text-muted-foreground" />
      <WarehouseTag code={to} />
    </span>
  )
}

export function Transfers({ initialTransfers }: { initialTransfers: DemoTransfer[] }) {
  const [transfers, setTransfers] = useState(initialTransfers)
  const [openId, setOpenId] = useState<string | null>(null)
  const [draft, setDraft] = useState<DemoTransfer | null>(null)
  const [receiving, setReceiving] = useState(false)

  const open = draft ?? transfers.find((t) => t.id === openId) ?? null

  function save(t: DemoTransfer, message: string) {
    setTransfers((current) => (current.some((x) => x.id === t.id) ? current.map((x) => (x.id === t.id ? t : x)) : [t, ...current]))
    setDraft(null)
    setOpenId(t.id)
    toast.success(message)
  }

  function approve(t: DemoTransfer) {
    if (t.from === t.to) return toast.error("Source and destination must be different warehouses.")
    if (t.items.length === 0) return toast.error("Add at least one line.")
    if (new Set(t.items.map((i) => i.sku)).size !== t.items.length) return toast.error("An item is listed twice.")
    save({ ...t, transferNumber: t.transferNumber || nextNumber(transfers), status: "PENDING" }, "Transfer approved")
  }

  function receive(t: DemoTransfer, counts: Record<string, { good: number; damaged: number }>) {
    const items = t.items.map((i) => ({
      ...i,
      receivedQty: i.receivedQty + (counts[i.id]?.good ?? 0),
      damagedQty: i.damagedQty + (counts[i.id]?.damaged ?? 0),
    }))
    const done = items.every((i) => remaining(i) <= 0)
    save({ ...t, items, status: done ? "COMPLETED" : "PARTIAL", receivedAt: done ? now() : null }, done ? "Everything received at the destination." : "Received. Some units are still on the way.")
    setReceiving(false)
  }

  const columns: ListColumn<DemoTransfer>[] = [
    {
      key: "number",
      header: "Transfer",
      cell: (t) => (
        <button type="button" className="text-left" onClick={() => setOpenId(t.id)}>
          <span className="font-semibold text-primary hover:underline">{t.transferNumber}</span>
          {t.note && <span className="block max-w-64 truncate text-xs text-muted-foreground">{t.note}</span>}
        </button>
      ),
    },
    { key: "route", header: "Route", cell: (t) => <Route from={t.from} to={t.to} /> },
    { key: "status", header: "Status", cell: (t) => <StatusPill status={t.status} /> },
    { key: "lines", header: "Lines", className: "hidden text-right md:table-cell", cell: (t) => t.items.length },
    {
      key: "received",
      header: "Received",
      className: "hidden md:table-cell",
      cell: (t) => (
        <Progress
          done={t.items.reduce((s, i) => s + i.receivedQty, 0)}
          damaged={t.items.reduce((s, i) => s + i.damagedQty, 0)}
          total={t.items.reduce((s, i) => s + i.sentQty, 0)}
        />
      ),
    },
    { key: "shipped", header: "Shipped", className: "hidden whitespace-nowrap lg:table-cell", cell: (t) => <span className="text-muted-foreground">{(t.shippedAt ? fmtDate(t.shippedAt) : "Not yet")}</span> },
    { key: "by", header: "Started by", className: "hidden xl:table-cell", cell: (t) => <span className="text-muted-foreground">{t.initiatedBy}</span> },
  ]

  return (
    <>
      <ListTable
        rows={transfers}
        columns={columns}
        getRowId={(t) => t.id}
        searchText={(t) => `${t.transferNumber} ${t.from} ${t.to} ${t.note} ${t.items.map((i) => i.sku).join(" ")}`}
        searchPlaceholder="Search transfers..."
        filters={statusFilters<DemoTransfer>([
          ["Open", ["DRAFT", "PENDING", "IN_TRANSIT", "PARTIAL"]],
          ["On the way", ["IN_TRANSIT", "PARTIAL"]],
          ["Done", ["COMPLETED", "CANCELLED"]],
          ["All", null],
        ])}
        emptyText="No transfers here."
        toolbar={
          <Button
            size="sm"
            onClick={() =>
              setDraft({
                id: crypto.randomUUID(), transferNumber: "", from: "MAIN", to: "CTG-STORE", status: "DRAFT", items: [newLine()],
                shippedAt: null, receivedAt: null, note: "", initiatedBy: "You", createdAt: now(),
              })
            }
          >
            <PlusIcon data-icon="inline-start" />
            New transfer
          </Button>
        }
      />

      {open && (
        <TransferSheet
          key={open.id}
          transfer={open}
          isNew={draft !== null}
          onClose={() => {
            setDraft(null)
            setOpenId(null)
          }}
          onSave={(t) => save({ ...t, transferNumber: open.transferNumber || nextNumber(transfers) }, "Draft saved")}
          onApprove={(t) => approve({ ...t, transferNumber: open.transferNumber })}
          onShip={() => save({ ...open, status: "IN_TRANSIT", shippedAt: now() }, "Shipped. Stock left the source warehouse.")}
          onCancel={() => save({ ...open, status: "CANCELLED" }, "Transfer cancelled")}
          onReceive={() => setReceiving(true)}
          onDelete={() => {
            setTransfers((current) => current.filter((t) => t.id !== open.id))
            setOpenId(null)
            toast.success("Draft deleted")
          }}
        />
      )}
      {receiving && open && (
        <ReceiveDialog
          title={`Receive ${open.transferNumber}`}
          description={`Arriving at ${open.to} from ${open.from}.`}
          lines={open.items.filter((i) => remaining(i) > 0).map((i) => ({ id: i.id, label: `${i.name}, ${i.variant}`, remaining: remaining(i) }))}
          onReceive={(counts) => receive(open, counts)}
          onClose={() => setReceiving(false)}
        />
      )}
    </>
  )
}

function TransferSheet({
  transfer: saved,
  isNew,
  onClose,
  onSave,
  onApprove,
  onShip,
  onCancel,
  onReceive,
  onDelete,
}: {
  transfer: DemoTransfer
  isNew: boolean
  onClose: () => void
  onSave: (t: DemoTransfer) => void
  onApprove: (t: DemoTransfer) => void
  onShip: () => void
  onCancel: () => void
  onReceive: () => void
  onDelete: () => void
}) {
  // Local edits only matter while it's a draft; after that the sheet shows the saved transfer.
  const [edited, setT] = useState(saved)
  const editing = saved.status === "DRAFT"
  const t = editing ? { ...edited, transferNumber: saved.transferNumber } : saved

  function updateLine(id: string, patch: Partial<DemoTransferItem>) {
    setT({ ...t, items: t.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) })
  }

  let footer: React.ReactNode
  if (t.status === "DRAFT") {
    footer = (
      <>
        {!isNew && <Button variant="ghost" className="text-destructive" onClick={onDelete}>Delete draft</Button>}
        <span className="flex-1" />
        <Button variant="outline" onClick={() => onSave(t)}>Save draft</Button>
        <Button onClick={() => onApprove(t)}>Approve</Button>
      </>
    )
  } else if (t.status === "PENDING") {
    footer = (
      <>
        <Button variant="ghost" className="text-destructive" onClick={onCancel}>Cancel transfer</Button>
        <span className="flex-1" />
        <Button onClick={onShip}>Ship now</Button>
      </>
    )
  } else if (t.status === "IN_TRANSIT" || t.status === "PARTIAL") {
    footer = (
      <>
        <span className="flex-1" />
        <Button onClick={onReceive}>Receive at destination</Button>
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

  return (
    <DocSheet kind="Transfer" title={t.transferNumber || "New transfer"} status={t.status} footer={footer} onClose={onClose}>
      <section className="flex flex-wrap gap-x-7 gap-y-3 rounded-xl border bg-card px-4 py-3.5">
        {editing ? (
          <>
            <div className="min-w-40">
              <span className="mb-1 block text-xs text-muted-foreground">From</span>
              <WarehouseSelect value={t.from} label="From warehouse" onChange={(code) => setT({ ...t, from: code })} />
            </div>
            <div className="min-w-40">
              <span className="mb-1 block text-xs text-muted-foreground">To</span>
              <WarehouseSelect value={t.to} label="To warehouse" onChange={(code) => setT({ ...t, to: code })} />
            </div>
          </>
        ) : (
          <div>
            <span className="block text-xs text-muted-foreground">Route</span>
            <Route from={t.from} to={t.to} />
          </div>
        )}
        <p className="basis-full text-[12.5px] text-muted-foreground">
          Started {fmtDate(t.createdAt)} by {t.initiatedBy}
          {t.shippedAt && ` · shipped ${fmtDate(t.shippedAt)}`}
          {t.receivedAt && ` · received ${fmtDate(t.receivedAt)}`}
        </p>
      </section>

      <Card title="Lines">
        <table className="w-full">
          <thead className="text-left text-xs text-muted-foreground">
            <tr className="border-y [&>th]:px-3 [&>th]:py-2 [&>th]:font-medium">
              <th>Item</th>
              <th className="text-right">Sending</th>
              {!editing && <th className="text-right">Received</th>}
              {!editing && <th className="text-right">Damaged</th>}
              {editing && <th />}
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {t.items.map((i) => (
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
                <td className="text-right">
                  {editing ? (
                    <Input aria-label="Quantity" inputMode="numeric" className={cn(cellInput, "ml-auto")} value={i.sentQty} onChange={(e) => wholeNumber(e.target.value || "0") && updateLine(i.id, { sentQty: Number(e.target.value) })} />
                  ) : (
                    i.sentQty
                  )}
                </td>
                {!editing && <td className="text-right">{i.receivedQty}</td>}
                {!editing && <td className="text-right">{i.damagedQty ? <span className="font-semibold text-destructive">{i.damagedQty}</span> : <span className="text-muted-foreground">0</span>}</td>}
                {editing && (
                  <td className="w-10">
                    <Button size="icon-sm" variant="ghost" aria-label="Remove line" onClick={() => setT({ ...t, items: t.items.filter((x) => x.id !== i.id) })}>
                      <Trash2Icon />
                    </Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {editing && (
          <div className="border-t px-4 py-2.5">
            <Button size="sm" variant="outline" onClick={() => setT({ ...t, items: [...t.items, newLine()] })}>
              <PlusIcon data-icon="inline-start" />
              Add line
            </Button>
          </div>
        )}
      </Card>

      <Card title="Note">
        <div className="px-4 pb-4">
          {editing ? (
            <Textarea rows={2} placeholder="Why this stock is moving" value={t.note} onChange={(e) => setT({ ...t, note: e.target.value })} />
          ) : (
            <p className="text-muted-foreground">{t.note || "No note."}</p>
          )}
        </div>
      </Card>
    </DocSheet>
  )
}
