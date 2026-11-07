"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { z } from "zod"
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  CopyIcon,
  FileTextIcon,
  PackageIcon,
  RotateCcwIcon,
  StickyNoteIcon,
  StoreIcon,
  TruckIcon,
  XCircleIcon,
  ZapIcon,
} from "lucide-react"

import { bulkBookPathaoShipments, getPathaoStores } from "@/app/actions/pathao.actions"
import { n0, taka } from "@/components/inventory/inventory-ui"
import { paidSoFar } from "@/components/orders/orders-table"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { cn } from "@/lib/utils"
import type { Order, OrderAddress } from "@/types/order.type"
import type { BulkBookResult, PathaoDeliveryType, PathaoItemType, PathaoStore } from "@/types/pathao.type"

// Pathao's logo (public/couriers/pathao.png, from their GitHub avatar); the round crop hides its black corners.
export function PathaoMark({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn("size-4 shrink-0 overflow-hidden rounded-full bg-white", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- a 16px static icon */}
      <img src="/couriers/pathao.png" alt="" className="size-full scale-[1.12] object-cover" />
    </span>
  )
}

// The parcel options both booking dialogs share. Quantity and cash to collect are per order, so the single dialog adds them itself.
const DEFAULT_STORE = "default"
export type PathaoOptionsForm = {
  storeId: string
  deliveryType: PathaoDeliveryType
  itemType: PathaoItemType
  weight: string
  description: string
  instruction: string
}
export const PATHAO_DEFAULTS: PathaoOptionsForm = { storeId: DEFAULT_STORE, deliveryType: "NORMAL", itemType: "PARCEL", weight: "0.5", description: "", instruction: "" }

export const pathaoOptionsSchema = z.object({
  storeId: z.string(),
  deliveryType: z.enum(["NORMAL", "ON_DEMAND"]),
  itemType: z.enum(["PARCEL", "DOCUMENT"]),
  weight: z.string().refine((v) => Number(v) >= 0.5 && Number(v) <= 10, "Weight must be between 0.5 and 10 kg."),
  description: z.string().trim().max(255, "What’s inside can be at most 255 characters."),
  instruction: z.string().trim().max(255, "The rider note can be at most 255 characters."),
})

// Blanks are left out so the backend's defaults apply.
export function pathaoOptionsBody(form: PathaoOptionsForm) {
  return {
    storeId: form.storeId === DEFAULT_STORE ? undefined : Number(form.storeId),
    deliveryType: form.deliveryType,
    itemType: form.itemType,
    itemWeight: Number(form.weight),
    itemDescription: form.description.trim() || undefined,
    specialInstruction: form.instruction.trim() || undefined,
  }
}

const section = "flex flex-col gap-3 border-t px-6 py-4 first:border-t-0"
const sectionTitle = "flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase [&_svg]:size-3.5"
export const chip = (active: boolean) =>
  cn("rounded-md border px-2 py-0.5 text-xs tabular-nums transition-colors hover:bg-muted", active && "border-primary bg-primary/10 text-primary hover:bg-primary/10")

