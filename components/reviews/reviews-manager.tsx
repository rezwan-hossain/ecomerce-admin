"use client"

import Link from "next/link"
import { useState } from "react"
import { toast } from "sonner"
import {
  BadgeCheckIcon,
  CheckCheckIcon,
  CheckIcon,
  ClockIcon,
  EyeIcon,
  EyeOffIcon,
  InboxIcon,
  MessageSquareTextIcon,
  PackageIcon,
  RotateCcwIcon,
  StarIcon,
  ThumbsDownIcon,
  TrendingDownIcon,
  TrendingUpIcon,
  XIcon,
} from "lucide-react"

import { moderateReview } from "@/app/actions/review.actions"
import { Card, fmtDate, n0, Pill, rel, type Tone } from "@/components/inventory/inventory-ui"
import { ListTable, type ListColumn, type ListFilter } from "@/components/list-table"
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import type { Review, ReviewStatus } from "@/types/review.type"

const DAY = 86_400_000
const STATUS_TONE: Record<ReviewStatus, Tone> = { PENDING: "amber", APPROVED: "green", REJECTED: "grey" }
const STATUS_TEXT: Record<ReviewStatus, string> = { PENDING: "Pending", APPROVED: "Live", REJECTED: "Hidden" }
const RATINGS = [
  { value: "all", label: "All ratings" },
  ...[5, 4, 3, 2, 1].map((n) => ({ value: String(n), label: `${n} ${n === 1 ? "star" : "stars"}` })),
]
const SORTS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "lowest", label: "Lowest rating" },
  { value: "highest", label: "Highest rating" },
]

const reviewer = (r: Review) => [r.user?.firstName, r.user?.lastName].filter(Boolean).join(" ") || "Anonymous"
const average = (list: Review[]) => (list.length ? list.reduce((s, r) => s + r.rating, 0) / list.length : 0)

