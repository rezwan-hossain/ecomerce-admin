"use client"

import { useState } from "react"
import { ChevronDownIcon, ChevronUpIcon, CodeIcon, ImageIcon, Trash2Icon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { fromLocalInput, toLocalInput } from "@/lib/datetime"
import { cn } from "@/lib/utils"

import { plural } from "./marketing-utils"

export type Errors = Record<string, string>

// Ids for inputs, so error links can scroll to and focus them.
export const fid = (key: string) => `f-${key.replace(/\./g, "-")}`

export const inputClass =
  "h-10 w-full min-w-0 rounded-lg border bg-card px-3 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50 aria-invalid:border-destructive"

export function Field({
  label,
  name,
  errors,
  hint,
  className,
  children,
}: {
  label: string
  name: string
  errors: Errors
  hint?: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn("mb-4 flex min-w-0 flex-col gap-1.5", className)}>
      <label htmlFor={fid(name)} className="text-[13px] font-semibold">
        {label}
      </label>
      {children}
      {errors[name] && <p className="text-[12.5px] font-medium text-destructive">{errors[name]}</p>}
      {hint && <p className="text-[12.5px] text-muted-foreground">{hint}</p>}
    </div>
  )
}

export function TextInput({
  name,
  value,
  errors,
  onChange,
  ...props
}: {
  name: string
  value: string
  errors: Errors
  onChange: (value: string) => void
} & Omit<React.ComponentProps<"input">, "value" | "onChange" | "name">) {
  return (
    <input
      id={fid(name)}
      value={value}
      aria-invalid={Boolean(errors[name])}
      className={inputClass}
      onChange={(event) => onChange(event.target.value)}
      {...props}
    />
  )
}

// An input with a fixed prefix or suffix, like "/campaigns/" or "%".
export function Affix({
  before,
  after,
  invalid,
  children,
}: {
  before?: string
  after?: string
  invalid?: boolean
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "flex items-stretch overflow-hidden rounded-lg border bg-card focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
        invalid && "border-destructive"
      )}
    >
      {before && <span className="flex items-center bg-muted/60 px-2.5 text-[13.5px] whitespace-nowrap text-muted-foreground">{before}</span>}
      {children}
      {after && <span className="flex items-center bg-muted/60 px-2.5 text-[13.5px] whitespace-nowrap text-muted-foreground">{after}</span>}
    </div>
  )
}

const bareInput = "h-10 w-full min-w-0 bg-transparent px-3 text-sm outline-none"

// Numbers are kept as number | null; an empty box means null.
export function NumberInput({
  name,
  value,
  errors,
  onChange,
  before,
  after,
  ...props
}: {
  name: string
  value: number | null
  errors: Errors
  onChange: (value: number | null) => void
  before?: string
  after?: string
} & Omit<React.ComponentProps<"input">, "value" | "onChange" | "name">) {
  return (
    <Affix before={before} after={after} invalid={Boolean(errors[name])}>
      <input
        id={fid(name)}
        type="number"
        inputMode="decimal"
        value={value ?? ""}
        aria-invalid={Boolean(errors[name])}
        className={bareInput}
        onChange={(event) => onChange(event.target.value === "" ? null : Number(event.target.value))}
        {...props}
      />
    </Affix>
  )
}

export function PrefixInput({
  name,
  value,
  errors,
  before,
  onChange,
  ...props
}: {
  name: string
  value: string
  errors: Errors
  before: string
  onChange: (value: string) => void
} & Omit<React.ComponentProps<"input">, "value" | "onChange" | "name">) {
  return (
    <Affix before={before} invalid={Boolean(errors[name])}>
      <input
        id={fid(name)}
        value={value}
        aria-invalid={Boolean(errors[name])}
        className={bareInput}
        onChange={(event) => onChange(event.target.value)}
        {...props}
      />
    </Affix>
  )
}

// datetime-local in the browser's time zone, stored as ISO.
export function DateTimeInput({
  name,
  value,
  errors,
  onChange,
}: {
  name: string
  value: string | null
  errors: Errors
  onChange: (iso: string | null) => void
}) {
  return (
    <input
      id={fid(name)}
      type="datetime-local"
      value={toLocalInput(value)}
      aria-invalid={Boolean(errors[name])}
      className={inputClass}
      onChange={(event) => onChange(fromLocalInput(event.target.value))}
    />
  )
}

export function Toggle({
  checked,
  label,
  onChange,
}: {
  checked: boolean
  label: string
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2.5 font-medium">
      <Switch checked={checked} onCheckedChange={onChange} className="data-checked:bg-emerald-700" />
      {label}
    </label>
  )
}

