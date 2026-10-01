"use client"

import { useState } from "react"
import { CopyIcon, PencilIcon, PlusIcon, SearchIcon, StarIcon, Trash2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

import {
  campaignProductCount,
  hint,
  hueOf,
  initials,
  plural,
  schedText,
  STATUS_LABEL,
  STATUS_ORDER,
  STATUSES,
  type Campaign,
  type MarketingData,
} from "./marketing-utils"
import { Segmented } from "./planner-view"
import { HintText, StatusBadge } from "./status"

export function Thumb({ name, seed, size = 40 }: { name: string; seed: string; size?: number }) {
  const h = hueOf(seed)
  return (
    <span
      className="grid flex-none place-items-center rounded-[9px] text-[13px] font-bold"
      style={{ width: size, height: size, background: `hsl(${h} 42% 90%)`, color: `hsl(${h} 45% 26%)` }}
    >
      {initials(name)}
    </span>
  )
}

export function EmptyState({ title, text, children }: { title: string; text: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-5 py-9 text-center text-muted-foreground">
      <strong className="text-base text-foreground">{title}</strong>
      {text}
      {children}
    </div>
  )
}

export function CampaignList({
  data,
  now,
  onOpen,
  onNew,
  onToggleFeatured,
  onToggleActive,
  onDuplicate,
  onDelete,
}: {
  data: MarketingData
  now: number
  onOpen: (id: string) => void
  onNew: () => void
  onToggleFeatured: (c: Campaign) => void
  onToggleActive: (c: Campaign, isActive: boolean) => void
  onDuplicate: (c: Campaign) => void
  onDelete: (c: Campaign) => void
}) {
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("ALL")

  const q = search.trim().toLowerCase()
  const rows = data.campaigns
    .filter((c) => (status === "ALL" || c.status === status) && (!q || c.name.toLowerCase().includes(q) || c.slug.includes(q)))
    .sort(
      (a, b) =>
        STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || (b.startsAt ?? "").localeCompare(a.startsAt ?? "")
    )

  return (
    <>
      <header className="mb-5">
        <h1 className="text-[38px] leading-none font-bold tracking-tight">Campaigns</h1>
        <p className="mt-2 max-w-[60ch] text-muted-foreground">
          Sales events shoppers can browse, each with its own banners, product sections and linked promotions.
        </p>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <label className="flex max-w-[360px] flex-[1_1_240px] items-center gap-2 rounded-lg border bg-card px-2.5 text-muted-foreground focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
          <SearchIcon className="size-4" />
          <input
            type="search"
            value={search}
            placeholder="Search by name or slug"
            aria-label="Search campaigns"
            className="h-9 w-full bg-transparent text-foreground outline-none"
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <Segmented
          value={status}
          options={[{ value: "ALL", label: "All" }, ...STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }))]}
          onChange={setStatus}
        />
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card">
        {data.campaigns.length === 0 && (
          <EmptyState title="No campaigns yet" text="Create one to group banners, product sections and offers into a single sales event.">
            <Button onClick={onNew}>
              <PlusIcon data-icon="inline-start" />
              New campaign
            </Button>
          </EmptyState>
        )}
        {data.campaigns.length > 0 && rows.length === 0 && (
          <EmptyState title="No campaigns match" text="Try a different search or status.">
            <Button
              variant="outline"
              onClick={() => {
                setSearch("")
                setStatus("ALL")
              }}
            >
              Clear filters
            </Button>
          </EmptyState>
        )}
        {rows.length > 0 && (
          <table className="w-full min-w-[940px] border-collapse">
            <thead>
              <tr className="[&>th]:border-b [&>th]:px-3.5 [&>th]:py-3 [&>th]:text-left [&>th]:text-[12.5px] [&>th]:font-semibold [&>th]:whitespace-nowrap [&>th]:text-muted-foreground">
                <th>Campaign</th>
                <th>Status</th>
                <th>Schedule</th>
                <th className="!text-right">Sections</th>
                <th className="!text-right">Offers</th>
                <th>Featured</th>
                <th>Visible</th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                let progress: number | null = null
                if (c.startsAt && c.endsAt) {
                  const s = +new Date(c.startsAt)
                  const e = +new Date(c.endsAt)
                  progress = e > s ? Math.max(0, Math.min(100, ((now - s) / (e - s)) * 100)) : 0
                }
                return (
                  <tr key={c.id} className="border-b border-border/60 last:border-b-0 hover:bg-muted/40 [&>td]:px-3.5 [&>td]:py-3 [&>td]:align-middle">
                    <td>
                      <button type="button" onClick={() => onOpen(c.id)} className="group flex items-center gap-3 text-left">
                        <Thumb name={c.name} seed={c.slug} />
                        <span>
                          <strong className="block font-semibold group-hover:underline group-hover:underline-offset-2">
                            {c.name}
                          </strong>
                          <small className="text-xs text-muted-foreground">/campaigns/{c.slug}</small>
                        </span>
                      </button>
                    </td>
                    <td>
                      <StatusBadge status={c.status} />
                      <HintText hint={hint(c, now)} className="mt-0.5" />
                    </td>
                    <td>
                      <div className="min-w-[170px] text-[13px]">
                        {c.startsAt || c.endsAt ? schedText(c) : <span className="text-muted-foreground">No dates set</span>}
                        {progress !== null && (
                          <div
                            className="mt-1.5 h-1 overflow-hidden rounded-sm bg-muted"
                            role="img"
                            aria-label={`${Math.round(progress)}% of the run has passed`}
                          >
                            <i className="block h-full bg-emerald-700" style={{ width: `${progress}%` }} />
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="text-right tabular-nums">
                      {c.sections.length}
                      <small className="block text-xs text-muted-foreground">
                        {plural(campaignProductCount(data.catalog, c), "product")}
                      </small>
                    </td>
                    <td className="text-right tabular-nums">{c.promotionIds.length}</td>
                    <td>
                      <button
                        type="button"
                        aria-pressed={c.isFeatured}
                        aria-label={`Feature ${c.name} on the homepage`}
                        onClick={() => onToggleFeatured(c)}
                        className={cn(
                          "grid size-8 place-items-center rounded-lg hover:bg-muted",
                          c.isFeatured ? "text-amber-500" : "text-border"
                        )}
                      >
                        <StarIcon className={cn("size-[18px]", c.isFeatured && "fill-current")} />
                      </button>
                    </td>
                    <td>
                      <Switch
                        checked={c.isActive}
                        aria-label={`Show ${c.name} on the storefront`}
                        className="data-checked:bg-emerald-700"
                        onCheckedChange={(checked) => onToggleActive(c, checked)}
                      />
                    </td>
                    <td className="text-right whitespace-nowrap">
                      <Button variant="ghost" size="icon-sm" aria-label={`Edit ${c.name}`} title="Edit" onClick={() => onOpen(c.id)}>
                        <PencilIcon />
                      </Button>
                      <Button variant="ghost" size="icon-sm" aria-label={`Duplicate ${c.name}`} title="Duplicate" onClick={() => onDuplicate(c)}>
                        <CopyIcon />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Delete ${c.name}`}
                        title="Delete"
                        className="hover:text-destructive"
                        onClick={() => onDelete(c)}
                      >
                        <Trash2Icon />
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}
