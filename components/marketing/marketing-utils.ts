// Types and pure helpers for the Marketing planner, campaign and promotion views.
// Dates are ISO strings; ids starting with "new-" haven't been saved yet.

export type Status = "DRAFT" | "SCHEDULED" | "ACTIVE" | "ENDED" | "ARCHIVED"
export type PromoType =
  | "PERCENTAGE"
  | "FIXED_AMOUNT"
  | "FIXED_PRICE"
  | "BUY_X_GET_Y"
  | "FREE_SHIPPING"
  | "SHIPPING_DISCOUNT"
export type TargetType = "CATEGORY" | "BRAND" | "TAG" | "PRODUCT" | "VARIANT"
// ALL applies to every product (and has no targets); SPECIFIC applies only to what the targets match.
export type PromotionScope = "ALL" | "SPECIFIC"

export type Banner = {
  id: string
  title: string
  imageUrl: string
  mobileImageUrl: string
  linkUrl: string
  isActive: boolean
}

export type Rule = {
  id: string
  categoryId: string | null
  brandId: string | null
  tagId: string | null
  matchType: "ANY" | "ALL"
  minPrice: number | null
  maxPrice: number | null
}

export type Section = {
  id: string
  title: string
  slug: string
  description: string
  bannerUrl: string
  isActive: boolean
  productIds: string[] // hand-picked, in display order
  rules: Rule[]
}

export type Campaign = {
  id: string
  name: string
  slug: string
  description: string
  status: Status
  startsAt: string | null
  endsAt: string | null
  bannerUrl: string
  thumbnailUrl: string
  isActive: boolean
  isFeatured: boolean
  metaTitle: string
  metaDescription: string
  metaImageUrl: string
  banners: Banner[]
  sections: Section[]
  promotionIds: string[]
}

export type Target = { id: string; targetType: TargetType; refId: string } // the category, brand, tag, product or variant id

export type Promotion = {
  id: string
  name: string
  description: string
  type: PromoType
  status: Status
  value: number | null
  buyQuantity: number | null
  getQuantity: number | null
  minOrderAmount: number | null
  maxDiscountAmount: number | null
  startsAt: string | null
  endsAt: string | null
  isActive: boolean
  priority: number
  scope: PromotionScope
  targets: Target[]
  campaignIds: string[]
}

export type CatalogProduct = {
  id: string
  name: string
  brandId: string | null
  categoryIds: string[]
  tagIds: string[]
  variants: { id: string; name: string; sku: string; price: number }[]
}

export type Catalog = {
  categories: { id: string; name: string; parentId: string | null }[]
  brands: { id: string; name: string }[]
  tags: { id: string; name: string }[]
  products: CatalogProduct[]
}

export type MarketingData = { campaigns: Campaign[]; promotions: Promotion[]; catalog: Catalog }

/* ---------- Labels ---------- */

export const STATUSES: Status[] = ["DRAFT", "SCHEDULED", "ACTIVE", "ENDED", "ARCHIVED"]
export const STATUS_LABEL: Record<Status, string> = {
  DRAFT: "Draft",
  SCHEDULED: "Scheduled",
  ACTIVE: "Active",
  ENDED: "Ended",
  ARCHIVED: "Archived",
}
export const STATUS_ORDER: Record<Status, number> = { ACTIVE: 0, SCHEDULED: 1, DRAFT: 2, ENDED: 3, ARCHIVED: 4 }

// The planner's status language, shared by bars, ticket stubs and badges.
export const STATUS_STYLE: Record<Status, string> = {
  ACTIVE: "bg-emerald-700 text-white",
  SCHEDULED:
    "bg-[repeating-linear-gradient(135deg,var(--color-emerald-100)_0_5px,var(--color-card)_5px_10px)] text-emerald-800 shadow-[inset_0_0_0_1.5px_var(--color-emerald-700)] dark:bg-[repeating-linear-gradient(135deg,var(--color-emerald-950)_0_5px,var(--color-card)_5px_10px)] dark:text-emerald-300",
  DRAFT: "bg-card text-foreground/75 border-[1.5px] border-dashed border-muted-foreground",
  ENDED: "bg-[#E6DFCE] text-[#574D3A] dark:bg-[#3A3426] dark:text-[#DACDA8]",
  ARCHIVED: "bg-muted text-muted-foreground",
}