// A striped placeholder that shows the image once the URL loads.
export function ImagePreview({ url, ratio }: { url: string; ratio: "wide" | "square" }) {
  const [broken, setBroken] = useState<string | null>(null)
  const name = url.split("/").pop()?.split("?")[0] || url

  return (
    <div
      className={cn(
        "relative grid place-items-center overflow-hidden rounded-lg bg-[repeating-linear-gradient(45deg,var(--color-muted)_0_8px,var(--color-background)_8px_16px)] text-xs text-muted-foreground",
        ratio === "wide" ? "aspect-[16/6]" : "aspect-square max-w-[150px]"
      )}
    >
      {url && broken !== url && (
        // eslint-disable-next-line @next/next/no-img-element -- any image host is allowed
        <img src={url} alt="" loading="lazy" className="absolute inset-0 size-full object-cover" onError={() => setBroken(url)} />
      )}
      <span className="flex flex-col items-center gap-1 p-2 text-center break-all">
        <ImageIcon className="size-[18px]" />
        {url ? name.slice(0, 48) : "No image"}
      </span>
    </div>
  )
}

export function OrderButtons({
  index,
  length,
  onMove,
  row,
}: {
  index: number
  length: number
  onMove: (from: number, to: number) => void
  row?: boolean
}) {
  return (
    <div className={cn("flex gap-0.5", row ? "flex-row" : "flex-col")}>
      <Button variant="ghost" size="icon-xs" aria-label="Move up" disabled={index === 0} onClick={() => onMove(index, index - 1)}>
        <ChevronUpIcon />
      </Button>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label="Move down"
        disabled={index === length - 1}
        onClick={() => onMove(index, index + 1)}
      >
        <ChevronDownIcon />
      </Button>
    </div>
  )
}

export function move<T>(list: T[], from: number, to: number) {
  const next = [...list]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

export function DrawerHead({
  kind,
  isNew,
  title,
  dirty,
  saving,
  onClose,
  onPayload,
  onDelete,
  onSave,
}: {
  kind: "campaign" | "promotion"
  isNew: boolean
  title: string
  dirty: boolean
  saving: boolean
  onClose: () => void
  onPayload: () => void
  onDelete: () => void
  onSave: () => void
}) {
  let saveState = "All changes saved"
  if (isNew) saveState = "Not saved yet"
  else if (dirty) saveState = "Unsaved changes"

  return (
    <header className="flex flex-none flex-wrap items-center gap-3 border-b px-4 py-3 sm:px-6">
      <Button variant="ghost" size="icon" aria-label="Close editor" onClick={onClose}>
        <XIcon />
      </Button>
      <div className="min-w-0 flex-1">
        <span className="block text-[12.5px] leading-tight text-muted-foreground">
          {isNew ? `New ${kind}` : kind === "campaign" ? "Campaign" : "Promotion"}
        </span>
        <h2 className="truncate text-[21px] leading-snug font-bold tracking-tight">{title}</h2>
      </div>
      <span className={cn("text-[12.5px] whitespace-nowrap text-muted-foreground", (isNew || dirty) && "text-amber-700")}>
        {saveState}
      </span>
      <div className="flex items-center gap-1.5">
        <Button variant="ghost" onClick={onPayload}>
          <CodeIcon data-icon="inline-start" />
          <span className="hidden sm:inline">API payload</span>
        </Button>
        {!isNew && (
          <Button variant="ghost" className="hover:text-destructive" onClick={onDelete}>
            <Trash2Icon data-icon="inline-start" />
            <span className="hidden sm:inline">Delete</span>
          </Button>
        )}
        <Button onClick={onSave} disabled={saving}>
          {saving ? "Saving..." : `Save ${kind}`}
        </Button>
      </div>
    </header>
  )
}

export function ErrorBlock({
  errors,
  label,
  onJump,
}: {
  errors: Errors
  label: (key: string) => string
  onJump: (key: string) => void
}) {
  const entries = Object.entries(errors)
  if (entries.length === 0) return null
  return (
    <div role="alert" className="mt-3.5 rounded-lg bg-destructive/10 px-3.5 py-3 text-[13px]">
      <strong className="text-destructive">{plural(entries.length, "thing")} to fix</strong>
      <ul className="mt-1.5 list-disc pl-4.5">
        {entries.map(([key, message]) => (
          <li key={key} className="my-0.5">
            <button type="button" className="text-left underline underline-offset-2" onClick={() => onJump(key)}>
              {label(key)}
            </button>
            : {message}
          </li>
        ))}
      </ul>
    </div>
  )
}

// Scrolls to an error's input (or its message) and focuses it.
export function jumpTo(key: string) {
  setTimeout(() => {
    const target = document.getElementById(fid(key)) ?? document.querySelector(`[data-err="${key}"]`)
    target?.scrollIntoView({ block: "center", behavior: "smooth" })
    if (target instanceof HTMLElement && target.tagName !== "P") target.focus({ preventScroll: true })
  }, 50)
}

export const isUrl = (value: string) => {
  try {
    const url = new URL(value)
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
