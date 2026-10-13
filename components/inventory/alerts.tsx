"use client"

import Link from "next/link"
import { useState } from "react"
import { BellOffIcon, LoaderIcon, RefreshCwIcon } from "lucide-react"
import { toast } from "sonner"

import { alertAction, getAlerts, getAlertSummary, scanAlerts } from "@/app/actions/inventory-alert.actions"
import { ListTable, type ListColumn } from "@/components/list-table"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { cn } from "@/lib/utils"
import type { AlertStatus, AlertSummary, AlertType, InventoryAlert } from "@/types/inventory-alert.type"

import { Card, fmtDate, Kpis, label, n0, Pill, rel, StatusPill, type Tone, WarehouseTag } from "./inventory-ui"

const ALERT_TONE: Record<AlertType, Tone> = {
  OUT_OF_STOCK: "red",
  LOW_STOCK: "amber",
  EXPIRING_SOON: "amber",
  OVERSTOCK: "blue",
  NEGATIVE_STOCK: "red",
  REORDER_TRIGGERED: "blue",
}
const TYPE_LABEL: Record<AlertType, string> = {
  OUT_OF_STOCK: "Out of stock",
  LOW_STOCK: "Low stock",
  EXPIRING_SOON: "Expiring soon",
  OVERSTOCK: "Overstock",
  NEGATIVE_STOCK: "Negative stock",
  REORDER_TRIGGERED: "Reorder",
}
// The status filter asks the server; OPEN = active and acknowledged.
const STATUSES: { value: AlertStatus | "OPEN" | "ALL"; text: string }[] = [
  { value: "OPEN", text: "Open" },
  { value: "ACTIVE", text: "Active" },
  { value: "ACKNOWLEDGED", text: "Acknowledged" },
  { value: "RESOLVED", text: "Resolved" },
  { value: "DISMISSED", text: "Dismissed" },
  { value: "ALL", text: "All" },
]
const ALL = "all"
const HELP = {
  acknowledge: "I'm on it. The alert stays open and still resolves by itself.",
  resolve: "Close it now. If stock is still low, the next stock change raises a fresh alert.",
  dismiss: "Ignore this occurrence. No new alert for the same item and place until the condition clears and comes back.",
}