// Pickup & service, parcel and rider note. `extra` sits next to the weight (the single dialog's item count and cash).
export function PathaoOptions({ value, onChange, extra }: { value: PathaoOptionsForm; onChange: (v: PathaoOptionsForm) => void; extra?: React.ReactNode }) {
  const [stores, setStores] = useState<PathaoStore[] | null>(null)
  const [storeError, setStoreError] = useState("")
  const set = (patch: Partial<PathaoOptionsForm>) => onChange({ ...value, ...patch })
  const kg = Number(value.weight)

  useEffect(() => {
    getPathaoStores().then((res) => {
      if (res.success) setStores(res.data.filter((st) => st.is_active))
      else {
        setStores([])
        setStoreError(res.error)
      }
    })
  }, [])

  const storeItems = [{ value: DEFAULT_STORE, label: "Default pickup store" }, ...(stores ?? []).map((st) => ({ value: String(st.store_id), label: st.store_name }))]
  const store = stores?.find((st) => String(st.store_id) === value.storeId)
  const toggle = (current: string, options: { value: string; label: string; icon: React.ElementType }[], onPick: (v: string) => void) => (
    <ToggleGroup multiple={false} value={[current]} onValueChange={(v) => v[0] && onPick(v[0])} variant="outline" spacing={0} className="w-full">
      {options.map((o) => (
        <ToggleGroupItem key={o.value} value={o.value} className="flex-1 gap-1.5 px-3! data-pressed:bg-primary/10 data-pressed:font-medium data-pressed:text-primary">
          <o.icon className="size-3.5" />
          {o.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )

  return (
    <>
      <div className={section}>
        <h3 className={sectionTitle}><StoreIcon />Pickup & service</h3>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
          <Field>
            <FieldLabel>Pickup store</FieldLabel>
            <Select value={value.storeId} items={storeItems} onValueChange={(v) => set({ storeId: v as string })} disabled={stores === null}>
              <SelectTrigger aria-label="Pickup store" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {storeItems.map((i) => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel>Delivery</FieldLabel>
            {toggle(value.deliveryType, [{ value: "NORMAL", label: "Normal", icon: TruckIcon }, { value: "ON_DEMAND", label: "On demand", icon: ZapIcon }], (v) => set({ deliveryType: v as PathaoDeliveryType }))}
          </Field>
          <Field>
            <FieldLabel>Item type</FieldLabel>
            {toggle(value.itemType, [{ value: "PARCEL", label: "Parcel", icon: PackageIcon }, { value: "DOCUMENT", label: "Document", icon: FileTextIcon }], (v) => set({ itemType: v as PathaoItemType }))}
          </Field>
        </div>
        {stores === null && <p className="-mt-1 text-xs text-muted-foreground">Loading your Pathao stores...</p>}
        {store && <p className="-mt-1 text-xs text-muted-foreground">Picked up from {store.store_address}</p>}
        {storeError && <p className="-mt-1 text-xs text-amber-700 dark:text-amber-400">Couldn’t load your stores ({storeError}). The default store from the backend is used.</p>}
      </div>

      <div className={section}>
        <h3 className={sectionTitle}><PackageIcon />Parcel</h3>
        <div className={cn("grid gap-3", extra ? "sm:grid-cols-[1.4fr_0.6fr_1fr]" : "sm:grid-cols-[minmax(0,20rem)]")}>
          <Field>
            <FieldLabel htmlFor="pathao-weight">Weight</FieldLabel>
            <div className="flex items-center gap-1">
              <Button size="icon" variant="outline" aria-label="Half a kilo less" onClick={() => set({ weight: String(Math.max(0.5, kg - 0.5)) })} disabled={!(kg > 0.5)}>
                −
              </Button>
              <div className="relative flex-1">
                <Input id="pathao-weight" inputMode="decimal" value={value.weight} onChange={(e) => set({ weight: e.target.value })} className="pr-8 text-center tabular-nums" />
                <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs text-muted-foreground">kg</span>
              </div>
              <Button size="icon" variant="outline" aria-label="Half a kilo more" onClick={() => set({ weight: String(Math.min(10, (kg || 0) + 0.5)) })} disabled={kg >= 10}>
                +
              </Button>
            </div>
            <span className="flex gap-1">
              {[0.5, 1, 2, 5].map((w) => (
                <button key={w} type="button" onClick={() => set({ weight: String(w) })} className={chip(kg === w)}>
                  {w} kg
                </button>
              ))}
            </span>
          </Field>
          {extra}
        </div>
        <Field>
          <FieldLabel htmlFor="pathao-desc">What’s inside</FieldLabel>
          <Input id="pathao-desc" value={value.description} onChange={(e) => set({ description: e.target.value })} maxLength={255} placeholder="Leave blank to let the backend describe it" />
        </Field>
      </div>

      <div className={section}>
        <div className="flex items-baseline justify-between gap-2">
          <h3 className={sectionTitle}><StickyNoteIcon />Note for the rider</h3>
          <span className="text-xs text-muted-foreground tabular-nums">{value.instruction.length}/255</span>
        </div>
        <Textarea id="pathao-note" value={value.instruction} onChange={(e) => set({ instruction: e.target.value })} maxLength={255} placeholder="Call before delivery" className="min-h-16" aria-label="Note for the rider" />
        <span className="-mt-1 flex flex-wrap gap-1">
          {["Call before delivery", "Handle with care", "Fragile"].map((t) => {
            const on = value.instruction.includes(t)
            // A second click takes the phrase back out of the note.
            const next = on
              ? value.instruction.replace(t, "").replace(/^[.\s]+|[.\s]+$/g, "").replace(/(\.\s*){2,}/g, ". ")
              : [value.instruction.trim(), t].filter(Boolean).join(". ")
            return (
              <button key={t} type="button" aria-pressed={on} onClick={() => set({ instruction: next.slice(0, 255) })} className={chip(on)}>
                {on ? "✓" : "+"} {t}
              </button>
            )
          })}
        </span>
      </div>
    </>
  )
}

const CHUNK = 10 // one request per 10 orders, one after another: shows progress and keeps each request short
type NotTried = { orderId: string; orderNumber: string | null }
type Outcome = { booked: BulkBookResult["booked"]; failed: BulkBookResult["failed"]; notTried: NotTried[]; why: string }

// Books many orders with one set of options, then shows what was booked, what failed and what wasn't tried.
// `onClose` gets how many were booked in all (across "Send these again" rounds).
export function PathaoBulkDialog({ orders, addresses, onClose }: { orders: Order[]; addresses: Record<string, OrderAddress>; onClose: (booked: number) => void }) {
  const [list, setList] = useState(orders)
  const [form, setForm] = useState(PATHAO_DEFAULTS)
  const [error, setError] = useState("")
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(0)
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const [bookedTotal, setBookedTotal] = useState(0)
  const [stopping, setStopping] = useState(false)
  const stop = useRef(false) // the send loop reads this between batches
  const byId = new Map(orders.map((o) => [o.id, o]))

  async function send() {
    const parsed = pathaoOptionsSchema.safeParse(form)
    if (!parsed.success) return setError(parsed.error.issues[0].message)
    setError("")
    setSending(true)
    setDone(0)
    stop.current = false
    setStopping(false)
    const body = pathaoOptionsBody(form)
    const result: Outcome = { booked: [], failed: [], notTried: [], why: "" }
    const rest = (from: number) => list.slice(from).map((o) => ({ orderId: o.id, orderNumber: o.orderNumber }))
    for (let i = 0; i < list.length; i += CHUNK) {
      if (stop.current) {
        result.notTried.push(...rest(i))
        result.why = "You stopped sending before these went out."
        break
      }
      const chunk = list.slice(i, i + CHUNK)
      const res = await bulkBookPathaoShipments({ orderIds: chunk.map((o) => o.id), ...body })
      if (!res.success) {
        result.notTried.push(...rest(i))
        result.why = `The request failed, so these weren’t sent: ${res.error}`
        break
      }
      result.booked.push(...res.data.booked)
      result.failed.push(...res.data.failed)
      setDone(i + chunk.length)
      // Pathao stopped working (down, timed out, not configured): the rest would fail the same way.
      if (res.data.skipped.length) {
        result.notTried.push(...res.data.skipped, ...rest(i + CHUNK))
        result.why = "Pathao stopped responding, so these weren’t tried. Send them again later."
        break
      }
    }
    setSending(false)
    setBookedTotal((t) => t + result.booked.length)
    setOutcome(result)
  }

  // Back to the form with only these orders and the same options.
  function sendAgain(ids: string[]) {
    setList(ids.map((id) => byId.get(id)!).filter(Boolean))
    setOutcome(null)
    setDone(0)
  }

  const retryable = outcome?.failed.filter((f) => ![504, 404, 409].includes(f.status) && byId.has(f.orderId)) ?? []
  const n = list.length

  return (
    <Dialog open onOpenChange={(open) => !open && !sending && onClose(bookedTotal)}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="flex-row items-center gap-3 border-b px-6 py-4">
          <PathaoMark className="size-10 ring-4 ring-red-50 dark:ring-red-950" />
          <div className="min-w-0 flex-1">
            <DialogTitle className="text-base">
              {outcome ? "Pathao booking results" : `Send ${n0(n)} ${n === 1 ? "order" : "orders"} with Pathao`}
            </DialogTitle>
            <DialogDescription>
              {outcome
                ? `${n0(outcome.booked.length)} booked · ${n0(outcome.failed.length)} failed · ${n0(outcome.notTried.length)} not tried`
                : "One set of options for every parcel; Pathao picks them up from your store."}
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {outcome ? (
            <Results outcome={outcome} byId={byId} onSendAgain={sendAgain} />
          ) : (
            <fieldset disabled={sending} className="contents">
              <PathaoOptions value={form} onChange={setForm} />
              <div className={section}>
                <h3 className={sectionTitle}><TruckIcon />Orders being sent</h3>
                <OrdersPreview orders={list} addresses={addresses} />
                <p className="-mt-1 text-xs text-muted-foreground">Each order’s item count and cash to collect are used. Cash shown here is a guide; the backend works it out again.</p>
              </div>
            </fieldset>
          )}
        </div>

        {error && <p className="border-t bg-destructive/10 px-6 py-2.5 text-sm text-destructive">{error}</p>}

        <div className="flex flex-wrap items-center gap-3 border-t bg-muted/40 px-6 py-3">
          {sending ? (
            <>
              <div className="mr-auto flex min-w-0 flex-1 flex-col gap-1.5">
                <span className="text-sm">
                  Sending… <span className="font-semibold tabular-nums">{n0(done)}</span> of {n0(n)}
                  {stopping && <span className="text-muted-foreground"> · stopping after this batch</span>}
                </span>
                <div className="h-1.5 overflow-hidden rounded-full bg-foreground/10">
                  <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${(done / n) * 100}%` }} />
                </div>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  stop.current = true
                  setStopping(true)
                }}
                disabled={stopping}
              >
                Stop
              </Button>
            </>
          ) : outcome ? (
            <>
              <span className="mr-auto text-xs text-muted-foreground">
                {outcome.booked.length > 0 && "Booked orders are now ready to ship with their consignment IDs."}
              </span>
              <Button onClick={() => onClose(bookedTotal)}>Done</Button>
            </>
          ) : (
            <>
              <span className="mr-auto text-xs text-muted-foreground">
                {n0(n)} {n === 1 ? "parcel" : "parcels"} · sent {CHUNK} at a time · delivery charges show after booking
              </span>
              <Button variant="outline" onClick={() => onClose(bookedTotal)}>Cancel</Button>
              <Button onClick={send} disabled={!n}>
                <PathaoMark />
                Send {n0(n)} with Pathao
              </Button>
            </>
          )}
        </div>
        {outcome && retryable.length > 0 && !sending && (
          <div className="flex items-center gap-2 border-t px-6 py-2.5 text-xs text-muted-foreground">
            <span className="mr-auto">{n0(retryable.length)} failed {retryable.length === 1 ? "order" : "orders"} may go through once fixed (address, phone…).</span>
            <Button size="xs" variant="outline" onClick={() => sendAgain(retryable.map((f) => f.orderId))}>
              <RotateCcwIcon />
              Send failed again
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function OrdersPreview({ orders, addresses }: { orders: Order[]; addresses: Record<string, OrderAddress> }) {
  return (
    <div className="max-h-64 overflow-y-auto rounded-xl border">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-muted text-left text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Order</th>
            <th className="px-3 py-2 font-medium">Customer</th>
            <th className="px-3 py-2 font-medium">Phone</th>
            <th className="px-3 py-2 font-medium">City</th>
            <th className="px-3 py-2 text-right font-medium">Cash to collect</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => {
            const address = addresses[o.id]
            const phone = address?.phone || o.customerPhone
            const due = Math.max(0, Math.round(Number(o.totalAmount) - paidSoFar(o)))
            // These will fail at the backend, but the rest can still go.
            let problem = ""
            if (!address) problem = "No shipping address"
            else if (!phone) problem = "No phone"
            return (
              <tr key={o.id} className={cn("border-t", problem && "bg-amber-50 dark:bg-amber-950/40")} title={problem || undefined}>
                <td className="px-3 py-2 font-medium whitespace-nowrap">{o.orderNumber}</td>
                <td className="max-w-40 truncate px-3 py-2">{address?.fullName || o.customerName || o.customerEmail}</td>
                <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">{phone || <span className="font-sans text-amber-700 dark:text-amber-400">No phone</span>}</td>
                <td className="px-3 py-2">{address ? address.city : <span className="text-amber-700 dark:text-amber-400">No address</span>}</td>
                <td className="px-3 py-2 text-right tabular-nums">{due ? taka(due) : <span className="text-muted-foreground">Nothing</span>}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function Results({ outcome, byId, onSendAgain }: { outcome: Outcome; byId: Map<string, Order>; onSendAgain: (ids: string[]) => void }) {
  const orderLink = (id: string, number: string | null) =>
    number ? (
      <Link href={`/orders/${id}`} className="font-medium whitespace-nowrap hover:text-primary hover:underline">{number}</Link>
    ) : (
      <span className="text-muted-foreground">Unknown order</span>
    )
  const resendable = outcome.notTried.filter((o) => byId.has(o.orderId))

  return (
    <>
      {outcome.booked.length > 0 && (
        <div className={section}>
          <h3 className={cn(sectionTitle, "text-emerald-700 dark:text-emerald-400")}><CheckCircle2Icon />Booked · {n0(outcome.booked.length)}</h3>
          <ul className="divide-y rounded-xl border">
            {outcome.booked.map((b) => (
              <li key={b.orderId} className="flex items-center gap-3 px-3 py-2 text-sm">
                {orderLink(b.orderId, b.orderNumber)}
                <span className="flex items-center gap-1 font-mono text-xs text-muted-foreground">
                  {b.consignmentId}
                  <button
                    type="button"
                    aria-label={`Copy ${b.consignmentId}`}
                    onClick={() => navigator.clipboard.writeText(b.consignmentId).then(() => toast.success(`Copied ${b.consignmentId}`))}
                    className="grid size-5 place-items-center rounded hover:bg-muted hover:text-foreground"
                  >
                    <CopyIcon className="size-3" />
                  </button>
                </span>
                <span className="ml-auto tabular-nums">{b.amountToCollect ? `৳${n0(b.amountToCollect)}` : <span className="text-muted-foreground">Nothing to collect</span>}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {outcome.failed.length > 0 && (
        <div className={section}>
          <h3 className={cn(sectionTitle, "text-destructive")}><XCircleIcon />Failed · {n0(outcome.failed.length)}</h3>
          <ul className="divide-y rounded-xl border">
            {outcome.failed.map((f) => (
              <li key={f.orderId} className="flex flex-col gap-0.5 px-3 py-2 text-sm">
                <span className="flex items-baseline gap-3">
                  {orderLink(f.orderId, f.orderNumber)}
                  <span className="text-destructive">{f.error}</span>
                </span>
                {/* A timeout may still have created the parcel at Pathao. */}
                {f.status === 504 && (
                  <span className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                    <AlertTriangleIcon className="size-3.5" />
                    Check the Pathao panel for {f.orderNumber ?? "this order"} before sending it again.
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {outcome.notTried.length > 0 && (
        <div className={section}>
          <h3 className={sectionTitle}>Not tried · {n0(outcome.notTried.length)}</h3>
          <p className="-mt-1 text-xs text-muted-foreground">{outcome.why}</p>
          <div className="flex flex-wrap gap-1">
            {outcome.notTried.map((o) => (
              <span key={o.orderId} className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px]">{o.orderNumber ?? o.orderId}</span>
            ))}
          </div>
          {resendable.length > 0 && (
            <Button size="sm" variant="outline" className="self-start" onClick={() => onSendAgain(resendable.map((o) => o.orderId))}>
              <RotateCcwIcon />
              Send these again
            </Button>
          )}
        </div>
      )}

      {!outcome.booked.length && !outcome.failed.length && !outcome.notTried.length && (
        <p className="px-6 py-8 text-center text-sm text-muted-foreground">Nothing was sent.</p>
      )}
    </>
  )
}
