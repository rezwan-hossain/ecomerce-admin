// Formatting and links shared by the report pages (server-safe: no "use client").

import { taka } from "../inventory-ui"

export const money = (value: string | null | undefined) => (value === null || value === undefined ? "—" : taka(Number(value), 2))

// Ratios can be null when there's nothing to divide by.
export function ratio(n: number | null, suffix = "") {
  if (n === null) return "—"
  return `${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}${suffix}`
}

export type Search = Record<string, string | string[] | undefined>

// One query param as a string ("" when missing or repeated).
export const param = (search: Search, key: string) => (typeof search[key] === "string" ? (search[key] as string) : "")

// The current report URL with some params changed; changing a filter goes back to page 1.
export function hrefWith(pathname: string, search: Search, patch: Record<string, string | null>) {
  const next = new URLSearchParams()
  for (const [key, value] of Object.entries(search)) if (typeof value === "string") next.set(key, value)
  for (const [key, value] of Object.entries(patch)) {
    if (value === null || value === "") next.delete(key)
    else next.set(key, value)
  }
  if (!("page" in patch)) next.delete("page")
  const q = next.toString()
  return q ? `${pathname}?${q}` : pathname
}