export function Alerts({ initialAlerts, initialSummary }: { initialAlerts: InventoryAlert[]; initialSummary: AlertSummary | null }) {
  const [alerts, setAlerts] = useState(initialAlerts)
  const [summary, setSummary] = useState(initialSummary)
  const [status, setStatus] = useState<(typeof STATUSES)[number]["value"]>("OPEN")
  const [type, setType] = useState(ALL)
  const [warehouse, setWarehouse] = useState(ALL)
  const [busy, setBusy] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [scanning, setScanning] = useState<"confirm" | "running" | null>(null)

  async function reload(next = status) {
    setLoading(true)
    const [list, counts] = await Promise.all([getAlerts(next === "ALL" ? null : next), getAlertSummary()])
    setLoading(false)
    if (list.success) setAlerts(list.data)
    else toast.error(list.error)
    if (counts.success) setSummary(counts.data)
  }

  async function changeStatus(next: (typeof STATUSES)[number]["value"]) {
    setStatus(next)
    await reload(next)
  }

  async function act(alert: InventoryAlert, action: "acknowledge" | "resolve" | "dismiss") {
    setBusy(alert.id)
    const res = await alertAction(alert.id, action)
    setBusy(null)
    // A 409 usually means it resolved itself meanwhile; reloading shows where it is now.
    if (!res.success) toast.error(res.error)
    else toast.success(`${alert.variant.sku}: alert ${action === "dismiss" ? "dismissed" : `${action}d`}`)
    await reload()
  }

  async function scan() {
    setScanning("running")
    const res = await scanAlerts()
    setScanning(null)
    if (!res.success) return toast.error(res.error)
    const r = res.data
    toast.success(`Checked ${n0(r.variantsChecked)} variants`, {
      description: `${n0(r.created)} new, ${n0(r.updated)} updated, ${n0(r.resolved)} resolved.`,
    })
    await reload()
  }

  const warehouses = [...new Map(alerts.flatMap((a) => (a.warehouse ? [[a.warehouse.id, a.warehouse] as const] : []))).values()]
  const visible = alerts.filter(
    (a) =>
      (type === ALL || a.type === type) &&
      (warehouse === ALL || (warehouse === "store" ? a.warehouseId === null : a.warehouseId === warehouse))
  )
  const typeItems = [{ value: ALL, label: "All types" }, ...Object.entries(TYPE_LABEL).map(([value, text]) => ({ value, label: text }))]
  const warehouseItems = [
    { value: ALL, label: "Everywhere" },
    { value: "store", label: "Store-wide" },
    ...warehouses.map((w) => ({ value: w.id, label: w.code })),
  ]

  const columns: ListColumn<InventoryAlert>[] = [
    { key: "type", header: "Type", cell: (a) => <Pill tone={ALERT_TONE[a.type]}>{TYPE_LABEL[a.type]}</Pill> },
    {
      key: "alert",
      header: "Alert",
      cell: (a) => (
        <div className="max-w-md min-w-56">
          <div className="font-semibold">{a.title}</div>
          {a.message && <div className="text-[12.5px] text-muted-foreground">{a.message}</div>}
          <Link href="/inventory/stock" className="mt-0.5 inline-flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground hover:text-primary">
            <span className="font-mono">{a.variant.sku}</span>
            <span>
              · {a.variant.productName}
              {a.variant.label && `, ${a.variant.label}`}
            </span>
          </Link>
          {a.metadata?.reorderPoint !== undefined && (
            <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs">
              <span className="text-muted-foreground">
                Reorder point {n0(a.metadata.reorderPoint)}, reorder qty {n0(a.metadata.reorderQty ?? 0)}, {n0(a.metadata.incoming ?? 0)} incoming
              </span>
              <Link href="/inventory/purchase-orders" className="font-medium text-primary hover:underline">
                Create purchase order
              </Link>
            </div>
          )}
          {a.metadata?.batches && a.metadata.batches.length > 0 && (
            <ul className="mt-1 flex flex-col gap-0.5 text-xs">
              {a.metadata.batches.map((b) => (
                <li key={b.id} className="flex flex-wrap items-center gap-1.5 text-muted-foreground">
                  <span className="font-mono text-foreground">{b.batchNumber}</span>· {n0(b.quantity)} units · expires {fmtDate(b.expiresAt)}
                  {b.expired && <Pill tone="red">Expired</Pill>}
                </li>
              ))}
            </ul>
          )}
        </div>
      ),
    },
    {
      key: "where",
      header: "Where",
      className: "hidden md:table-cell",
      cell: (a) => (a.warehouse ? <WarehouseTag code={a.warehouse.code} /> : <span className="text-muted-foreground">All warehouses</span>),
    },
    {
      key: "stock",
      header: "Stock / threshold",
      className: "hidden text-right tabular-nums lg:table-cell",
      cell: (a) => (
        <span>
          <span className={cn("font-semibold", a.currentStock <= 0 && "text-destructive")}>{n0(a.currentStock)}</span>
          <span className="text-muted-foreground"> / {a.threshold === null ? "—" : n0(a.threshold)}</span>
        </span>
      ),
    },
    {
      key: "raised",
      header: "Raised",
      className: "hidden whitespace-nowrap 2xl:table-cell",
      cell: (a) => (
        <span className="flex flex-col text-muted-foreground" title={fmtDate(a.createdAt)}>
          {rel(a.createdAt)}
          {a.resolvedAt && <span className="text-xs">cleared {rel(a.resolvedAt)}</span>}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (a) => (
        <div>
          <StatusPill status={a.status} />
          {a.acknowledgedBy && <div className="text-xs text-muted-foreground">by {a.acknowledgedBy.name}</div>}
        </div>
      ),
    },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      className: "text-right whitespace-nowrap",
      cell: (a) => {
        if (a.status === "RESOLVED" || a.status === "DISMISSED") return null
        return (
          <div className="flex justify-end gap-1">
            {a.status === "ACTIVE" && (
              <Button size="xs" variant="outline" title={HELP.acknowledge} onClick={() => act(a, "acknowledge")} disabled={busy !== null}>
                Acknowledge
              </Button>
            )}
            <Button size="xs" variant="outline" title={HELP.resolve} onClick={() => act(a, "resolve")} disabled={busy !== null}>
              Resolve
            </Button>
            <Button size="xs" variant="ghost" className="text-muted-foreground" title={HELP.dismiss} onClick={() => act(a, "dismiss")} disabled={busy !== null}>
              Dismiss
            </Button>
          </div>
        )
      },
    },
  ]

  return (
    <>
      <Kpis
        items={[
          { label: "Open", value: n0(summary?.open ?? 0), hint: "active or acknowledged", warn: (summary?.open ?? 0) > 0 },
          { label: "Need a look", value: n0(summary?.active ?? 0), hint: "not acknowledged yet" },
          { label: "Being handled", value: n0(summary?.acknowledged ?? 0), hint: "acknowledged" },
          { label: "Out of stock", value: n0(summary?.byType.OUT_OF_STOCK ?? 0), hint: "open alerts", warn: (summary?.byType.OUT_OF_STOCK ?? 0) > 0 },
          { label: "Low stock", value: n0(summary?.byType.LOW_STOCK ?? 0), hint: "open alerts" },
          { label: "Expiring soon", value: n0(summary?.byType.EXPIRING_SOON ?? 0), hint: "batches within 30 days" },
        ]}
      />

      <div className="flex flex-wrap items-center gap-3 px-4 lg:px-6">
        <ToggleGroup
          multiple={false}
          value={[status]}
          onValueChange={(v: string[]) => v[0] && changeStatus(v[0] as (typeof STATUSES)[number]["value"])}
          variant="outline"
          size="sm"
          className="bg-card"
          aria-label="Alert status"
        >
          {STATUSES.map((s) => (
            <ToggleGroupItem key={s.value} value={s.value}>
              {s.text}
              {s.value === "OPEN" && summary ? ` · ${n0(summary.open)}` : ""}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        {loading && <LoaderIcon className="size-4 animate-spin text-muted-foreground" />}
        <span className="flex-1" />
        <Button size="sm" variant="outline" onClick={() => setScanning("confirm")} disabled={scanning !== null}>
          <RefreshCwIcon className={cn(scanning === "running" && "animate-spin")} />
          {scanning === "running" ? "Checking..." : "Re-check all"}
        </Button>
      </div>

      <ListTable
        rows={visible}
        columns={columns}
        getRowId={(a) => a.id}
        searchText={(a) => `${a.title} ${a.message ?? ""} ${a.variant.sku} ${a.variant.productName}`}
        searchPlaceholder="Search SKU or product..."
        emptyText={status === "OPEN" ? "No open alerts: stock is above every threshold." : "No alerts match this filter."}
        toolbar={
          <>
            <Select value={type} items={typeItems} onValueChange={(v) => setType(v as string)}>
              <SelectTrigger aria-label="Alert type" size="sm" className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                {typeItems.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={warehouse} items={warehouseItems} onValueChange={(v) => setWarehouse(v as string)}>
              <SelectTrigger aria-label="Where" size="sm" className="hidden w-36 sm:flex"><SelectValue /></SelectTrigger>
              <SelectContent>
                {warehouseItems.map((w) => <SelectItem key={w.value} value={w.value}>{w.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </>
        }
      />

      <Card title="How alerts work" className="mx-4 lg:mx-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:font-medium [&>th:first-child]:pl-4 [&>th:last-child]:pr-4">
                <th>Alert</th>
                <th>Raised when</th>
                <th>Covers</th>
                <th>Clears by itself when</th>
              </tr>
            </thead>
            <tbody className="text-muted-foreground [&>tr]:border-t [&>tr>td]:px-3 [&>tr>td]:py-2 [&>tr>td:first-child]:pl-4 [&>tr>td:last-child]:pr-4">
              <tr>
                <td><Pill tone="red">Out of stock</Pill></td>
                <td>Storefront stock is 0 or less</td>
                <td>Store-wide (active variants of active products)</td>
                <td>Stock comes back</td>
              </tr>
              <tr>
                <td><Pill tone="amber">Low stock</Pill></td>
                <td>Storefront stock is at or below the variant’s low-stock threshold</td>
                <td>Store-wide</td>
                <td>Stock goes above the threshold</td>
              </tr>
              <tr>
                <td><span className="flex gap-1"><Pill tone="red">Out</Pill><Pill tone="amber">Low</Pill></span></td>
                <td>Available is 0, or at or below the reorder point, for a variant with an active reorder rule</td>
                <td>That warehouse</td>
                <td>Stock goes above the reorder point</td>
              </tr>
              <tr>
                <td><Pill tone="amber">Expiring soon</Pill></td>
                <td>A batch with units left expires within 30 days, or already has</td>
                <td>That warehouse</td>
                <td>The batch is used up or no longer available</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="flex items-start gap-2 border-t px-4 py-3 text-[13px] text-muted-foreground">
          <BellOffIcon className="mt-0.5 size-4 shrink-0" />
          <span>
            <strong className="font-medium text-foreground">Acknowledge</strong>: {HELP.acknowledge} <strong className="font-medium text-foreground">Resolve</strong>:{" "}
            {HELP.resolve} <strong className="font-medium text-foreground">Dismiss</strong>: {HELP.dismiss} Changing a variant’s low-stock threshold
            re-checks its alerts straight away.
          </span>
        </p>
      </Card>

      {scanning === "confirm" && (
        <Dialog open onOpenChange={(o) => !o && setScanning(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Re-check every variant?</DialogTitle>
              <DialogDescription>
                Raises alerts that are missing and resolves ones whose condition has cleared. Alerts normally update after every stock change, so this is
                mainly for the first run on existing stock. It can take a while on a big catalogue.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setScanning(null)}>Not now</Button>
              <Button onClick={scan}>Re-check all</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
