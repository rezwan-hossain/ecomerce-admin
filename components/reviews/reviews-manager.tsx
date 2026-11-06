"use client"

import Link from "next/link"
import { useState } from "react"
import { toast } from "sonner"
import { BadgeCheckIcon, CheckIcon, EyeOffIcon, PackageIcon, RotateCcwIcon, StarIcon, TrendingDownIcon, TrendingUpIcon } from "lucide-react"

import { moderateReview } from "@/app/actions/review.actions"
import { Card, fmtDate, Kpis, n0, Pill, rel, type Tone } from "@/components/inventory/inventory-ui"
import { ListTable, type ListColumn, type ListFilter } from "@/components/list-table"
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
      <Kpis
        items={[
          { label: "Average rating", value: live.length ? `${average(live).toFixed(1)} ★` : "—", hint: `from ${n0(live.length)} live reviews` },
          { label: "Reviews", value: n0(reviews.length), hint: `${n0(recent.length)} in the last 30 days` },
          { label: "To moderate", value: n0(pending.length), hint: oldestPending ? `oldest ${rel(oldestPending.createdAt)}` : "all caught up", warn: pending.length > 0 },
          { label: "Live in store", value: `${reviews.length ? Math.round((live.length / reviews.length) * 100) : 0}%`, hint: `${n0(reviews.length - live.length - pending.length)} hidden` },
          { label: "1–2 stars", value: n0(lowRecent.length), hint: "last 30 days", warn: lowRecent.length > 0 },
          { label: "Verified buyers", value: `${reviews.length ? Math.round((verified.length / reviews.length) * 100) : 0}%`, hint: `${n0(verified.length)} bought the product` },
        ]}
      />

      <div className="grid items-start gap-4 px-4 md:gap-6 lg:grid-cols-3 lg:px-6">
        <Card title="Rating breakdown" action={<span className="text-xs text-muted-foreground">live reviews</span>}>
          <div className="flex items-center gap-5 px-4 pb-4">
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
        </Card>

        <Card title="Lowest rated" action={<TrendingDownIcon className="size-4 text-red-500" />}>
          {lowest.length === 0 ? (
            <p className="px-4 pb-4 text-sm text-muted-foreground">Every product with two or more reviews averages 4 stars or more.</p>
          ) : (
            <ProductRanking rows={lowest} images={images} />
          )}
        </Card>

        <Card title="Highest rated" action={<TrendingUpIcon className="size-4 text-emerald-600" />}>
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