function Stars({ rating, className }: { rating: number; className?: string }) {
  return (
    <span className={cn("flex text-amber-500", className)} aria-label={`${rating} of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <StarIcon key={star} className={cn("size-3.5", star <= Math.round(rating) ? "fill-current" : "text-muted-foreground/30")} />
      ))}
    </span>
  )
}

// The rating as a small coloured number, so a 1 stands out from a 5 at a glance.
function RatingChip({ rating }: { rating: number }) {
  let tone = "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-900"
  if (rating === 3) tone = "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:ring-amber-900"
  if (rating <= 2) tone = "bg-red-50 text-red-700 ring-red-200 dark:bg-red-950 dark:text-red-300 dark:ring-red-900"
  return <span className={cn("rounded-md px-1.5 text-[11px] leading-5 font-bold tabular-nums ring-1", tone)}>{rating.toFixed(0)}.0</span>
}

function Tile({ icon: Icon, label, value, hint, warn, bars }: { icon: typeof StarIcon; label: string; value: string; hint: string; warn?: boolean; bars?: number[] }) {
  const max = Math.max(1, ...(bars ?? []))
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-2xl border bg-card p-4">
      <div className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
        <span className={cn("grid size-6 place-items-center rounded-md", warn ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" : "bg-primary/10 text-primary")}>
          <Icon className="size-3.5" />
        </span>
        {label}
      </div>
      <strong className={cn("truncate text-2xl font-bold tracking-tight tabular-nums", warn && "text-amber-700 dark:text-amber-400")}>{value}</strong>
      <span className="text-[11px] text-muted-foreground">{hint}</span>
      {bars && (
        // The last 12 months, oldest on the left.
        <span className="mt-1 flex h-8 items-end gap-0.5" aria-hidden>
          {bars.map((v, i) => (
            <span key={i} className={cn("flex-1 rounded-t-[2px]", i === bars.length - 1 ? "bg-chart-1" : "bg-chart-1/35")} style={{ height: `${v ? Math.max(8, (v / max) * 100) : 4}%` }} />
          ))}
        </span>
      )}
    </div>
  )
}

function ProductThumb({ src, className }: { src?: string; className?: string }) {
  return (
    <span className={cn("grid size-9 shrink-0 place-items-center overflow-hidden rounded-lg border bg-muted", className)}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- any image host is allowed
        <img src={src} alt="" className="size-full object-cover" />
      ) : (
        <PackageIcon className="size-4 text-muted-foreground" />
      )}
    </span>
  )
}

export function ReviewsManager({ reviews, images }: { reviews: Review[]; images: Record<string, string> }) {
  const [rating, setRating] = useState("all")
  const [sort, setSort] = useState("newest")
  const [busy, setBusy] = useState<string | null>(null)

  // Only approved reviews show in the store and count toward a product's rating.
  const live = reviews.filter((r) => r.status === "APPROVED")
  const pending = reviews.filter((r) => r.status === "PENDING")
  const recent = reviews.filter((r) => Date.now() - new Date(r.createdAt).getTime() < 30 * DAY)
  const verified = reviews.filter((r) => r.isVerifiedPurchase)
  const lowRecent = recent.filter((r) => r.rating <= 2)
  const [bulk, setBulk] = useState(false)
  const [bulkDone, setBulkDone] = useState<number | null>(null)
  const positivePending = pending.filter((r) => r.rating >= 4)
  // A review's last update is when it was approved or hidden, so the gap is how long it waited.
  const decided = reviews.filter((r) => r.status !== "PENDING" && r.updatedAt > r.createdAt)
  const waits = decided.map((r) => (new Date(r.updatedAt).getTime() - new Date(r.createdAt).getTime()) / DAY).sort((a, b) => a - b)
  const medianWait = waits.length ? waits[Math.floor(waits.length / 2)] : null
  let waitText = "—"
  if (medianWait !== null) waitText = medianWait < 1 ? "same day" : `${Math.round(medianWait)} days`
  const sentiment = [
    { label: "Positive", hint: "4–5 stars", count: live.filter((r) => r.rating >= 4).length, tone: "bg-emerald-500" },
    { label: "Neutral", hint: "3 stars", count: live.filter((r) => r.rating === 3).length, tone: "bg-amber-400" },
    { label: "Negative", hint: "1–2 stars", count: live.filter((r) => r.rating <= 2).length, tone: "bg-red-500" },
  ]
  // Reviews per month, the last 12 months.
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date()
    d.setDate(1)
    d.setMonth(d.getMonth() - (11 - i))
    return `${d.getFullYear()}-${d.getMonth()}`
  })
  const monthOf = (iso: string) => `${new Date(iso).getFullYear()}-${new Date(iso).getMonth()}`
  const perMonth = months.map((m) => reviews.filter((r) => monthOf(r.createdAt) === m).length)
  const monthly = (list: Review[]) => months.map((m) => list.filter((r) => monthOf(r.createdAt) === m).length)
  const ratingPerMonth = months.map((m) => {
    const list = live.filter((r) => monthOf(r.createdAt) === m)
    return list.length ? average(list) : 0
  })
  const oldestPending = pending.reduce<Review | undefined>((oldest, r) => (!oldest || r.createdAt < oldest.createdAt ? r : oldest), undefined)

  // Per product, from live reviews; two or more so one angry review doesn't rank a product.
  const byProduct = new Map<string, { id: string; name: string; reviews: Review[] }>()
  for (const r of live) {
    const row = byProduct.get(r.productId) ?? { id: r.productId, name: r.product?.name ?? "Unknown product", reviews: [] }
    row.reviews.push(r)
    byProduct.set(r.productId, row)
  }
  const ranked = [...byProduct.values()].filter((p) => p.reviews.length >= 2).map((p) => ({ ...p, avg: average(p.reviews) }))
  const lowest = [...ranked].sort((a, b) => a.avg - b.avg).filter((p) => p.avg < 4).slice(0, 5)
  const highest = [...ranked].sort((a, b) => b.avg - a.avg || b.reviews.length - a.reviews.length).slice(0, 5)

  async function moderate(r: Review, status: "APPROVED" | "REJECTED") {
    setBusy(r.id)
    const res = await moderateReview(r.id, r.productId, status)
    setBusy(null)
    if (!res.success) return toast.error(res.error)
    toast.success(status === "APPROVED" ? "Review is live in the store" : "Review hidden from the store", { description: `${reviewer(r)} on ${r.product?.name ?? "the product"}` })
  }

  // Approves the pending 4–5 star reviews one by one; the backend has no bulk endpoint.
  async function approvePositive() {
    setBusy("bulk")
    let failed = 0
    for (const [index, r] of positivePending.entries()) {
      setBulkDone(index)
      const res = await moderateReview(r.id, r.productId, "APPROVED")
      if (!res.success) failed++
    }
    setBusy(null)
    setBulkDone(null)
    setBulk(false)
    if (failed) toast.error(`${failed} of ${positivePending.length} couldn't be approved`, { description: "They're still waiting; try them one by one." })
    else toast.success(`${positivePending.length} reviews are live in the store`)
  }

  const rows = reviews
    .filter((r) => rating === "all" || r.rating === Number(rating))
    .sort((a, b) => {
      if (sort === "oldest") return a.createdAt.localeCompare(b.createdAt)
      if (sort === "lowest") return a.rating - b.rating || b.createdAt.localeCompare(a.createdAt)
      if (sort === "highest") return b.rating - a.rating || b.createdAt.localeCompare(a.createdAt)
      return b.createdAt.localeCompare(a.createdAt)
    })

  // Pending reviews wait for a decision, so their tab comes first while there are any.
  const all: ListFilter<Review> = { label: "All", value: "all", match: () => true }
  const toModerate: ListFilter<Review> = { label: "To moderate", value: "pending", match: (r) => r.status === "PENDING" }
  const tabs: ListFilter<Review>[] = [
    ...(pending.length > 0 ? [toModerate, all] : [all]),
    { label: "Live", value: "live", match: (r) => r.status === "APPROVED" },
    { label: "Hidden", value: "hidden", match: (r) => r.status === "REJECTED" },
    { label: "1–2 stars", value: "low", match: (r) => r.rating <= 2 },
    { label: "Verified buyers", value: "verified", match: (r) => r.isVerifiedPurchase },
  ]
  const filters = tabs.filter((f, index) => index === 0 || reviews.some(f.match))

  const columns: ListColumn<Review>[] = [
    {
      key: "review",
      header: "Review",
      cell: (r) => (
        <div className="flex max-w-md min-w-64 flex-col gap-1 whitespace-normal">
          <div className="flex items-center gap-2">
            <RatingChip rating={r.rating} />
            <Stars rating={r.rating} />
            {r.isVerifiedPurchase && (
              <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                <BadgeCheckIcon className="size-3.5" />
                Verified buyer
              </span>
            )}
          </div>
          {r.title && <span className="font-medium">{r.title}</span>}
          {r.body && (
            <span title={r.body} className="line-clamp-2 text-[13px] text-muted-foreground">
              {r.body}
            </span>
          )}
        </div>
      ),
    },
    {
      key: "product",
      header: "Product",
      className: "hidden md:table-cell",
      cell: (r) => (
        <Link href={`/products/${r.productId}`} className="group flex max-w-48 items-center gap-2.5">
          <ProductThumb src={images[r.productId]} />
          <span className="truncate text-[13px] font-medium group-hover:text-primary group-hover:underline">{r.product?.name ?? "Unknown product"}</span>
        </Link>
      ),
    },
    {
      key: "customer",
      header: "Customer",
      className: "hidden lg:table-cell",
      cell: (r) => (
        <span className="flex max-w-44 items-center gap-2">
          <span className="grid size-7 shrink-0 place-items-center overflow-hidden rounded-full bg-primary/10 text-[10px] font-semibold text-primary uppercase">
            {r.user?.image ? (
              // eslint-disable-next-line @next/next/no-img-element -- any image host is allowed
              <img src={r.user.image} alt="" className="size-full object-cover" />
            ) : (
              reviewer(r).slice(0, 2)
            )}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[13px]">{reviewer(r)}</span>
            {r.user?.email && <span className="block truncate text-[11px] text-muted-foreground">{r.user.email}</span>}
          </span>
        </span>
      ),
    },
    {
      key: "date",
      header: "Posted",
      className: "hidden whitespace-nowrap sm:table-cell",
      cell: (r) => (
        <span className="flex flex-col text-[13px]">
          {fmtDate(r.createdAt)}
          <span className="text-[11px] text-muted-foreground">{rel(r.createdAt)}</span>
        </span>
      ),
    },
    { key: "status", header: "Status", cell: (r) => <Pill tone={STATUS_TONE[r.status]}>{STATUS_TEXT[r.status]}</Pill> },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      className: "text-right",
      cell: (r) => {
        const working = busy === r.id
        if (r.status === "PENDING") {
          return (
            <span className="flex justify-end gap-1">
              <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => moderate(r, "REJECTED")} disabled={busy !== null}>
                <XIcon />
                Reject
              </Button>
              <Button size="sm" onClick={() => moderate(r, "APPROVED")} disabled={busy !== null}>
                <CheckIcon />
                {working ? "Saving..." : "Approve"}
              </Button>
            </span>
          )
        }
        if (r.status === "APPROVED") {
          return (
            <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => moderate(r, "REJECTED")} disabled={busy !== null} title="Take it off the store">
              <EyeOffIcon />
              {working ? "Saving..." : "Hide"}
            </Button>
          )
        }
        return (
          <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => moderate(r, "APPROVED")} disabled={busy !== null} title="Put it back in the store">
            <RotateCcwIcon />
            {working ? "Saving..." : "Restore"}
          </Button>
        )
      },
    },
  ]

  return (
    <>
      <section className="grid grid-cols-2 gap-3 px-4 md:grid-cols-3 lg:px-6 xl:grid-cols-6">
        <Tile icon={StarIcon} label="Average rating" value={live.length ? `${average(live).toFixed(1)} ★` : "—"} hint={`from ${n0(live.length)} live reviews`} bars={ratingPerMonth} />
        <Tile icon={MessageSquareTextIcon} label="Reviews" value={n0(reviews.length)} hint={`${n0(recent.length)} in the last 30 days`} bars={perMonth} />
        <Tile icon={InboxIcon} label="To moderate" value={n0(pending.length)} hint={oldestPending ? `oldest waiting ${rel(oldestPending.createdAt).replace(" ago", "")}` : "all caught up"} warn={pending.length > 0} bars={monthly(pending)} />
        <Tile icon={EyeIcon} label="Live in store" value={`${reviews.length ? Math.round((live.length / reviews.length) * 100) : 0}%`} hint={`${n0(reviews.length - live.length - pending.length)} hidden`} bars={monthly(live)} />
        <Tile icon={ThumbsDownIcon} label="1–2 stars" value={n0(lowRecent.length)} hint="in the last 30 days" warn={lowRecent.length > 0} bars={monthly(reviews.filter((r) => r.rating <= 2))} />
        <Tile icon={BadgeCheckIcon} label="Verified buyers" value={`${reviews.length ? Math.round((verified.length / reviews.length) * 100) : 0}%`} hint={`${n0(verified.length)} bought the product`} bars={monthly(verified)} />
      </section>

      {pending.length > 0 && (
        <section className="mx-4 flex flex-wrap items-center gap-4 rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-3 lg:mx-6 dark:border-amber-900 dark:bg-amber-950/40">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
            <InboxIcon className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-semibold">
              {n0(pending.length)} {pending.length === 1 ? "review is" : "reviews are"} waiting for you
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {oldestPending && <span>oldest posted {rel(oldestPending.createdAt)}</span>}
              <span className="text-emerald-700 dark:text-emerald-400">{n0(positivePending.length)} positive</span>
              <span className="text-amber-700 dark:text-amber-400">{n0(pending.filter((r) => r.rating === 3).length)} neutral</span>
              <span className="text-red-700 dark:text-red-400">{n0(pending.filter((r) => r.rating <= 2).length)} negative</span>
            </div>
          </div>
          {positivePending.length > 0 && (
            <Button size="sm" onClick={() => setBulk(true)} disabled={busy !== null}>
              <CheckCheckIcon />
              {busy === "bulk" && bulkDone !== null ? `Approving ${bulkDone + 1} of ${positivePending.length}…` : `Approve the ${n0(positivePending.length)} positive ones`}
            </Button>
          )}
        </section>
      )}

      <div className="grid gap-4 px-4 md:gap-6 lg:grid-cols-3 lg:px-6">
        <Card title="Rating breakdown" className="flex flex-col" action={<span className="text-xs text-muted-foreground">live reviews</span>}>
          <div className="flex flex-1 flex-col gap-4 px-4 pb-4">
            <div className="flex items-center gap-5">
              <div className="text-center">
                <div className="text-4xl font-bold tracking-tight tabular-nums">{live.length ? average(live).toFixed(1) : "—"}</div>
                <Stars rating={average(live)} className="mt-1 justify-center" />
                <div className="mt-1 text-[11px] text-muted-foreground">{n0(live.length)} reviews</div>
              </div>
              <div className="flex flex-1 flex-col gap-1.5">
                {[5, 4, 3, 2, 1].map((star) => {
                  const count = live.filter((r) => r.rating === star).length
                  return (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(rating === String(star) ? "all" : String(star))}
                      className={cn("flex items-center gap-2 rounded-md px-1 text-xs text-muted-foreground hover:bg-muted", rating === String(star) && "bg-muted text-foreground")}
                      title={`Show ${star}-star reviews`}
                    >
                      <span className="flex w-6 items-center gap-0.5 tabular-nums">
                        {star}
                        <StarIcon className="size-3 fill-amber-500 text-amber-500" />
                      </span>
                      <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                        <span className={cn("block h-full rounded-full", star >= 3 ? "bg-amber-500" : "bg-red-400")} style={{ width: `${live.length ? (count / live.length) * 100 : 0}%` }} />
                      </span>
                      <span className="w-6 text-right tabular-nums">{n0(count)}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="flex flex-col gap-1.5 border-t pt-3">
              <span className="text-xs font-medium text-muted-foreground">How customers feel</span>
              <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full">
                {sentiment.map((t) => (
                  <span key={t.label} className={cn("rounded-full", t.tone)} style={{ width: `${live.length ? (t.count / live.length) * 100 : 0}%` }} />
                ))}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {sentiment.map((t) => (
                  <span key={t.label} className="flex flex-col text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <span className={cn("size-2 rounded-full", t.tone)} />
                      {t.label}
                    </span>
                    <span className="text-sm font-semibold text-foreground tabular-nums">{live.length ? Math.round((t.count / live.length) * 100) : 0}%</span>
                    {t.hint}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-auto flex items-center gap-2 rounded-xl bg-muted/50 px-3 py-2 text-xs">
              <ClockIcon className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="flex-1 text-muted-foreground">Typical wait before a decision</span>
              <span className="font-semibold tabular-nums">{waitText}</span>
            </div>
          </div>
        </Card>

        <Card title="Lowest rated" className="flex flex-col" action={<TrendingDownIcon className="size-4 text-red-500" />}>
          {lowest.length === 0 ? (
            <p className="px-4 pb-4 text-sm text-muted-foreground">Every product with two or more reviews averages 4 stars or more.</p>
          ) : (
            <ProductRanking rows={lowest} images={images} />
          )}
        </Card>

        <Card title="Highest rated" className="flex flex-col" action={<TrendingUpIcon className="size-4 text-emerald-600" />}>
          {highest.length === 0 ? <p className="px-4 pb-4 text-sm text-muted-foreground">Not enough reviews yet.</p> : <ProductRanking rows={highest} images={images} />}
        </Card>
      </div>

      <ListTable
        rows={rows}
        columns={columns}
        getRowId={(r) => r.id}
        searchText={(r) => `${r.title ?? ""} ${r.body ?? ""} ${r.product?.name ?? ""} ${reviewer(r)} ${r.user?.email ?? ""}`}
        searchPlaceholder="Search reviews…"
        filters={filters}
        emptyText="No reviews match."
        toolbar={
          <>
            <Select value={rating} items={RATINGS} onValueChange={(v) => setRating(v as string)}>
              <SelectTrigger size="sm" aria-label="Filter by rating" className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RATINGS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sort} items={SORTS} onValueChange={(v) => setSort(v as string)}>
              <SelectTrigger size="sm" aria-label="Sort reviews" className="hidden w-36 sm:flex">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORTS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        }
      />

      <AlertDialog open={bulk} onOpenChange={(open) => busy !== "bulk" && setBulk(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve {n0(positivePending.length)} positive reviews?</AlertDialogTitle>
            <AlertDialogDescription>
              Every pending 4 or 5 star review goes live in the store and counts toward its product&apos;s rating. Neutral and negative ones stay in the queue for
              you to read.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy === "bulk"}>Not now</AlertDialogCancel>
            <Button onClick={approvePositive} disabled={busy === "bulk"}>
              <CheckCheckIcon />
              {busy === "bulk" && bulkDone !== null ? `Approving ${bulkDone + 1} of ${positivePending.length}…` : "Approve them"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function ProductRanking({ rows, images }: { rows: { id: string; name: string; reviews: Review[]; avg: number }[]; images: Record<string, string> }) {
  return (
    <ul className="flex flex-col">
      {rows.map((p) => (
        <li key={p.id}>
          <Link href={`/products/${p.id}`} className="group flex items-center gap-3 border-t border-border/60 px-4 py-2.5 hover:bg-muted/40">
            <ProductThumb src={images[p.id]} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium group-hover:text-primary">{p.name}</span>
              <span className="text-[11px] text-muted-foreground">{n0(p.reviews.length)} reviews</span>
            </span>
            <span className="flex flex-col items-end">
              <span className="text-sm font-semibold tabular-nums">{p.avg.toFixed(1)}</span>
              <Stars rating={p.avg} className="[&_svg]:size-3" />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
