"use client"

import { useState } from "react"
import { PlusIcon, XIcon } from "lucide-react"

import { DAY, type Customer } from "@/components/customers/customers-table"
import { n0, taka, type Tone } from "@/components/inventory/inventory-ui"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { cn } from "@/lib/utils"
import { uuidv7 } from "@/lib/uuid"

export type RuleField = "orders" | "spent" | "delivery" | "sinceLast" | "sinceFirst" | "city" | "account"
export type Rule = { id: string; field: RuleField; op: "gte" | "lte" | "is" | "not"; value: string }
export type Group = { id: string; name: string; note: string; tone: Tone; match: "all" | "any"; rules: Rule[] }

const FIELDS: { value: RuleField; label: string; kind: "number" | "money" | "text" | "account"; unit?: string }[] = [
  { value: "orders", label: "Orders", kind: "number" },
  { value: "spent", label: "Paid", kind: "money" },
  { value: "delivery", label: "Delivered", kind: "number", unit: "%" },
  { value: "sinceLast", label: "Last order", kind: "number", unit: "days ago" },
  { value: "sinceFirst", label: "First order", kind: "number", unit: "days ago" },
  { value: "city", label: "District", kind: "text" },
  { value: "account", label: "Checkout", kind: "account" },
]
const fieldOf = (field: RuleField) => FIELDS.find((f) => f.value === field)!
const NUMBER_OPS = [
  { value: "gte", label: "at least" },
  { value: "lte", label: "at most" },
]
const TEXT_OPS = [
  { value: "is", label: "is" },
  { value: "not", label: "is not" },
]
const ACCOUNT_ITEMS = [
  { value: "account", label: "With an account" },
  { value: "guest", label: "As a guest" },
]
export const TONES: Tone[] = ["blue", "green", "amber", "red", "ink", "grey"]
export const DOT: Record<Tone, string> = {
  blue: "bg-blue-500",
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
  ink: "bg-foreground",
  grey: "bg-muted-foreground/50",
}

function valueOf(c: Customer, field: RuleField, now: number) {
  if (field === "orders") return c.orders
  if (field === "spent") return c.spent
  // Nobody can be judged on delivery before an order finishes.
  if (field === "delivery") return c.finished ? (c.delivered / c.finished) * 100 : null
  if (field === "sinceLast") return Math.floor((now - new Date(c.last).getTime()) / DAY)
  return Math.floor((now - new Date(c.first).getTime()) / DAY)
}

function passes(c: Customer, rule: Rule, now: number) {
  if (rule.field === "city") {
    const same = (c.address?.city ?? "").trim().toLowerCase() === rule.value.trim().toLowerCase()
    return rule.op === "not" ? !same : same
  }
  if (rule.field === "account") return c.account === (rule.value === "account")
  const v = valueOf(c, rule.field, now)
  if (v === null) return false
  return rule.op === "lte" ? v <= Number(rule.value) : v >= Number(rule.value)
}

export function matches(c: Customer, group: Group, now: number) {
  if (group.rules.length === 0) return false
  if (group.match === "any") return group.rules.some((r) => passes(c, r, now))
  return group.rules.every((r) => passes(c, r, now))
}

// "Paid at least ৳1,00,000"
export function ruleText(rule: Rule) {
  const f = fieldOf(rule.field)
  if (f.kind === "account") return rule.value === "account" ? "Has an account" : "Checked out as a guest"
  if (f.kind === "text") return `${f.label} ${rule.op === "not" ? "is not" : "is"} ${rule.value}`
  const op = rule.op === "lte" ? "≤" : "≥"
  const amount = f.kind === "money" ? taka(Number(rule.value)) : n0(Number(rule.value))
  let unit = ""
  if (f.unit === "%") unit = "%"
  else if (f.unit) unit = ` ${f.unit}`
  return `${f.label} ${op} ${amount}${unit}`
}

const newRule = (): Rule => ({ id: uuidv7(), field: "orders", op: "gte", value: "2" })

