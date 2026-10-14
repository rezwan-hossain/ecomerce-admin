"use client"

// Report filters live in the URL, so a report can be shared or refreshed. These pieces read and write it.

import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"
import { ArrowDownIcon, ArrowUpIcon, ChevronLeftIcon, ChevronRightIcon, SearchIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

import { VariantSelect, type VariantOption } from "../doc-bits"

const REPORTS = [
  { href: "/inventory/reports/stock-value", text: "Stock value" },
  { href: "/inventory/reports/slow-moving", text: "Slow-moving & dead" },
  { href: "/inventory/reports/turnover", text: "Turnover" },
  { href: "/inventory/reports/history", text: "SKU stock history" },
]

export function ReportTabs() {
  const pathname = usePathname()
  return (
    <nav aria-label="Reports" className="mx-4 flex max-w-full gap-0.5 self-start overflow-x-auto rounded-xl bg-muted p-1 lg:mx-6">
      {REPORTS.map((r) => (
        <Link
          key={r.href}
          href={r.href}
          aria-current={pathname === r.href ? "page" : undefined}
          className={cn(
            "inline-flex h-8 items-center rounded-lg px-3 text-[13px] font-medium whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground",
            pathname === r.href && "bg-card text-foreground shadow-xs ring-1 ring-foreground/5"
          )}
        >
          {r.text}
        </Link>
      ))}
    </nav>
  )
}

// The URL with `patch` applied: empty values clear a param, and any filter change goes back to page 1.
export function withParams(pathname: string, params: URLSearchParams, patch: Record<string, string | null>) {
  const next = new URLSearchParams(params.toString())
  for (const [key, value] of Object.entries(patch)) {
    if (value === null || value === "") next.delete(key)
    else next.set(key, value)
  }
  if (!("page" in patch)) next.delete("page")
  return `${pathname}?${next.toString()}`
}

export function ParamSelect({ name, value, items, label, className }: { name: string; value: string; items: { value: string; label: string }[]; label: string; className?: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const setParams = (patch: Record<string, string | null>) => router.push(withParams(pathname, params, patch))
  return (
    // "all" means no filter, so the param is cleared.
    <Select value={value} items={items} onValueChange={(v) => setParams({ [name]: v === "all" ? null : (v as string) })}>
      <SelectTrigger size="sm" aria-label={label} className={cn("w-40 bg-card", className)}><SelectValue /></SelectTrigger>
      <SelectContent>
        {items.map((i) => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}
      </SelectContent>
    </Select>
  )
}

export function ParamSearch({ value, placeholder }: { value: string; placeholder: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const setParams = (patch: Record<string, string | null>) => router.push(withParams(pathname, params, patch))
  const [text, setText] = useState(value)
  return (
    <form
      className="relative"
      onSubmit={(e) => {
        e.preventDefault()
        setParams({ search: text.trim() || null })
      }}
    >
      <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input aria-label="Search" placeholder={placeholder} className="h-8 w-56 bg-card pl-8" value={text} onChange={(e) => setText(e.target.value)} />
    </form>
  )
}

export function ParamNumber({ name, value, label, suffix }: { name: string; value: string; label: string; suffix: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const setParams = (patch: Record<string, string | null>) => router.push(withParams(pathname, params, patch))
  const [text, setText] = useState(value)
  return (
    <form
      className="flex items-center gap-1.5 text-sm text-muted-foreground"
      onSubmit={(e) => {
        e.preventDefault()
        if (/^\d+$/.test(text.trim())) setParams({ [name]: text.trim() })
      }}
    >
      {label}
      <Input aria-label={label} inputMode="numeric" className="h-8 w-20 bg-card text-right tabular-nums" value={text} onChange={(e) => setText(e.target.value)} />
      {suffix}
    </form>
  )
}

export function ParamSwitch({ name, checked, label }: { name: string; checked: boolean; label: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const setParams = (patch: Record<string, string | null>) => router.push(withParams(pathname, params, patch))
  return (
    <label className="flex items-center gap-2 text-sm">
      <Switch checked={checked} onCheckedChange={(on) => setParams({ [name]: on ? "true" : null })} />
      {label}
    </label>
  )
}

export function DateRange({ from, to }: { from: string; to: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const setParams = (patch: Record<string, string | null>) => router.push(withParams(pathname, params, patch))
  return (
    <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
      <Input type="date" aria-label="From" className="h-8 w-36 bg-card" value={from} onChange={(e) => setParams({ dateFrom: e.target.value })} />
      to
      <Input type="date" aria-label="To" className="h-8 w-36 bg-card" value={to} onChange={(e) => setParams({ dateTo: e.target.value })} />
    </span>
  )
}

// A column header that sorts by `field`; clicking the current one flips the order.
export function SortHeader({ field, text, sortBy, sortOrder, className }: { field: string; text: string; sortBy: string; sortOrder: string; className?: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const setParams = (patch: Record<string, string | null>) => router.push(withParams(pathname, params, patch))
  const active = sortBy === field
  return (
    <button
      type="button"
      className={cn("inline-flex items-center gap-1 font-medium hover:text-foreground", active && "text-foreground", className)}
      onClick={() => setParams({ sortBy: field, sortOrder: active && sortOrder === "desc" ? "asc" : "desc" })}
    >
      {text}
      {active && (sortOrder === "desc" ? <ArrowDownIcon className="size-3" /> : <ArrowUpIcon className="size-3" />)}
    </button>
  )
}

export function Pager({ page, totalPages, total, noun }: { page: number; totalPages: number; total: number; noun: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const setParams = (patch: Record<string, string | null>) => router.push(withParams(pathname, params, patch))
  return (
    <div className="flex items-center justify-between border-t px-4 py-2 text-xs text-muted-foreground">
      <span>
        {total.toLocaleString("en-IN")} {noun}
      </span>
      <span className="flex items-center gap-2">
        Page {page} of {Math.max(1, totalPages)}
        <Button size="icon-sm" variant="outline" aria-label="Previous page" disabled={page <= 1} onClick={() => setParams({ page: String(page - 1) })}>
          <ChevronLeftIcon />
        </Button>
        <Button size="icon-sm" variant="outline" aria-label="Next page" disabled={page >= totalPages} onClick={() => setParams({ page: String(page + 1) })}>
          <ChevronRightIcon />
        </Button>
      </span>
    </div>
  )
}

export function VariantPicker({ options, value }: { options: VariantOption[]; value: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const setParams = (patch: Record<string, string | null>) => router.push(withParams(pathname, params, patch))
  return (
    <div className="w-full max-w-md">
      <VariantSelect options={options} value={value} onChange={(variantId) => setParams({ variantId })} />
    </div>
  )
}