export const PROMO_TYPES: { value: PromoType; label: string; description: string }[] = [
  { value: "PERCENTAGE", label: "Percentage off", description: "Take a share off each eligible item." },
  { value: "FIXED_AMOUNT", label: "Amount off", description: "Take a set amount off each eligible item." },
  { value: "FIXED_PRICE", label: "Fixed price", description: "Sell eligible items at one set price." },
  { value: "BUY_X_GET_Y", label: "Buy X get Y", description: "Give free units when shoppers buy enough." },
  { value: "FREE_SHIPPING", label: "Free shipping", description: "Waive the delivery charge." },
  { value: "SHIPPING_DISCOUNT", label: "Shipping discount", description: "Take a set amount off delivery." },
]
export const TYPE_LABEL = Object.fromEntries(PROMO_TYPES.map((t) => [t.value, t.label])) as Record<PromoType, string>
export const VALUE_TYPES: PromoType[] = ["PERCENTAGE", "FIXED_AMOUNT", "FIXED_PRICE", "SHIPPING_DISCOUNT"]
export const isShip = (type: PromoType) => type === "FREE_SHIPPING" || type === "SHIPPING_DISCOUNT"

export const TARGET_TYPES: { value: TargetType; label: string }[] = [
  { value: "CATEGORY", label: "Category" },
  { value: "BRAND", label: "Brand" },
  { value: "TAG", label: "Tag" },
  { value: "PRODUCT", label: "Product" },
  { value: "VARIANT", label: "Variant" },
]

/* ---------- Formatting ---------- */

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
export { MON }

export const plural = (n: number, word: string, words = `${word}s`) => `${n} ${n === 1 ? word : words}`
export const money = (n: number | null) =>
  n === null || Number.isNaN(n) ? "৳ —" : `৳${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`
export const round2 = (n: number) => Math.round(n * 100) / 100

export function fmtDate(iso: string) {
  const d = new Date(iso)
  return `${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}`
}

