// Small presentational pieces shared by the inventory pages (from the "Haat operations" mockup).

import { FlaskConicalIcon } from "lucide-react"

import { cn } from "@/lib/utils"

export const n0 = (n: number) => n.toLocaleString("en-IN")
export const taka = (n: number, digits = 0) =>
  "৳" + n.toLocaleString("en-IN", { minimumFractionDigits: digits, maximumFractionDigits: digits })
export const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${n0(Math.abs(n))}`

export const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—"
export const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })

// "in 3 days", "2 hours ago"
export function rel(iso: string) {
  const diff = new Date(iso).getTime() - Date.now()
  const abs = Math.abs(diff)
  let text
  if (abs < 3_600_000) text = `${Math.max(1, Math.round(abs / 60_000))} min`
  else if (abs < 86_400_000) text = `${Math.round(abs / 3_600_000)} h`
  else {
    const days = Math.round(abs / 86_400_000)
    text = `${days} ${days === 1 ? "day" : "days"}`
  }
  return diff > 0 ? `in ${text}` : `${text} ago`
}

// "IN_TRANSIT" → "In transit"
export const label = (s: string) => {
  const t = s.toLowerCase().replace(/_/g, " ")
  return t.charAt(0).toUpperCase() + t.slice(1)
}

export type Tone = "green" | "amber" | "red" | "blue" | "ink" | "grey"

const toneClass: Record<Tone, string> = {
  green: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  amber: "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  red: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
  blue: "bg-primary/10 text-primary",
  ink: "bg-foreground text-background",
  grey: "bg-muted text-muted-foreground",
}

// A status pill: the dot and the label carry the meaning, the color only supports it.
export function Pill({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex h-5 items-center gap-1.5 rounded-full px-2 text-[11.5px] font-semibold whitespace-nowrap", toneClass[tone])}>
      <span className="size-1.5 rounded-full bg-current opacity-80" />
      {children}
    </span>
  )
}

// Document statuses share one color scheme across purchase orders, transfers, adjustments and so on.
const STATUS_TONE: Record<string, Tone> = {
  DRAFT: "grey", SUBMITTED: "blue", CONFIRMED: "blue", PARTIAL: "amber", RECEIVED: "green", CLOSED: "ink",
  CANCELLED: "grey", PENDING: "amber", IN_TRANSIT: "blue", COMPLETED: "green", APPROVED: "blue", APPLIED: "green",
  REJECTED: "red", ACTIVE: "green", COMMITTED: "ink", RELEASED: "grey", EXPIRED: "red", AVAILABLE: "green",
  DEPLETED: "grey", QUARANTINED: "amber", RECALLED: "red", ACKNOWLEDGED: "blue", RESOLVED: "grey", DISMISSED: "grey",
}

export function StatusPill({ status, text }: { status: string; text?: string }) {
  return <Pill tone={STATUS_TONE[status] ?? "grey"}>{text ?? label(status)}</Pill>
}

// A yellow shelf label for a rack code, like the ones on the racks themselves.
export function RackTag({ code, title }: { code: string | null; title?: string }) {
  if (!code) {
    return (
      <span className="inline-flex h-5 items-center rounded-[3px] border-[1.5px] border-dashed px-1.5 text-[11px] font-bold text-muted-foreground">
        No rack
      </span>
    )
  }
  return (
    <span
      title={title}
      className="inline-flex h-5 items-center rounded-[3px] border-[1.5px] border-stone-700 bg-yellow-100 px-1.5 font-mono text-[11px] leading-none font-bold tracking-wide whitespace-nowrap text-stone-900 dark:border-yellow-700 dark:bg-yellow-950 dark:text-yellow-100"
    >
      {code}
    </span>
  )
}

export function WarehouseTag({ code, count, tone }: { code: string; count?: number; tone?: "warn" | "bad" }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-1 rounded-[3px] bg-muted px-1.5 font-mono text-[11px] font-bold tracking-wide whitespace-nowrap text-muted-foreground",
        tone === "warn" && "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
        tone === "bad" && "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
      )}
    >
      {code}
      {count !== undefined && <b className={cn("font-bold", !tone && "text-foreground")}>{n0(count)}</b>}
    </span>
  )
}

type MeterValues = { available: number; reserved: number; incoming: number; damaged: number }

// One bar per stock row: available (green), reserved (amber), incoming (hatched), damaged (red).
export function StockMeter({ available, reserved, incoming, damaged, large }: MeterValues & { large?: boolean }) {
  const total = Math.max(1, available + reserved + incoming + damaged)
  const width = (n: number) => `${(Math.max(0, n) / total) * 100}%`
  const tip = `${available} available, ${reserved} reserved, ${incoming} incoming, ${damaged} damaged`
  return (
    <div
      role="img"
      aria-label={tip}
      title={tip}
      className={cn("flex w-full min-w-24 overflow-hidden rounded-xs bg-muted", large ? "h-4" : "h-2.5")}
    >
      <i className="block h-full bg-emerald-600" style={{ width: width(available) }} />
      <i className="block h-full bg-amber-500" style={{ width: width(reserved) }} />
      <i
        className="block h-full"
        style={{
          width: width(incoming),
          background: "repeating-linear-gradient(135deg, var(--color-slate-400) 0 2px, transparent 2px 5px)",
        }}
      />
      <i className="block h-full bg-red-600" style={{ width: width(damaged) }} />
    </div>
  )
}

export function MeterKey() {
  const keys = [
    ["Available", "bg-emerald-600"],
    ["Reserved", "bg-amber-500"],
    ["Incoming", "border border-slate-400 bg-[repeating-linear-gradient(135deg,var(--color-slate-400)_0_2px,transparent_2px_5px)]"],
    ["Damaged", "bg-red-600"],
  ]
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-muted-foreground">
      {keys.map(([text, swatch]) => (
        <span key={text} className="inline-flex items-center gap-1.5">
          <i className={cn("inline-block h-2.5 w-3 rounded-xs", swatch)} />
          {text}
        </span>
      ))}
    </div>
  )
}

// The KPI strip: one card split into columns instead of separate cards.
export function Kpis({
  items,
  className = "mx-4 lg:mx-6",
}: {
  items: { label: string; value: string; hint: string; warn?: boolean }[]
  className?: string
}) {
  return (
    // The 1px gap over a border-colored background draws the dividers.
    <section className={cn("grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border md:grid-cols-3 xl:grid-cols-6", className)}>
      {items.map((kpi) => (
        <div key={kpi.label} className="min-w-0 bg-card px-4 py-3.5">
          <span className="block text-[12.5px] text-muted-foreground">{kpi.label}</span>
          <strong className={cn("block truncate text-2xl font-bold tracking-tight tabular-nums", kpi.warn && "text-amber-700 dark:text-amber-400")}>
            {kpi.value}
          </strong>
          <small className="block text-xs text-muted-foreground">{kpi.hint}</small>
        </div>
      ))}
    </section>
  )
}

// Shown on pages whose API doesn't exist yet.
export function DemoNote({ what, live }: { what: string; live?: string }) {
  return (
    <div className="mx-4 flex items-start gap-2.5 rounded-lg border border-dashed border-amber-400 bg-amber-50 px-3.5 py-2.5 text-[13px] text-amber-900 lg:mx-6 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
      <FlaskConicalIcon className="mt-0.5 size-4 shrink-0" />
      <span>
        <strong>Demo data.</strong> The API for {what} isn’t built yet, so this page shows sample records and changes reset on
        refresh.{live && ` ${live}`}
      </span>
    </div>
  )
}

export function Card({
  title,
  action,
  children,
  className,
}: {
  title: string
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn("overflow-hidden rounded-2xl border bg-card", className)}>
      <div className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-2.5">
        <h2 className="text-[15px] font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}
