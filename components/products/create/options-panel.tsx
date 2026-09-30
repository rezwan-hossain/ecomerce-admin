"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

import {
  cssColor,
  isColorOption,
  MAX_OPTIONS,
  uid,
  type ProductOption,
  type SavedOption,
} from "./product-utils"

export function Swatch({ value }: { value: string }) {
  const color = cssColor(value)
  if (!color) {
    return <span className="inline-block size-3 flex-none rounded-full border border-dashed border-muted-foreground/60" />
  }
  return (
    <span
      className="inline-block size-3 flex-none rounded-full shadow-[inset_0_0_0_1px_rgba(127,127,127,.45)]"
      style={{ background: color }}
    />
  )
}

// Options match saved ones by name, so a typed "color" also gets the saved Color values.
const findSaved = (saved: SavedOption[], name: string) =>
  saved.find((s) => s.name.toLowerCase() === name.trim().toLowerCase())

export function OptionsPanel({
  options,
  savedOptions,
  hasError,
  onChange,
  onRemove,
}: {
  options: ProductOption[]
  savedOptions: SavedOption[]
  hasError: boolean
  onChange: (options: ProductOption[]) => void
  onRemove: (index: number) => void // the page shows an Undo toast
}) {
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [focusId, setFocusId] = useState<string | null>(null)

  function update(id: string, patch: Partial<ProductOption>) {
    onChange(options.map((o) => (o.id === id ? { ...o, ...patch } : o)))
  }

  function addValues(option: ProductOption, raw: string) {
    const values = [...option.values]
    for (const value of raw.split(",").map((s) => s.trim()).filter(Boolean)) {
      if (!values.some((v) => v.toLowerCase() === value.toLowerCase())) values.push(value)
    }
    update(option.id, { values })
    setDrafts({ ...drafts, [option.id]: "" })
  }

  // Adds a saved option with all its values; remove the ones this product doesn't use.
  function addSavedOption(savedId: string) {
    const saved = savedOptions.find((s) => s.id === savedId)!
    onChange([...options, { id: uid(), name: saved.name, values: [...saved.values] }])
  }

  const unusedSaved = savedOptions.filter((s) => !options.some((o) => findSaved([s], o.name)))

  function addOption() {
    const option = { id: uid(), name: "", values: [] }
    onChange([...options, option])
    setFocusId(option.id)
  }

  return (
    <section
      id="fOptions"
      className={cn("mb-5 rounded-[10px] border bg-card p-5", hasError && "border-destructive")}
    >
      <div className="mb-3.5 flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-base font-semibold">Options</h2>
        <p className="text-[13px] text-muted-foreground">
          Options like color and size combine into the variants below.
        </p>
      </div>

      {options.length === 0 && (
        <p className="text-muted-foreground">
          This product has no options, so it&apos;s sold as one default variant. Add an option to create more.
</p>
      )}

      {options.map((option, index) => (
        <div key={option.id} className="border-t py-3.5 first:border-t-0 first:pt-0">
          <div className="mb-2 flex items-center gap-2.5">
            <span className="min-w-15.5 text-[13px] whitespace-nowrap text-muted-foreground">
              Option {index + 1}
            </span>
            <input
              value={option.name}
              autoFocus={focusId === option.id}
              placeholder="Name, e.g. Size"
              aria-label={`Option ${index + 1} name`}
              aria-invalid={hasError && !option.name.trim() && option.values.length > 0}
              className="w-full max-w-60 rounded-md border border-input px-2.5 py-1.75 font-semibold outline-none focus:border-ring focus:ring-3 focus:ring-ring/50 aria-invalid:border-destructive"
              onChange={(event) => update(option.id, { name: event.target.value })}
            />
            {findSaved(savedOptions, option.name)?.displayName && (
              <span className="text-[12.5px] text-muted-foreground">
                Shown as {findSaved(savedOptions, option.name)!.displayName}
              </span>
            )}
            <span className="flex-1" />
            <button
              type="button"
              className="text-[12.5px] font-medium text-destructive hover:underline"
              onClick={() => onRemove(index)}
            >
              Remove option
            </button>
          </div>

          <div
            className="flex min-h-11 cursor-text flex-wrap items-center gap-1.5 rounded-md border border-input p-1.5 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50"
            onClick={(event) => (event.currentTarget.querySelector("input") as HTMLInputElement).focus()}
          >
            {option.values.map((value) => (
              <span
                key={value}
                className="inline-flex items-center gap-1.5 rounded-full border bg-muted py-0.75 pr-0.75 pl-2.5 text-[13px] font-medium"
              >
                {isColorOption(option) && <Swatch value={value} />}
                {value}
                <button
                  type="button"
                  aria-label={`Remove ${value}`}
                  className="size-5.5 rounded-full text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => update(option.id, { values: option.values.filter((v) => v !== value) })}
                >
                  ✕
                </button>
              </span>
            ))}
            <input
              value={drafts[option.id] ?? ""}
              placeholder="Type a value and press Enter"
              aria-label={`Add value to ${option.name || `option ${index + 1}`}`}
              className="min-w-37.5 flex-1 bg-transparent p-1 outline-none"
              onChange={(event) => setDrafts({ ...drafts, [option.id]: event.target.value })}
              onKeyDown={(event) => {
                const draft = drafts[option.id] ?? ""
                if ((event.key === "Enter" || event.key === ",") && draft.trim()) {
                  event.preventDefault()
                  addValues(option, draft)
                } else if (event.key === "Enter") {
                  event.preventDefault()
                } else if (event.key === "Backspace" && !draft && option.values.length > 0) {
                  update(option.id, { values: option.values.slice(0, -1) })
                }
              }}
              onBlur={() => {
                const draft = drafts[option.id] ?? ""
                if (draft.trim()) addValues(option, draft)
              }}
            />
          </div>

          <SavedValues
            saved={findSaved(savedOptions, option.name)}
            option={option}
            onAdd={(values) => update(option.id, { values: [...option.values, ...values] })}
          />
        </div>
      ))}

      <div className="mt-3.5 flex flex-wrap items-center gap-3">
        {unusedSaved.length > 0 && (
          <Select
            value={null}
            onValueChange={(value) => value && addSavedOption(value)}
            items={unusedSaved.map((s) => ({ value: s.id, label: s.name }))}
          >
            <SelectTrigger className="h-8 w-52" aria-label="Add from your options" disabled={options.length >= MAX_OPTIONS}>
              <SelectValue placeholder="Add from your options" />
            </SelectTrigger>
            <SelectContent>
              {unusedSaved.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                  <span className="ml-auto pl-3 text-xs text-muted-foreground">
                    {s.values.length} {s.values.length === 1 ? "value" : "values"}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Button type="button" variant="outline" className="h-8" disabled={options.length >= MAX_OPTIONS} onClick={addOption}>
          {unusedSaved.length > 0 ? "Add custom option" : "Add another option"}
        </Button>
        <span className="text-[12.5px] text-muted-foreground">
          {options.length >= MAX_OPTIONS
            ? `You've reached the limit of ${MAX_OPTIONS} options.`
            : `For example width or material. Up to ${MAX_OPTIONS} options.`}
        </span>
      </div>
    </section>
  )
}

// Saved values this option doesn't use yet, as one-click chips.
function SavedValues({
  saved,
  option,
  onAdd,
}: {
  saved: SavedOption | undefined
  option: ProductOption
  onAdd: (values: string[]) => void
}) {
  const missing = (saved?.values ?? []).filter(
    (value) => !option.values.some((v) => v.toLowerCase() === value.toLowerCase())
  )
  if (missing.length === 0) return null

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[12.5px] text-muted-foreground">
      <span className="mr-0.5">In your store:</span>
      {missing.map((value) => (
        <button
          key={value}
          type="button"
          className="inline-flex items-center gap-1.5 rounded-full border border-dashed px-2.5 py-0.5 hover:border-solid hover:bg-muted hover:text-foreground"
          onClick={() => onAdd([value])}
        >
          {isColorOption(option) && <Swatch value={value} />}+ {value}
        </button>
      ))}
      {missing.length > 1 && (
        <button type="button" className="ml-1 font-medium text-primary hover:underline" onClick={() => onAdd(missing)}>
          Add all
        </button>
      )}
    </div>
  )
}
