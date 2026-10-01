"use client"

import { useState } from "react"
import { ChevronLeftIcon, ChevronRightIcon, FlagIcon, PlusIcon, StarIcon, TagIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

import {
  attention,
  fmtDate,
  hint,
  MON,
  offerSentence,
  offerText,
  plural,
  schedText,
  STATUS_LABEL,
  STATUS_STYLE,
  targetsSummary,
  type Campaign,
  type MarketingData,
  type Promotion,
} from "./marketing-utils"
import { StatusBadge } from "./status"

const LABEL_WIDTH = 252

type Item = (Campaign | Promotion) & { kind: "campaign" | "promotion" }

function shortDate(iso: string) {
  const d = new Date(iso)
  return `${d.getDate()} ${MON[d.getMonth()]}`
}

function shortSched(e: { startsAt: string | null; endsAt: string | null }) {
  if (e.startsAt && e.endsAt) return `${shortDate(e.startsAt)} to ${shortDate(e.endsAt)}`
  if (e.startsAt) return `From ${shortDate(e.startsAt)}`
  if (e.endsAt) return `Until ${shortDate(e.endsAt)}`
  return ""
}

export function PlannerView({
  data,
  now,
  onOpen,
  onNewCampaign,
  onNewPromotion,
}: {
  data: MarketingData
  now: number
  onOpen: (kind: "campaign" | "promotion", id: string) => void
  onNewCampaign: () => void
  onNewPromotion: () => void
}) {
  const [range, setRange] = useState({ offset: -1, months: 6 })
  const [showArchived, setShowArchived] = useState(false)
  const [hoverId, setHoverId] = useState<string | null>(null)

  const today = new Date(now)
  const start = new Date(today.getFullYear(), today.getMonth() + range.offset, 1)
  const end = new Date(start.getFullYear(), start.getMonth() + range.months, 1)
  const span = +end - +start
  const last = new Date(+end - 1)
  const rangeLabel = `${MON[start.getMonth()]}${start.getFullYear() === last.getFullYear() ? "" : ` ${start.getFullYear()}`} to ${MON[last.getMonth()]} ${last.getFullYear()}`

  const months = Array.from({ length: range.months }, (_, i) => {
    const m = new Date(start.getFullYear(), start.getMonth() + i, 1)
    const next = new Date(m.getFullYear(), m.getMonth() + 1, 1)
    return { m, left: ((+m - +start) / span) * 100, width: ((+next - +m) / span) * 100, isNow: now >= +m && now < +next }
  })
  const todayInRange = now >= +start && now < +end
  const todayFraction = (now - +start) / span

  const byStart = (a: { startsAt: string | null; name: string }, b: { startsAt: string | null; name: string }) =>
    (a.startsAt ?? "9999").localeCompare(b.startsAt ?? "9999") || a.name.localeCompare(b.name)
  const visible = (e: { status: string }) => showArchived || e.status !== "ARCHIVED"
  const campaigns = data.campaigns.filter(visible).sort(byStart)
  const promotions = data.promotions.filter(visible).sort(byStart)

  // Pointing at a campaign highlights its linked promotions, and the other way round.
  let linked: string[] | null = null
  if (hoverId) {
    const c = data.campaigns.find((x) => x.id === hoverId)
    const p = data.promotions.find((x) => x.id === hoverId)
    linked = [hoverId, ...(c?.promotionIds ?? []), ...(p?.campaignIds ?? [])]
  }

  const items = attention(data, now)
  const live = [
    ...data.campaigns.map((c) => ({ kind: "campaign" as const, e: c as Campaign | Promotion, h: hint(c, now) })),
    ...data.promotions.map((p) => ({ kind: "promotion" as const, e: p as Campaign | Promotion, h: hint(p, now) })),
  ].filter((x) => x.h?.live)

  function bar(item: Item) {
    const isCampaign = item.kind === "campaign"
    const s = item.startsAt ? +new Date(item.startsAt) : null
    const e = item.endsAt ? +new Date(item.endsAt) : null
    const label = `${item.name}: ${STATUS_LABEL[item.status]}${item.isActive ? "" : ", turned off"}, ${schedText(item)}. Edit`
    const common = {
      onClick: () => onOpen(item.kind, item.id),
      "aria-label": label,
      title: label,
    }
    const pill =
      "absolute top-1/2 z-[2] inline-flex -translate-y-1/2 cursor-pointer items-center gap-1 rounded-full border border-dashed bg-card px-2.5 py-0.5 text-xs whitespace-nowrap text-muted-foreground hover:border-muted-foreground hover:text-foreground"

    if (s === null && e === null) {
      return (
        <button type="button" className={cn(pill, "left-3")} {...common}>
          No dates set
        </button>
      )
    }
    const from = s ?? +start
    const to = e ?? +end
    if (to <= +start) {
      return (
        <button type="button" className={cn(pill, "left-3")} {...common}>
          <ChevronLeftIcon className="size-3" />
          {fmtDate(new Date(e ?? s!).toISOString())}
        </button>
      )
    }
    if (from >= +end) {
      return (
        <button type="button" className={cn(pill, "right-3")} {...common}>
          {fmtDate(new Date(s ?? e!).toISOString())}
          <ChevronRightIcon className="size-3" />
        </button>
      )
    }

    const left = Math.max(0, ((from - +start) / span) * 100)
    const right = Math.min(100, ((to - +start) / span) * 100)
    const width = Math.max(right - left, 0.5)
    const openLeft = s === null || s < +start
    const openRight = e === null || e > +end
    const text = isCampaign ? shortSched(item) : offerText(item as Promotion)
    const narrow = width < (isCampaign ? 12 : 7.5)
    const flip = narrow && left + width > 78

    // Bars running past the visible range fade out at that edge.
    let mask: string | undefined
    if (openLeft && openRight) mask = "linear-gradient(to right,transparent,#000 36px,#000 calc(100% - 36px),transparent)"
    else if (openRight) mask = "linear-gradient(to right,#000 calc(100% - 36px),transparent)"
    else if (openLeft) mask = "linear-gradient(to left,#000 calc(100% - 36px),transparent)"

    return (
      <button
        type="button"
        {...common}
        style={{ left: `${left}%`, width: `${width}%`, maskImage: mask, WebkitMaskImage: mask }}
        className={cn(
          "absolute top-1/2 z-[2] flex min-w-2 -translate-y-1/2 cursor-pointer items-center font-semibold whitespace-nowrap hover:brightness-95",
          isCampaign ? "h-8 rounded-[7px] px-3 text-[13px]" : "h-[22px] rounded px-2 text-xs",
          STATUS_STYLE[item.status],
          !item.isActive && "opacity-45",
          openLeft && "rounded-l-none",
          openRight && "rounded-r-none",
          narrow && "overflow-visible p-0"
        )}
      >
        <span
          className={cn(
            "pointer-events-none truncate",
            openLeft && !narrow && "pl-5",
            narrow && "absolute overflow-visible text-foreground/80",
            narrow && (flip ? "right-[calc(100%+7px)]" : "left-[calc(100%+7px)]")
          )}
        >
          {text}
        </span>
      </button>
    )
  }

  const row = (item: Item) => (
    <div
      key={item.id}
      className={cn(
        "grid border-t border-border/60 transition-opacity",
        linked && !linked.includes(item.id) && "opacity-30"
      )}
      style={{ gridTemplateColumns: `${LABEL_WIDTH}px minmax(0,1fr)` }}
      onMouseEnter={() => setHoverId(item.id)}
      onMouseLeave={() => setHoverId(null)}
    >
      <div className="sticky left-0 z-[4] flex min-w-0 flex-col justify-center gap-0.5 border-r bg-card px-4 py-2.5">
        <button
          type="button"
          onClick={() => onOpen(item.kind, item.id)}
          className="truncate text-left font-semibold hover:underline hover:underline-offset-2"
        >
          {item.name || "Untitled"}
        </button>
        <span className="flex min-w-0 items-center gap-1.5 overflow-hidden text-[12.5px] whitespace-nowrap text-muted-foreground">
          {item.kind === "campaign" ? (
            <>
              <StatusBadge status={item.status} />
              {(item as Campaign).isFeatured && (
                <span className="inline-flex items-center gap-0.5 font-semibold text-amber-600">
                  <StarIcon className="size-3 fill-current" />
                  Featured
                </span>
              )}
              {!item.isActive && <span>Hidden</span>}
            </>
          ) : (
            <span className="truncate">{targetsSummary(data.catalog, item as Promotion)}</span>
          )}
        </span>
      </div>
      <div className={cn("relative min-w-0", item.kind === "campaign" ? "h-14" : "h-[42px]")}>{bar(item)}</div>
    </div>
  )

  const groupHead = (title: string, count: number) => (
    <div className="grid" style={{ gridTemplateColumns: `${LABEL_WIDTH}px minmax(0,1fr)` }}>
      <div className="sticky left-0 z-[4] flex items-baseline gap-2 border-r bg-card px-4 pt-5 pb-2">
        <h2 className="text-[15px] font-bold">{title}</h2>
        <span className="text-[13px] text-muted-foreground">{count}</span>
      </div>
      <div />
    </div>
  )

  const emptyRow = (text: string, action: () => void, label: string) => (
    <div className="grid border-t border-border/60" style={{ gridTemplateColumns: `${LABEL_WIDTH}px minmax(0,1fr)` }}>
      <div className="sticky left-0 z-[4] border-r bg-card px-4 py-2.5 text-muted-foreground">{text}</div>
      <div className="relative h-[42px]">
        <button
          type="button"
          onClick={action}
          className="absolute top-1/2 left-3 inline-flex -translate-y-1/2 items-center gap-1 rounded-full border border-dashed bg-card px-2.5 py-0.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <PlusIcon className="size-3" />
          {label}
        </button>
      </div>
    </div>
  )

  const listRow = (kind: "campaign" | "promotion", id: string, name: string, text: string, right?: string) => (
    <li key={kind + id + text} className="flex items-start gap-3 border-t border-border/60 py-2.5 first:border-t-0 first:pt-0.5">
      <span className="mt-0.5 text-muted-foreground">
        {kind === "campaign" ? <FlagIcon className="size-4" /> : <TagIcon className="size-4" />}
      </span>
      <div className="min-w-0 flex-1">
        <button type="button" onClick={() => onOpen(kind, id)} className="font-semibold hover:underline">
          {name || "Untitled"}
        </button>
        {text && <p className="mt-0.5 text-[13px] text-foreground/75">{text}</p>}
      </div>
      {right && <span className="ml-auto pl-2 text-[12.5px] font-semibold whitespace-nowrap text-emerald-700">{right}</span>}
    </li>
  )

  return (
    <>
      <header className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div>
          <h1 className="text-[38px] leading-none font-bold tracking-tight">Planner</h1>
          <p className="mt-2 max-w-[60ch] text-muted-foreground">
            Every campaign and promotion on one calendar. Point at a campaign to see the promotions linked to it.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Show earlier months"
            onClick={() => setRange({ ...range, offset: range.offset - Math.max(1, Math.floor(range.months / 3)) })}
          >
            <ChevronLeftIcon />
          </Button>
          <span className="min-w-[170px] text-center text-[15px] font-semibold" aria-live="polite">
            {rangeLabel}
          </span>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Show later months"
            onClick={() => setRange({ ...range, offset: range.offset + Math.max(1, Math.floor(range.months / 3)) })}
          >
            <ChevronRightIcon />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setRange({ ...range, offset: range.months === 3 ? 0 : -1 })}>
            Today
          </Button>
          <Segmented
            value={String(range.months)}
            options={[3, 6, 12].map((n) => ({ value: String(n), label: `${n} months` }))}
            onChange={(value) => setRange({ months: Number(value), offset: value === "3" ? 0 : -1 })}
          />
        </div>
      </header>

      <div className="overflow-x-auto overscroll-x-contain rounded-xl border bg-card">
        <div className="relative min-w-[900px]">
          <div className="grid border-b" style={{ gridTemplateColumns: `${LABEL_WIDTH}px minmax(0,1fr)` }}>
            <div className="sticky left-0 z-[4] flex items-center border-r bg-card px-4 text-[12.5px] text-muted-foreground">
              {plural(campaigns.length + promotions.length, "item")}
            </div>
            <div className="relative h-[46px]">
              {months.map(({ m, left, width, isNow }, i) => (
                <div
                  key={+m}
                  style={{ left: `${left}%`, width: `${width}%` }}
                  className={cn(
                    "absolute inset-y-0 overflow-hidden border-l px-2.5 py-3 text-[13.5px] font-semibold whitespace-nowrap",
                    i === 0 && "border-l-0",
                    isNow && "text-red-600"
                  )}
                >
                  {MON[m.getMonth()]}
                  {(i === 0 || m.getMonth() === 0) && (
                    <em className="font-medium text-muted-foreground not-italic">
                      {" "}
                      {range.months > 6 ? `’${String(m.getFullYear()).slice(2)}` : m.getFullYear()}
                    </em>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 right-0 z-[1]" style={{ left: LABEL_WIDTH }} aria-hidden>
              {months.slice(1).map(({ m, left }) => (
                <i key={+m} className="absolute inset-y-0 w-px bg-border/60" style={{ left: `${left}%` }} />
              ))}
            </div>
            {todayInRange && (
              <div
                aria-hidden
                className="pointer-events-none absolute inset-y-0 z-[3] -ml-px w-0.5 bg-red-600"
                style={{ left: `calc(${LABEL_WIDTH}px + (100% - ${LABEL_WIDTH}px) * ${todayFraction})` }}
              >
                <span className="absolute top-3.5 left-1.5 text-xs font-bold whitespace-nowrap text-red-600">Today</span>
              </div>
            )}

            {groupHead("Campaigns", campaigns.length)}
            {campaigns.length > 0
              ? campaigns.map((c) => row({ ...c, kind: "campaign" }))
              : emptyRow("No campaigns yet", onNewCampaign, "New campaign")}
            {groupHead("Promotions", promotions.length)}
            {promotions.length > 0
              ? promotions.map((p) => row({ ...p, kind: "promotion" }))
              : emptyRow("No promotions yet", onNewPromotion, "New promotion")}
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4.5 gap-y-2 text-[12.5px] text-muted-foreground" aria-label="Legend">
        {(["ACTIVE", "SCHEDULED", "DRAFT", "ENDED"] as const).map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5">
            <i className={cn("inline-block h-3 w-6 rounded-[3px]", STATUS_STYLE[s])} />
            {STATUS_LABEL[s]}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <i className="inline-block h-3 w-6 rounded-[3px] bg-emerald-700 opacity-45" />
          Turned off
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="inline-block h-3.5 w-0.5 bg-red-600" />
          Today
        </span>
        <span className="flex-1" />
        <label className="inline-flex cursor-pointer items-center gap-2">
          <Switch checked={showArchived} onCheckedChange={setShowArchived} />
          Show archived
        </label>
      </div>

      <div className="mt-5.5 grid items-start gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section className="rounded-xl border bg-card px-5 py-4.5" aria-labelledby="live-h">
          <h2 id="live-h" className="mb-3 text-base font-bold">
            Live now
          </h2>
          {live.length > 0 ? (
            <ul>
              {live.map(({ kind, e, h }) => {
                const text = h!.text.replace(/^Live, /, "")
                return listRow(
                  kind,
                  e.id,
                  e.name,
                  kind === "promotion" ? offerSentence(e as Promotion) : "",
                  text.charAt(0).toUpperCase() + text.slice(1)
                )
              })}
            </ul>
          ) : (
            <p className="text-[12.5px] text-muted-foreground">
              Nothing is live right now. Scheduled items appear here once they start.
            </p>
          )}
        </section>
        <section className="rounded-xl border bg-card px-5 py-4.5" aria-labelledby="attn-h">
          <h2 id="attn-h" className="mb-3 flex items-center gap-2 text-base font-bold">
            Needs attention
            <span
              className={cn(
                "rounded-full px-2 text-xs leading-5 font-bold",
                items.length > 0 ? "bg-amber-100 text-amber-800" : "bg-muted text-muted-foreground"
              )}
            >
              {items.length}
            </span>
          </h2>
          {items.length > 0 ? (
            <ul>{items.map((it) => listRow(it.kind, it.id, it.name, it.text))}</ul>
          ) : (
            <p className="text-[12.5px] text-muted-foreground">
              Nothing to fix. Schedules, links and campaign pages all line up.
            </p>
          )}
        </section>
      </div>
    </>
  )
}

// The HTML's pill-shaped segmented control, used for ranges and status filters.
export function Segmented({
  value,
  options,
  onChange,
}: {
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
}) {
  return (
    <div className="inline-flex flex-wrap gap-0.5 rounded-lg bg-muted p-[3px]" role="group">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className="rounded-md px-2.5 py-1 text-[13px] font-semibold whitespace-nowrap text-foreground/75 aria-pressed:bg-card aria-pressed:text-foreground aria-pressed:shadow-sm"
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
