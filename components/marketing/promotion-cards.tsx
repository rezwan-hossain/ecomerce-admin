"use client"

import { useState } from "react"
import { CopyIcon, PencilIcon, PlusIcon, SearchIcon, Trash2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

import { EmptyState } from "./campaign-list"
import {
  hint,
  money,
  offerText,
  plural,
  PROMO_TYPES,
  schedText,
  STATUS_LABEL,
  STATUS_ORDER,
  STATUS_STYLE,
  STATUSES,
  targetsSummary,
  TYPE_LABEL,
  type MarketingData,
  type Promotion,
} from "./marketing-utils"
import { Segmented } from "./planner-view"
import { HintText, StatusBadge } from "./status"

const scopeItems = [
  { value: "ANY", label: "Any scope" },
  { value: "ALL", label: "All products" },
  { value: "SPECIFIC", label: "Specific products" },
]

const typeItems = [{ value: "ALL", label: "All offer types" }, ...PROMO_TYPES.map((t) => ({ value: t.value, label: t.label }))]

export function PromotionCards({
  data,
  now,
  onOpen,
  onNew,
  onToggleActive,
  onDuplicate,
  onDelete,
}: {
  data: MarketingData
  now: number
  onOpen: (id: string) => void
  onNew: () => void
  onToggleActive: (p: Promotion, isActive: boolean) => void
  onDuplicate: (p: Promotion) => void
  onDelete: (p: Promotion) => void
}) {
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("ALL")
  const [type, setType] = useState("ALL")
  const [scope, setScope] = useState("ANY")

  const q = search.trim().toLowerCase()
  const rows = data.promotions
    .filter(
      (p) =>
        (status === "ALL" || p.status === status) &&
        (type === "ALL" || p.type === type) &&
        (scope === "ANY" || p.scope === scope) &&
        (!q || p.name.toLowerCase().includes(q))
    )
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || b.priority - a.priority)

  return (
    <>
      <header className="mb-5">
        <h1 className="text-[38px] leading-none font-bold tracking-tight">Promotions</h1>
        <p className="mt-2 max-w-[60ch] text-muted-foreground">
          Discount rules applied at checkout. When offers overlap, the one with the higher priority applies first.
        </p>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <label className="flex max-w-[360px] flex-[1_1_240px] items-center gap-2 rounded-lg border bg-card px-2.5 text-muted-foreground focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
          <SearchIcon className="size-4" />
          <input
            type="search"
            value={search}
            placeholder="Search by name"
            aria-label="Search promotions"
            className="h-9 w-full bg-transparent text-foreground outline-none"
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <Segmented
          value={status}
          options={[{ value: "ALL", label: "All" }, ...STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }))]}
          onChange={setStatus}
        />
        <Select value={type} onValueChange={(value) => setType(value ?? "ALL")} items={typeItems}>
          <SelectTrigger aria-label="Filter by offer type" className="h-9 w-48 bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {typeItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={scope} onValueChange={(value) => setScope(value ?? "ANY")} items={scopeItems}>
          <SelectTrigger aria-label="Filter by scope" className="h-9 w-44 bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {scopeItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {data.promotions.length === 0 && (
        <div className="rounded-xl border bg-card">
          <EmptyState title="No promotions yet" text="Create a discount, a bundle deal or a delivery offer.">
            <Button onClick={onNew}>
              <PlusIcon data-icon="inline-start" />
              New promotion
            </Button>
          </EmptyState>
        </div>
      )}
      {data.promotions.length > 0 && rows.length === 0 && (
        <div className="rounded-xl border bg-card">
          <EmptyState title="No promotions match" text="Try a different search, status or offer type.">
            <Button
              variant="outline"
              onClick={() => {
                setSearch("")
                setStatus("ALL")
                setType("ALL")
                setScope("ANY")
              }}
            >
              Clear filters
            </Button>
          </EmptyState>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[repeat(auto-fill,minmax(360px,1fr))]">
        {rows.map((p) => {
          const offer = offerText(p)
          return (
            <article
              key={p.id}
              className="grid grid-cols-[104px_minmax(0,1fr)] overflow-hidden rounded-xl border bg-card md:grid-cols-[124px_minmax(0,1fr)]"
            >
              {/* The ticket stub, coloured by status. */}
              <div
                className={cn(
                  "flex flex-col justify-center gap-1.5 border-r-2 border-dashed border-border px-3.5 py-4.5 shadow-none",
                  STATUS_STYLE[p.status],
                  (p.status === "SCHEDULED" || p.status === "DRAFT") && "shadow-none",
                  p.status === "DRAFT" && "border-y-0 border-l-0",
                  !p.isActive && "opacity-50"
                )}
              >
                <strong className={cn("leading-tight font-extrabold tracking-tight break-words", offer.length > 10 ? "text-lg" : "text-[23px]")}>
                  {offer}
                </strong>
                <small className="text-xs font-medium opacity-85">{TYPE_LABEL[p.type]}</small>
              </div>

              <div className="flex min-w-0 flex-col gap-2 px-4 pt-3.5 pb-2.5">
                <h3 className="text-base leading-snug font-bold">
                  <button type="button" onClick={() => onOpen(p.id)} className="text-left hover:underline hover:underline-offset-2">
                    {p.name}
                  </button>
                </h3>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <StatusBadge status={p.status} />
                  <HintText hint={hint(p, now)} />
                </div>
                <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3.5 gap-y-0.5 text-[13px]">
                  <dt className="text-muted-foreground">Applies to</dt>
                  <dd className="flex min-w-0 flex-wrap items-center gap-1.5">
                    {p.scope === "ALL" && (
                      <span className="rounded-full bg-emerald-50 px-2 text-xs leading-5 font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        All products
                      </span>
                    )}
                    {p.scope === "SPECIFIC" && p.targets.length === 0 && (
                      <span className="rounded-full bg-amber-100 px-2 text-xs leading-5 font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                        No targets
                      </span>
                    )}
                    {p.scope === "SPECIFIC" && p.targets.length > 0 && (
                      <>
                        <span className="rounded-full bg-muted px-2 text-xs leading-5 font-semibold">{plural(p.targets.length, "target")}</span>
                        <span className="truncate">{targetsSummary(data.catalog, p)}</span>
                      </>
                    )}
                  </dd>
                  <dt className="text-muted-foreground">Runs</dt>
                  <dd>{schedText(p)}</dd>
                  <dt className="text-muted-foreground">Conditions</dt>
                  <dd>{p.minOrderAmount ? `Orders of ${money(p.minOrderAmount)} or more` : "None"}</dd>
                  <dt className="text-muted-foreground">Priority</dt>
                  <dd>
                    {p.priority}
                    {p.campaignIds.length > 0 && `, shown in ${plural(p.campaignIds.length, "campaign")}`}
                  </dd>
                </dl>
                <footer className="mt-auto flex items-center gap-0.5 border-t border-border/60 pt-2">
                  <label className="mr-auto inline-flex cursor-pointer items-center gap-2 text-[13px]">
                    <Switch
                      checked={p.isActive}
                      aria-label={`Enable ${p.name}`}
                      className="data-checked:bg-emerald-700"
                      onCheckedChange={(checked) => onToggleActive(p, checked)}
                    />
                    Enabled
                  </label>
                  <Button variant="ghost" size="icon-sm" aria-label={`Edit ${p.name}`} title="Edit" onClick={() => onOpen(p.id)}>
                    <PencilIcon />
                  </Button>
                  <Button variant="ghost" size="icon-sm" aria-label={`Duplicate ${p.name}`} title="Duplicate" onClick={() => onDuplicate(p)}>
                    <CopyIcon />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Delete ${p.name}`}
                    title="Delete"
                    className="hover:text-destructive"
                    onClick={() => onDelete(p)}
                  >
                    <Trash2Icon />
                  </Button>
                </footer>
              </div>
            </article>
          )
        })}
      </div>
    </>
  )
}