export function fmtDateTime(iso: string) {
  const d = new Date(iso)
  return `${fmtDate(iso)}, ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}

export function schedText(e: { startsAt: string | null; endsAt: string | null }) {
  if (e.startsAt && e.endsAt) return `${fmtDate(e.startsAt)} to ${fmtDate(e.endsAt)}`
  if (e.startsAt) return `From ${fmtDate(e.startsAt)}`
  if (e.endsAt) return `Until ${fmtDate(e.endsAt)}`
  return "No dates set"
}

export function initials(name: string) {
  const words = name.replace(/[^\p{L}\p{N} ]/gu, " ").trim().split(/\s+/).slice(0, 2)
  return (words.map((w) => w[0]).join("") || "·").toUpperCase()
}

// A stable hue per name, for the initials thumbnail.
export function hueOf(text: string) {
  let h = 0
  for (const c of text || "x") h = (h * 31 + c.charCodeAt(0)) % 360
  return h
}

function rel(t: number, now: number) {
  const diff = t - now
  const abs = Math.abs(diff)
  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour
  let text
  if (abs < hour) text = plural(Math.max(1, Math.round(abs / minute)), "minute")
  else if (abs < day) text = plural(Math.round(abs / hour), "hour")
  else text = plural(Math.round(abs / day), "day")
  return diff > 0 ? `in ${text}` : `${text} ago`
}

export type Hint = { text: string; warn?: boolean; live?: boolean }

// One line explaining what the status and dates mean right now.
export function hint(
  e: { status: Status; isActive: boolean; startsAt: string | null; endsAt: string | null },
  now: number
): Hint | null {
  const start = e.startsAt ? +new Date(e.startsAt) : null
  const end = e.endsAt ? +new Date(e.endsAt) : null
  if (e.status === "DRAFT") return { text: "Not published" }
  if (e.status === "ARCHIVED") return null
  if (!e.isActive) return { text: "Turned off", warn: e.status === "ACTIVE" }
  if (end && end <= now) {
    if (e.status === "ENDED") return { text: `Ended ${rel(end, now)}` }
    return { text: `End date passed ${rel(end, now)}`, warn: true }
  }
  if (start && start > now) {
    if (e.status === "ENDED") return { text: "Ended before it started" }
    return { text: `Starts ${rel(start, now)}` }
  }
  if (e.status === "ACTIVE") return { text: end ? `Live, ends ${rel(end, now)}` : "Live, no end date", live: true }
  if (e.status === "SCHEDULED") return { text: "Start time reached. Set to Active to go live.", warn: true }
  if (e.status === "ENDED") return { text: "Ended manually" }
  return null
}

export function datesOverlap(
  a: { startsAt: string | null; endsAt: string | null },
  b: { startsAt: string | null; endsAt: string | null }
) {
  const aStart = a.startsAt ? +new Date(a.startsAt) : -Infinity
  const aEnd = a.endsAt ? +new Date(a.endsAt) : Infinity
  const bStart = b.startsAt ? +new Date(b.startsAt) : -Infinity
  const bEnd = b.endsAt ? +new Date(b.endsAt) : Infinity
  return aStart < bEnd && bStart < aEnd
}

/* ---------- Catalog ---------- */

export function catPath(catalog: Catalog, id: string | null) {
  const names: string[] = []
  let current = catalog.categories.find((c) => c.id === id)
  while (current) {
    names.unshift(current.name)
    const parentId = current.parentId
    current = catalog.categories.find((c) => c.id === parentId)
  }
  return names.length > 0 ? names.join(" › ") : "Unknown category"
}

// Every category with its full path, parents first.
export function catOptions(catalog: Catalog) {
  const out: { value: string; label: string }[] = []
  const walk = (parentId: string | null) => {
    for (const c of catalog.categories.filter((c) => c.parentId === parentId)) {
      out.push({ value: c.id, label: catPath(catalog, c.id) })
      walk(c.id)
    }
  }
  walk(null)
  return out
}

function inCategory(catalog: Catalog, product: CatalogProduct, categoryId: string) {
  const ids = new Set([categoryId])
  let grew = true
  while (grew) {
    grew = false
    for (const c of catalog.categories) {
      if (c.parentId && ids.has(c.parentId) && !ids.has(c.id)) {
        ids.add(c.id)
        grew = true
      }
    }
  }
  return product.categoryIds.some((id) => ids.has(id))
}

export const minPrice = (p: CatalogProduct) => Math.min(...p.variants.map((v) => v.price))

/* ---------- Campaign sections ---------- */

export const ruleHasCondition = (r: Rule) =>
  Boolean(r.categoryId || r.brandId || r.tagId || r.minPrice !== null || r.maxPrice !== null)

export function ruleMatches(catalog: Catalog, r: Rule, p: CatalogProduct) {
  const conditions: boolean[] = []
  if (r.categoryId) conditions.push(inCategory(catalog, p, r.categoryId))
  if (r.brandId) conditions.push(p.brandId === r.brandId)
  if (r.tagId) conditions.push(p.tagIds.includes(r.tagId))
  if (r.minPrice !== null || r.maxPrice !== null) {
    const price = minPrice(p)
    conditions.push((r.minPrice === null || price >= r.minPrice) && (r.maxPrice === null || price <= r.maxPrice))
  }
  if (conditions.length === 0) return false
  return r.matchType === "ALL" ? conditions.every(Boolean) : conditions.some(Boolean)
}

// Hand-picked products first, then any other product a rule pulls in.
export function sectionProducts(catalog: Catalog, s: Section) {
  const manual = s.productIds
    .map((id) => catalog.products.find((p) => p.id === id))
    .filter((p): p is CatalogProduct => p !== undefined)
  const ruled = catalog.products.filter(
    (p) => !s.productIds.includes(p.id) && s.rules.some((r) => ruleMatches(catalog, r, p))
  )
  return { manual, ruled }
}

export function campaignProductCount(catalog: Catalog, c: Campaign) {
  const ids = new Set<string>()
  for (const s of c.sections.filter((s) => s.isActive)) {
    const { manual, ruled } = sectionProducts(catalog, s)
    for (const p of [...manual, ...ruled]) ids.add(p.id)
  }
  return ids.size
}

/* ---------- Promotions ---------- */

export function targetInfo(catalog: Catalog, t: Target) {
  const type = TARGET_TYPES.find((x) => x.value === t.targetType)!.label
  let name = ""
  if (t.targetType === "CATEGORY") name = catPath(catalog, t.refId)
  if (t.targetType === "BRAND") name = catalog.brands.find((b) => b.id === t.refId)?.name ?? "Unknown brand"
  if (t.targetType === "TAG") name = catalog.tags.find((x) => x.id === t.refId)?.name ?? "Unknown tag"
  if (t.targetType === "PRODUCT") name = catalog.products.find((p) => p.id === t.refId)?.name ?? "Unknown product"
  if (t.targetType === "VARIANT") {
    const product = catalog.products.find((p) => p.variants.some((v) => v.id === t.refId))
    const variant = product?.variants.find((v) => v.id === t.refId)
    name = product && variant ? `${product.name}, ${variant.name}` : "Unknown variant"
  }
  return { type, name }
}

export function targetsSummary(catalog: Catalog, p: Promotion) {
  if (p.scope === "ALL") return "All products"
  if (p.targets.length === 0) return "No targets"
  const names = p.targets.map((t) => targetInfo(catalog, t).name)
  return names.slice(0, 2).join(", ") + (names.length > 2 ? ` and ${names.length - 2} more` : "")
}

function targetMatches(catalog: Catalog, t: Target, p: CatalogProduct, variantId: string) {
  if (t.targetType === "PRODUCT") return p.id === t.refId
  if (t.targetType === "VARIANT") return variantId === t.refId
  if (t.targetType === "CATEGORY") return inCategory(catalog, p, t.refId)
  if (t.targetType === "BRAND") return p.brandId === t.refId
  return p.tagIds.includes(t.refId)
}

export const allVariants = (catalog: Catalog) =>
  catalog.products.flatMap((p) => p.variants.map((v) => ({ p, v })))

export const isEligible = (catalog: Catalog, promo: Promotion, p: CatalogProduct, variantId: string) =>
  promo.scope === "ALL" || promo.targets.some((t) => targetMatches(catalog, t, p, variantId))

export const affectedVariants = (catalog: Catalog, promo: Promotion) =>
  allVariants(catalog).filter(({ p, v }) => isEligible(catalog, promo, p, v.id))

// The short offer printed on tags and ticket stubs: "15% off", "Buy 2 get 1", …
export function offerText(p: Promotion) {
  if (p.type === "PERCENTAGE") return p.value !== null ? `${p.value}% off` : "% off"
  if (p.type === "FIXED_AMOUNT") return p.value !== null ? `${money(p.value)} off` : "Amount off"
  if (p.type === "FIXED_PRICE") return p.value !== null ? `Now ${money(p.value)}` : "Fixed price"
  if (p.type === "BUY_X_GET_Y") return `Buy ${p.buyQuantity ?? "X"} get ${p.getQuantity ?? "Y"}`
  if (p.type === "FREE_SHIPPING") return "Free delivery"
  return p.value !== null ? `${money(p.value)} off delivery` : "Delivery discount"
}

export function offerSentence(p: Promotion) {
  let text = ""
  if (p.type === "PERCENTAGE") {
    text = `${p.value ?? "?"}% off each eligible item`
    if (p.maxDiscountAmount) text += `, capped at ${money(p.maxDiscountAmount)} per order`
  }
  if (p.type === "FIXED_AMOUNT") text = `${money(p.value)} off each eligible item`
  if (p.type === "FIXED_PRICE") text = `Eligible items sell for ${money(p.value)} each`
  if (p.type === "BUY_X_GET_Y") text = `Buy ${p.buyQuantity ?? "?"} eligible items, get ${p.getQuantity ?? "?"} more free`
  if (p.type === "FREE_SHIPPING") text = "Free delivery when the cart has an eligible item"
  if (p.type === "SHIPPING_DISCOUNT") text = `${money(p.value)} off delivery when the cart has an eligible item`
  if (p.minOrderAmount) text += `, on orders of ${money(p.minOrderAmount)} or more`
  return `${text}.`
}

// The price of one unit after the promotion.
export function unitAfter(p: Promotion, price: number) {
  const value = p.value ?? 0
  if (p.type === "PERCENTAGE") {
    let off = (price * value) / 100
    if (p.maxDiscountAmount) off = Math.min(off, p.maxDiscountAmount)
    return round2(price - off)
  }
  if (p.type === "FIXED_AMOUNT") return round2(Math.max(0, price - value))
  if (p.type === "FIXED_PRICE") return value > 0 ? Math.min(price, value) : price
  if (p.type === "BUY_X_GET_Y" && p.buyQuantity && p.getQuantity) {
    return round2((price * p.buyQuantity) / (p.buyQuantity + p.getQuantity))
  }
  return price
}

// The discount on a cart line of `qty` units.
export function lineDiscount(p: Promotion, price: number, qty: number) {
  const value = p.value ?? 0
  let off = 0
  if (p.type === "PERCENTAGE") {
    off = (price * qty * value) / 100
    if (p.maxDiscountAmount) off = Math.min(off, p.maxDiscountAmount)
  }
  if (p.type === "FIXED_AMOUNT") off = Math.min(value, price) * qty
  if (p.type === "FIXED_PRICE") off = value > 0 ? Math.max(0, price - value) * qty : 0
  if (p.type === "BUY_X_GET_Y" && p.buyQuantity && p.getQuantity) {
    off = Math.floor(qty / (p.buyQuantity + p.getQuantity)) * p.getQuantity * price
  }
  return round2(off)
}

/* ---------- Planner panels ---------- */

export type AttentionItem = { kind: "campaign" | "promotion"; id: string; name: string; text: string }

// Things that look wrong: stale statuses, empty pages, offers outside campaign dates, priority ties.
export function attention(data: MarketingData, now: number) {
  const items: AttentionItem[] = []
  const seen = new Set<string>()
  const push = (kind: AttentionItem["kind"], e: { id: string; name: string }, text: string) => {
    if (seen.has(e.id + text)) return
    seen.add(e.id + text)
    items.push({ kind, id: e.id, name: e.name, text })
  }

  for (const c of data.campaigns) {
    const h = hint(c, now)
    if (h?.warn) push("campaign", c, h.text)
    if ((c.status === "ACTIVE" || c.status === "SCHEDULED") && c.isActive) {
      if (campaignProductCount(data.catalog, c) === 0) push("campaign", c, "The campaign page has no products to show.")
      if (!c.banners.some((b) => b.isActive)) push("campaign", c, "No banner is showing at the top of the page.")
    }
  }
  for (const p of data.promotions) {
    const h = hint(p, now)
    if (h?.warn) push("promotion", p, h.text)
    if ((p.status === "ACTIVE" || p.status === "SCHEDULED") && p.scope === "SPECIFIC" && p.targets.length === 0) {
      push("promotion", p, "No targets: this promotion currently applies to no products.")
    }
  }
  for (const p of data.promotions) {
    for (const campaignId of p.campaignIds) {
      const c = data.campaigns.find((x) => x.id === campaignId)
      if (c && !datesOverlap(c, p) && c.status !== "ENDED" && c.status !== "ARCHIVED") {
        push("campaign", c, `“${p.name}” is linked but runs outside the campaign’s dates.`)
      }
    }
  }

  const contenders = data.promotions.filter(
    (p) => (p.status === "ACTIVE" || p.status === "SCHEDULED") && p.isActive && !isShip(p.type) && (p.scope === "ALL" || p.targets.length > 0)
  )
  for (let i = 0; i < contenders.length; i++) {
    for (let j = i + 1; j < contenders.length; j++) {
      const a = contenders[i]
      const b = contenders[j]
      if (a.priority !== b.priority || !datesOverlap(a, b)) continue
      const aVariants = new Set(affectedVariants(data.catalog, a).map((x) => x.v.id))
      const shared = new Set(
        affectedVariants(data.catalog, b)
          .filter((x) => aVariants.has(x.v.id))
          .map((x) => x.p.id)
      )
      if (shared.size > 0) {
        push(
          "promotion",
          a,
          `Same priority as “${b.name}” on ${plural(shared.size, "product")}. Raise the priority of the one that should apply first.`
        )
      }
    }
  }
  return items
}
