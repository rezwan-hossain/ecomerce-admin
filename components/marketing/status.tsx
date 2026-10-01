import { cn } from "@/lib/utils"

import { offerText, STATUS_LABEL, STATUS_STYLE, type Hint, type Promotion, type Status } from "./marketing-utils"

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 flex-none items-center rounded-full px-2 text-[11.5px] font-semibold whitespace-nowrap",
        STATUS_STYLE[status]
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  )
}

export function HintText({ hint, className }: { hint: Hint | null; className?: string }) {
  if (!hint) return null
  return (
    <span
      className={cn(
        "block text-[12.5px] leading-snug text-muted-foreground",
        hint.warn && "text-amber-700 dark:text-amber-400",
        hint.live && "text-emerald-700 dark:text-emerald-400",
        className
      )}
    >
      {hint.text}
    </span>
  )
}

// The little price tag: "15% off", "Buy 2 get 1", … Faded once the offer is over.
export function PriceTag({ promotion }: { promotion: Promotion }) {
  const over = promotion.status === "ENDED" || promotion.status === "ARCHIVED"
  return (
    <span
      className={cn(
        "inline-flex h-[22px] items-center rounded border-l-2 border-dashed px-2 text-xs font-bold whitespace-nowrap",
        over
          ? "border-muted-foreground bg-muted text-muted-foreground"
          : "border-emerald-700 bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
      )}
    >
      {offerText(promotion)}
    </span>
  )
}
