"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { z } from "zod"
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  CheckIcon,
  CircleDashedIcon,
  CopyIcon,
  FileTextIcon,
  Loader2Icon,
  PackageIcon,
  RotateCcwIcon,
  SquareIcon,
  StickyNoteIcon,
  StoreIcon,
  TruckIcon,
  XCircleIcon,
  XIcon,
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

// Plain-words help for the booking errors we know; anything else shows the API's own message.
export function pathaoTip(message: string) {
  if (/storeId|PATHAO_STORE_ID/i.test(message)) return "No pickup store. Pick one with the pencil, or set PATHAO_STORE_ID in the backend's .env."
  if (/not configured|log in to Pathao/i.test(message)) return "The backend can't sign in to Pathao. Check the PATHAO_* settings, or try later if Pathao is down."
  if (/mobile|phone/i.test(message)) return "Fix the phone on the shipping address: Pathao needs an 11-digit number like 01712345678."
  if (/address/i.test(message)) return "The shipping address is too short for Pathao (at least 10 characters)."
  return null
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

const dueOf = (o: Order) => Math.max(0, Math.round(Number(o.totalAmount) - paidSoFar(o)))
// Orders the backend will refuse; they're still sent, the rest go through.
function problemOf(o: Order, address: OrderAddress | undefined) {
  if (!address) return "No shipping address"
  if (!address.phone && !o.customerPhone) return "No phone"
  return ""
}

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

  const n = list.length
  const cash = list.reduce((sum, o) => sum + dueOf(o), 0)
  const cod = list.filter((o) => dueOf(o) > 0).length
  const problems = list.filter((o) => problemOf(o, addresses[o.id])).length
  const batches = Math.ceil(n / CHUNK)

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
              {outcome ? "Booked parcels are on their orders now; Pathao picks them up from your store." : "One set of options for every parcel; Pathao picks them up from your store."}
            </DialogDescription>
          </div>
        </DialogHeader>
        {/* A thin bar under the header while sending, so progress shows wherever the body is scrolled. */}
        {sending && (
          <div className="h-0.5 bg-primary/10">
            <div className="h-full bg-primary transition-[width] duration-500" style={{ width: `${Math.max(4, (done / n) * 100)}%` }} />
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto">
          {outcome ? (
            <Results outcome={outcome} byId={byId} onSendAgain={sendAgain} />
          ) : (
            <>
              <div className="grid grid-cols-3 border-b bg-muted/30">
                <Stat label="Parcels" value={n0(n)} hint={batches > 1 ? `sent in ${batches} batches of ${CHUNK}` : "sent in one go"} />
                <Stat label="Cash to collect" value={taka(cash)} hint={cod ? `from ${n0(cod)} cash-on-delivery ${cod === 1 ? "order" : "orders"}` : "every order is paid"} />
                {problems ? (
                  <Stat label="Need a look" value={n0(problems)} hint="no address or phone; Pathao will refuse them" tone="amber" icon={AlertTriangleIcon} />
                ) : (
                  <Stat label="Ready" value="All set" hint="every order has an address and phone" tone="green" icon={CheckCircle2Icon} />
                )}
              </div>
              <fieldset disabled={sending} className="contents">
                <PathaoOptions value={form} onChange={setForm} />
              </fieldset>
              <div className={section}>
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className={sectionTitle}><TruckIcon />Orders being sent</h3>
                  <span className="text-xs text-muted-foreground">Item count and cash come from each order</span>
                </div>
                <OrdersPreview orders={list} addresses={addresses} sending={sending} done={done} />
              </div>
            </>
          )}
        </div>

        {error && <p className="border-t bg-destructive/10 px-6 py-2.5 text-sm text-destructive">{error}</p>}

        <div className="flex flex-wrap items-center gap-3 border-t bg-muted/40 px-6 py-3">
          {sending ? (
            <>
              <div className="mr-auto flex min-w-0 flex-1 items-center gap-2.5">
                <Loader2Icon className="size-4 shrink-0 animate-spin text-primary" />
                <div className="min-w-0">
                  <div className="text-sm">
                    Sending… <span className="font-semibold tabular-nums">{n0(done)}</span> of {n0(n)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {stopping ? "Stopping after this batch" : `Batch ${n0(Math.min(batches, Math.floor(done / CHUNK) + 1))} of ${n0(batches)} · about 1–2 s an order`}
                  </div>
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
                <SquareIcon />
                {stopping ? "Stopping…" : "Stop"}
              </Button>
            </>
          ) : outcome ? (
            <>
              <span className="mr-auto text-xs text-muted-foreground">Closing refreshes the orders list.</span>
              <Button onClick={() => onClose(bookedTotal)}>Done</Button>
            </>
          ) : (
            <>
              <div className="mr-auto min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-[13px] text-muted-foreground">Riders collect</span>
                  <span className="text-lg font-bold tabular-nums">{cash ? taka(cash) : "Nothing"}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {form.deliveryType === "NORMAL" ? "Normal" : "On demand"} · {form.itemType === "PARCEL" ? "Parcel" : "Document"} · {form.weight} kg each · delivery charges show after booking
                </div>
              </div>
              <Button variant="outline" onClick={() => onClose(bookedTotal)}>Cancel</Button>
              <Button onClick={send} disabled={!n}>
                <PathaoMark />
                Send {n0(n)} with Pathao
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Stat({ label, value, hint, tone, icon: Icon }: { label: string; value: string; hint: string; tone?: "amber" | "green" | "red"; icon?: React.ElementType }) {
  return (
    <div className="flex flex-col gap-0.5 border-l px-6 py-3 first:border-l-0">
      <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{label}</span>
      <span
        className={cn(
          "flex items-center gap-1.5 text-lg font-semibold tabular-nums",
          tone === "amber" && "text-amber-700 dark:text-amber-400",
          tone === "green" && "text-emerald-700 dark:text-emerald-400",
          tone === "red" && "text-destructive"
        )}
      >
        {Icon && <Icon className="size-4" />}
        {value}
      </span>
      <span className="text-xs text-muted-foreground">{hint}</span>
    </div>
  )
}

function OrdersPreview({ orders, addresses, sending, done }: { orders: Order[]; addresses: Record<string, OrderAddress>; sending: boolean; done: number }) {
  const total = orders.reduce((sum, o) => sum + dueOf(o), 0)
  return (
    <div className="max-h-72 overflow-y-auto rounded-xl border">
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-10 bg-muted text-left text-[11px] text-muted-foreground uppercase">
          <tr>
            <th className="w-8 py-2 pl-3 font-medium">#</th>
            <th className="px-3 py-2 font-medium">Order</th>
            <th className="px-3 py-2 font-medium">Deliver to</th>
            <th className="px-3 py-2 font-medium">City</th>
            <th className="px-3 py-2 text-right font-medium">Cash</th>
            {sending && <th className="w-24 py-2 pr-3 text-right font-medium">Status</th>}
          </tr>
        </thead>
        <tbody>
          {orders.map((o, index) => {
            const address = addresses[o.id]
            const phone = address?.phone || o.customerPhone
            const due = dueOf(o)
            const problem = problemOf(o, address)
            // Rows before `done` went out; the next batch is in flight.
            let status = <span className="text-muted-foreground">Waiting</span>
            if (index < done) status = <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400"><CheckIcon className="size-3.5" />Sent</span>
            else if (index < done + CHUNK) status = <span className="inline-flex items-center gap-1 text-primary"><Loader2Icon className="size-3.5 animate-spin" />Booking</span>
            return (
              <tr key={o.id} className={cn("border-t align-top", problem && "bg-amber-50/70 dark:bg-amber-950/30")}>
                <td className="py-2 pl-3 text-xs text-muted-foreground tabular-nums">{index + 1}</td>
                <td className="px-3 py-2 font-medium whitespace-nowrap">{o.orderNumber}</td>
                <td className="px-3 py-2">
                  <div className="max-w-52 truncate">{address?.fullName || o.customerName || o.customerEmail}</div>
                  {phone ? (
                    <div className="font-mono text-xs text-muted-foreground">{phone}</div>
                  ) : (
                    <div className="text-xs text-amber-700 dark:text-amber-400">No phone</div>
                  )}
                </td>
                <td className="px-3 py-2">
                  {address ? (
                    <>
                      <div>{address.city}</div>
                      {address.thana && <div className="text-xs text-muted-foreground">{address.thana}</div>}
                    </>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400">
                      <AlertTriangleIcon className="size-3.5" />
                      No address
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{due ? taka(due) : <span className="text-xs text-muted-foreground">Paid</span>}</td>
                {sending && <td className="py-2 pr-3 text-right text-xs whitespace-nowrap">{status}</td>}
              </tr>
            )
          })}
        </tbody>
        <tfoot className="sticky bottom-0 bg-muted/90 text-xs backdrop-blur">
          <tr className="border-t">
            <td colSpan={4} className="py-2 pl-3 text-muted-foreground">
              {n0(orders.length)} {orders.length === 1 ? "parcel" : "parcels"} · cash is a guide, the backend works it out again
            </td>
            <td className="px-3 py-2 text-right font-semibold tabular-nums">{taka(total)}</td>
            {sending && <td />}
          </tr>
        </tfoot>
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
  const customer = (id: string) => {
    const o = byId.get(id)
    return o ? o.customerName ?? o.customerEmail : ""
  }
  const resendable = outcome.notTried.filter((o) => byId.has(o.orderId))
  // 504 may have booked at Pathao anyway; 404 and 409 won't change by retrying.
  const retryable = outcome.failed.filter((f) => ![504, 404, 409].includes(f.status) && byId.has(f.orderId))
  const collect = outcome.booked.reduce((sum, b) => sum + b.amountToCollect, 0)
  const copy = (text: string, what: string) => navigator.clipboard.writeText(text).then(() => toast.success(`Copied ${what}`))

  return (
    <>
      <div className="grid grid-cols-3 border-b bg-muted/30">
        <Stat label="Booked" value={n0(outcome.booked.length)} hint={outcome.booked.length ? `${taka(collect)} for riders to collect` : "nothing booked"} tone={outcome.booked.length ? "green" : undefined} icon={CheckCircle2Icon} />
        <Stat label="Failed" value={n0(outcome.failed.length)} hint={outcome.failed.length ? "see why below" : "none"} tone={outcome.failed.length ? "red" : undefined} icon={XCircleIcon} />
        <Stat label="Not tried" value={n0(outcome.notTried.length)} hint={outcome.notTried.length ? "can be sent again" : "none"} tone={outcome.notTried.length ? "amber" : undefined} icon={CircleDashedIcon} />
      </div>

      {outcome.booked.length > 0 && (
        <div className={section}>
          <div className="flex items-center justify-between gap-2">
            <h3 className={cn(sectionTitle, "text-emerald-700 dark:text-emerald-400")}><CheckCircle2Icon />Booked</h3>
            {outcome.booked.length > 1 && (
              <Button size="xs" variant="ghost" onClick={() => copy(outcome.booked.map((b) => `${b.orderNumber ?? b.orderId}\t${b.consignmentId}`).join("\n"), "every consignment ID")}>
                <CopyIcon />
                Copy all IDs
              </Button>
            )}
          </div>
          <ul className="divide-y rounded-xl border">
            {outcome.booked.map((b) => (
              <li key={b.orderId} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                  <CheckIcon className="size-3.5" />
                </span>
                <span className="flex min-w-0 flex-col">
                  {orderLink(b.orderId, b.orderNumber)}
                  <span className="truncate text-xs text-muted-foreground">{customer(b.orderId)}</span>
                </span>
                <span className="ml-auto flex items-center gap-0.5 rounded-md border bg-muted/50 py-0.5 pr-0.5 pl-2 font-mono text-xs">
                  {b.consignmentId}
                  <button
                    type="button"
                    aria-label={`Copy ${b.consignmentId}`}
                    onClick={() => copy(b.consignmentId, b.consignmentId)}
                    className="grid size-5 place-items-center rounded text-muted-foreground hover:bg-background hover:text-foreground"
                  >
                    <CopyIcon className="size-3" />
                  </button>
                </span>
                <span className="w-24 text-right tabular-nums">
                  {b.amountToCollect ? taka(b.amountToCollect) : <span className="text-xs text-muted-foreground">Nothing</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {outcome.failed.length > 0 && (
        <div className={section}>
          <div className="flex items-center justify-between gap-2">
            <h3 className={cn(sectionTitle, "text-destructive")}><XCircleIcon />Failed</h3>
            {retryable.length > 0 && (
              <Button size="xs" variant="outline" onClick={() => onSendAgain(retryable.map((f) => f.orderId))}>
                <RotateCcwIcon />
                Send {retryable.length === 1 ? "it" : `these ${n0(retryable.length)}`} again
              </Button>
            )}
          </div>
          <ul className="divide-y rounded-xl border">
            {outcome.failed.map((f) => {
              const tip = pathaoTip(f.error)
              return (
                <li key={f.orderId} className="flex items-start gap-3 px-3 py-2.5 text-sm">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-destructive/10 text-destructive">
                    <XIcon className="size-3.5" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="flex flex-wrap items-baseline gap-x-2">
                      {orderLink(f.orderId, f.orderNumber)}
                      <span className="text-xs text-muted-foreground">{customer(f.orderId)}</span>
                    </span>
                    <span className="text-destructive">{f.error}</span>
                    {tip && <span className="text-xs text-muted-foreground">{tip}</span>}
                    {/* A timeout may still have created the parcel at Pathao. */}
                    {f.status === 504 && (
                      <span className="mt-1 flex items-center gap-1.5 rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                        <AlertTriangleIcon className="size-3.5 shrink-0" />
                        Check the Pathao panel for {f.orderNumber ?? "this order"} before sending it again.
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">{f.status}</span>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {outcome.notTried.length > 0 && (
        <div className={section}>
          <div className="flex items-center justify-between gap-2">
            <h3 className={sectionTitle}><CircleDashedIcon />Not tried</h3>
            {resendable.length > 0 && (
              <Button size="xs" variant="outline" onClick={() => onSendAgain(resendable.map((o) => o.orderId))}>
                <RotateCcwIcon />
                Send these again
              </Button>
            )}
          </div>
          <p className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">{outcome.why}</p>
          <div className="flex flex-wrap gap-1">
            {outcome.notTried.map((o) => (
              <span key={o.orderId} className="rounded-md border bg-card px-1.5 py-0.5 font-mono text-[11px]">{o.orderNumber ?? o.orderId}</span>
            ))}
          </div>
        </div>
      )}

      {!outcome.booked.length && !outcome.failed.length && !outcome.notTried.length && (
        <p className="px-6 py-8 text-center text-sm text-muted-foreground">Nothing was sent.</p>
      )}
    </>
  )
}