export function GroupSheet({
  group,
  customers,
  onSave,
  onClose,
}: {
  group: Group | "new"
  customers: Customer[]
  onSave: (group: Group) => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState<Group>(
    group === "new" ? { id: uuidv7(), name: "", note: "", tone: "blue", match: "all", rules: [newRule()] } : group
  )
  const now = Date.now()
  const members = customers.filter((c) => matches(c, draft, now))

  let problem = ""
  if (draft.name.trim().length < 2) problem = "Give the group a name."
  else if (draft.rules.length === 0) problem = "Add at least one rule."
  else if (draft.rules.some((r) => !r.value.trim())) problem = "Fill in every rule."

  function setRule(id: string, change: Partial<Rule>) {
    setDraft({ ...draft, rules: draft.rules.map((r) => (r.id === id ? { ...r, ...change } : r)) })
  }

  // A new field brings sensible starting values with it.
  function setField(id: string, field: RuleField) {
    const kind = fieldOf(field).kind
    if (kind === "account") setRule(id, { field, op: "is", value: "account" })
    else if (kind === "text") setRule(id, { field, op: "is", value: "" })
    else setRule(id, { field, op: "gte", value: "" })
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full gap-0 data-[side=right]:sm:max-w-lg">
        <SheetHeader className="border-b">
          <SheetTitle>{group === "new" ? "New customer group" : "Edit group"}</SheetTitle>
          <SheetDescription>Customers join and leave on their own as their orders change.</SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-4">
          <Field>
            <FieldLabel htmlFor="group-name">Name</FieldLabel>
            <Input id="group-name" value={draft.name} maxLength={40} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. Big spenders" />
          </Field>
          <Field>
            <FieldLabel htmlFor="group-note">What it's for</FieldLabel>
            <Input id="group-note" value={draft.note} maxLength={120} onChange={(e) => setDraft({ ...draft, note: e.target.value })} placeholder="e.g. Send early access to new arrivals" />
          </Field>
          <Field>
            <FieldLabel>Colour</FieldLabel>
            <div className="flex gap-2">
              {TONES.map((tone) => (
                <button
                  key={tone}
                  type="button"
                  onClick={() => setDraft({ ...draft, tone })}
                  className={cn("grid size-7 place-items-center rounded-full border", draft.tone === tone && "ring-2 ring-primary ring-offset-2 ring-offset-background")}
                  aria-label={tone}
                >
                  <span className={cn("size-4 rounded-full", DOT[tone])} />
                </button>
              ))}
            </div>
          </Field>

          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">Customers who match</span>
              <ToggleGroup
                variant="outline"
                size="sm"
                multiple={false}
                value={[draft.match]}
                onValueChange={(v) => v[0] && setDraft({ ...draft, match: v[0] as Group["match"] })}
              >
                <ToggleGroupItem value="all">All rules</ToggleGroupItem>
                <ToggleGroupItem value="any">Any rule</ToggleGroupItem>
              </ToggleGroup>
            </div>
            {draft.rules.map((rule, index) => {
              const f = fieldOf(rule.field)
              const ops = f.kind === "text" ? TEXT_OPS : NUMBER_OPS
              return (
                <div key={rule.id} className="flex items-center gap-2">
                  <span className="w-9 shrink-0 text-right text-xs text-muted-foreground">
                    {index === 0 && "Where"}
                    {index > 0 && (draft.match === "all" ? "and" : "or")}
                  </span>
                  <Select value={rule.field} items={FIELDS} onValueChange={(v) => setField(rule.id, v as RuleField)}>
                    <SelectTrigger size="sm" className="w-32" aria-label="Field"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FIELDS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {f.kind === "account" ? (
                    <Select value={rule.value} items={ACCOUNT_ITEMS} onValueChange={(v) => setRule(rule.id, { value: v as string })}>
                      <SelectTrigger size="sm" className="flex-1" aria-label="Checkout"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ACCOUNT_ITEMS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : (
                    <>
                      <Select value={rule.op} items={ops} onValueChange={(v) => setRule(rule.id, { op: v as Rule["op"] })}>
                        <SelectTrigger size="sm" className="w-24" aria-label="Comparison"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {ops.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <div className="relative flex-1">
                        {f.kind === "money" && <span className="absolute top-1/2 left-2.5 -translate-y-1/2 text-sm text-muted-foreground">৳</span>}
                        <Input
                          value={rule.value}
                          onChange={(e) => setRule(rule.id, { value: f.kind === "text" ? e.target.value : e.target.value.replace(/\D/g, "") })}
                          inputMode={f.kind === "text" ? "text" : "numeric"}
                          placeholder={f.kind === "text" ? "e.g. Dhaka" : "0"}
                          className={cn("h-8", f.kind === "money" && "pl-6", f.unit && "pr-16")}
                          aria-label="Value"
                        />
                        {f.unit && <span className="absolute top-1/2 right-2.5 -translate-y-1/2 text-xs text-muted-foreground">{f.unit}</span>}
                      </div>
                    </>
                  )}
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-muted-foreground"
                    onClick={() => setDraft({ ...draft, rules: draft.rules.filter((r) => r.id !== rule.id) })}
                    aria-label="Remove rule"
                  >
                    <XIcon />
                  </Button>
                </div>
              )
            })}
            <Button variant="outline" size="sm" className="self-start" onClick={() => setDraft({ ...draft, rules: [...draft.rules, newRule()] })}>
              <PlusIcon />
              Add rule
            </Button>
          </div>

          <div className="rounded-xl border bg-muted/40 p-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-medium">
                {n0(members.length)} {members.length === 1 ? "customer matches" : "customers match"}
              </span>
              <span className="text-xs text-muted-foreground">
                {customers.length ? Math.round((members.length / customers.length) * 100) : 0}% of {n0(customers.length)}
              </span>
            </div>
            {members.length > 0 && (
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {members.slice(0, 5).map((c) => c.name).join(", ")}
                {members.length > 5 && ` and ${n0(members.length - 5)} more`}
              </p>
            )}
          </div>
        </div>

        <SheetFooter className="flex-row items-center justify-end border-t">
          {problem && <span className="mr-auto text-xs text-muted-foreground">{problem}</span>}
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => onSave({ ...draft, name: draft.name.trim(), note: draft.note.trim() })} disabled={!!problem}>
            {group === "new" ? "Create group" : "Save changes"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
