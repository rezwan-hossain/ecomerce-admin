// Types and pure helpers shared by the Create product page and its panels.

export type ProductImage = { id: string; src: string; alt: string }

export type ProductOption = { id: string; name: string; values: string[] }

// An option saved on the Options page (from the /options API).
export type SavedOption = { id: string; name: string; displayName: string | null; values: string[] }

export type VariantState = {
  sku: string
  price: string
  stock: string
  active: boolean
  selected: boolean
  imageId: string | null
  compareAt: string
  cost: string
  barcode: string
  weight: string
}

export type VariantPart = { option: ProductOption; value: string }

export type VariantRow = { key: string; parts: VariantPart[]; v: VariantState }

export type Bulk = { price: string; stock: string; prefix: string }

export const MAX_OPTIONS = 3

export const uid = () => Math.random().toString(36).slice(2, 10)

export const isPrice = (s: string) => /^\d+(\.\d{1,2})?$/.test(s.trim()) && Number(s) > 0
export const isStock = (s: string) => /^\d+$/.test(s.trim())

export const isColorOption = (option: ProductOption) => /colou?r/i.test(option.name)

// "Navy Blue" → "navyblue", which the browser knows as a color. Unknown names get a dashed swatch.
export function cssColor(value: string) {
  const color = value.trim().toLowerCase().replace(/\s+/g, "")
  if (typeof CSS !== "undefined" && CSS.supports("color", color)) return color
  return null
}

const SKU_ABBR: Record<string, string> = {
  black: "BLK", white: "WHT", red: "RED", blue: "BLU", green: "GRN", grey: "GRY", gray: "GRY",
  navy: "NVY", brown: "BRN", yellow: "YLW", orange: "ORG", purple: "PRP", pink: "PNK",
  olive: "OLV", beige: "BGE", silver: "SLV", gold: "GLD",
}

const abbr = (value: string) =>
  SKU_ABBR[value.trim().toLowerCase()] ?? value.replace(/[^a-z0-9]/gi, "").slice(0, 4).toUpperCase()

// "AM-5" + Red / 41 → "AM-5-RED-41"
export const buildSku = (prefix: string, parts: VariantPart[]) =>
  [prefix.trim(), ...parts.map((p) => abbr(p.value))].filter(Boolean).join("-").toUpperCase()

// Used when the bulk SKU prefix is empty: "Nike Air Max Alpha 5" → "NAMA5".
export const namePrefix = (name: string) =>
  name
    .split(/\s+/)
    .map((word) => (/^\d+$/.test(word) ? word : word.charAt(0)))
    .join("")
    .replace(/[^a-z0-9]/gi, "")
    .slice(0, 6)
    .toUpperCase()

// Keyed by option id, so renaming an option keeps its variants.
// A product without options has one variant, keyed "default".
export const keyOf = (parts: VariantPart[]) =>
  parts.length > 0 ? parts.map((p) => `${p.option.id}=${p.value}`).join("|") : "default"

export const rowLabel = (parts: VariantPart[]) =>
  parts.length > 0 ? parts.map((p) => p.value).join(" / ") : "Default"

// Every combination of the option values: Red / 40, Red / 41, Black / 40, …
// With no option values it's one empty combination: the default variant.
export function combos(options: ProductOption[]): VariantPart[][] {
  const withValues = options.filter((o) => o.values.length > 0)
  return withValues.reduce<VariantPart[][]>(
    (acc, option) => acc.flatMap((combo) => option.values.map((value) => [...combo, { option, value }])),
    [[]]
  )
}

// Adds a variant for every new combination. Existing ones keep what was typed.
export function withNewVariants(
  options: ProductOption[],
  variants: Record<string, VariantState>,
  bulk: Bulk
) {
  const next = { ...variants }
  for (const parts of combos(options)) {
    const key = keyOf(parts)
    if (!next[key]) {
      next[key] = {
        sku: buildSku(bulk.prefix, parts),
        price: bulk.price,
        stock: bulk.stock || "0",
        active: true,
        selected: false,
        imageId: null,
        compareAt: "",
        cost: "",
        barcode: "",
        weight: "",
      }
    }
  }
  return next
}

export type CellErrors = { sku: string; price: string; stock: string }

// Per-row messages, plus counts for the summary under the table.
export function checkRows(rows: VariantRow[]) {
  const counts: Record<string, number> = {}
  for (const row of rows) {
    const sku = row.v.sku.trim().toUpperCase()
    if (sku) counts[sku] = (counts[sku] ?? 0) + 1
  }

  const cells: Record<string, CellErrors> = {}
  const totals = { dup: 0, empty: 0, badPrice: 0, badStock: 0 }
  for (const { key, v } of rows) {
    const sku = v.sku.trim().toUpperCase()
    let skuError = ""
    if (!sku) skuError = "SKU is required"
    else if (counts[sku] > 1) skuError = "This SKU is used by another variant"
    const priceError = v.active && !isPrice(v.price) ? "Enter a price above 0" : ""
    const stockError = !isStock(v.stock) ? "Enter a whole number" : ""

    if (!sku) totals.empty++
    else if (counts[sku] > 1) totals.dup++
    if (priceError) totals.badPrice++
    if (stockError) totals.badStock++
    cells[key] = { sku: skuError, price: priceError, stock: stockError }
  }
  return { cells, totals }
}

export const plural = (n: number, one: string, many: string) => (n === 1 ? one : many)

export const money = (n: number) =>
  "৳" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
