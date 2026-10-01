"use client"

import { useState } from "react"
import { PlusIcon, XIcon } from "lucide-react"

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

import { EmptyState, Thumb } from "./campaign-list"
import {
  DateTimeInput,
  DrawerHead,
  ErrorBlock,
  Field,
  inputClass,
  jumpTo,
  NumberInput,
  TextInput,
  Toggle,
  type Errors,
} from "./form-bits"
import {
  affectedVariants,
  allVariants,
  catOptions,
  datesOverlap,
  hint,
  isEligible,
  isShip,
  lineDiscount,
  money,
  offerSentence,
  offerText,
  plural,
  PROMO_TYPES,
  round2,
  schedText,
  STATUS_LABEL,
  STATUSES,
  TARGET_TYPES,
  targetInfo,
  targetsSummary,
  unitAfter,
  type MarketingData,
  type Promotion,
  type TargetType,
} from "./marketing-utils"
import { HintText, StatusBadge } from "./status"

const newId = () => `new-${Math.random().toString(36).slice(2, 10)}`
const DEC_MAX = 99999999.99

function validate(p: Promotion) {
  const e: Errors = {}
  if (p.name.trim().length < 2) e.name = "Enter a promotion name (at least 2 characters)."
  const v = p.value
  if (p.type === "PERCENTAGE") {
    if (v === null) e.value = "Enter the percentage off."
    else if (!(v > 0 && v <= 100)) e.value = "Use a number above 0 and up to 100."
    if (p.maxDiscountAmount !== null && !(p.maxDiscountAmount > 0)) e.maxDiscountAmount = "The cap must be more than 0."
  }
  if (p.type === "FIXED_AMOUNT" || p.type === "FIXED_PRICE" || p.type === "SHIPPING_DISCOUNT") {
    if (v === null) e.value = "Enter an amount."
    else if (!(v > 0)) e.value = "The amount must be more than 0."
    else if (v > DEC_MAX) e.value = "The amount is too large."
  }
  if (p.type === "BUY_X_GET_Y") {
    if (!Number.isInteger(p.buyQuantity) || (p.buyQuantity ?? 0) < 1) e.buyQuantity = "Enter a whole number, 1 or more."
    if (!Number.isInteger(p.getQuantity) || (p.getQuantity ?? 0) < 1) e.getQuantity = "Enter a whole number, 1 or more."
  }
  if (p.minOrderAmount !== null && p.minOrderAmount < 0) e.minOrderAmount = "Minimum order can’t be negative."
  if (!Number.isInteger(p.priority)) e.priority = "Use a whole number."
  if (p.startsAt && p.endsAt && new Date(p.endsAt) <= new Date(p.startsAt)) e.endsAt = "End must be after the start."
  if (p.status === "SCHEDULED" && !p.startsAt) e.startsAt = "Scheduled promotions need a start date."
  return e
}

const LABELS: Record<string, string> = {
  name: "Name",
  value: "Offer value",
  buyQuantity: "Buy quantity",
  getQuantity: "Free quantity",
  maxDiscountAmount: "Maximum discount",
  minOrderAmount: "Minimum order",
  priority: "Priority",
  startsAt: "Start date",
  endsAt: "End date",
}

export function PromotionDrawer({
  initial,
  isNew,
  data,
  now,
  saving,
  onClose,
  onSave,
  onDelete,
  onPayload,
}: {
  initial: Promotion
  isNew: boolean
  data: MarketingData
  now: number
  saving: boolean
  onClose: (dirty: boolean) => void
  onSave: (draft: Promotion) => void
  onDelete: () => void
  onPayload: (draft: Promotion) => void
}) {
  const catalog = data.catalog
  const [draft, setDraft] = useState(initial)
  const [dirty, setDirty] = useState(false)
  const [showErrors, setShowErrors] = useState(false)
  const [targetType, setTargetType] = useState<TargetType>("CATEGORY")
  const [targetRef, setTargetRef] = useState("")
  const [confirmAll, setConfirmAll] = useState(false)
  const [sim, setSim] = useState(() => {
    const first = affectedVariants(catalog, initial)[0] ?? allVariants(catalog)[0]
    const qty = initial.type === "BUY_X_GET_Y" ? (initial.buyQuantity ?? 1) + (initial.getQuantity ?? 1) : 1
    return { variantId: first?.v.id ?? "", qty, ship: 60 }
  })

  const errors = showErrors ? validate(draft) : {}

  function update(patch: Partial<Promotion>) {
    setDraft({ ...draft, ...patch })
    setDirty(true)
  }

  function save() {
    const found = validate(draft)
    if (Object.keys(found).length > 0) {
      setShowErrors(true)
      jumpTo(Object.keys(found)[0])
      return
    }
    onSave(draft)
  }

  // Options for the second target picker; ones already added are disabled.
  function refOptions(type: TargetType) {
    const taken = draft.targets.filter((t) => t.targetType === type).map((t) => t.refId)
    let options: { value: string; label: string; group?: string }[] = []
    if (type === "CATEGORY") options = catOptions(catalog)
    if (type === "BRAND") options = catalog.brands.map((b) => ({ value: b.id, label: b.name }))
    if (type === "TAG") options = catalog.tags.map((t) => ({ value: t.id, label: t.name }))
    if (type === "PRODUCT") options = catalog.products.map((p) => ({ value: p.id, label: p.name }))
    if (type === "VARIANT") {
      options = catalog.products.flatMap((p) => p.variants.map((v) => ({ value: v.id, label: `${v.name} (${v.sku})`, group: p.name })))
    }
    return options.map((o) => ({ ...o, taken: taken.includes(o.value) }))
  }

  // Saved targets are removed when the promotion switches to All products, so ask first.
  const savedTargets = isNew ? 0 : initial.targets.length

  function changeScope(scope: Promotion["scope"]) {
    if (scope === "ALL" && draft.scope === "SPECIFIC" && savedTargets > 0) {
      setConfirmAll(true)
      return
    }
    update({ scope })
  }

  function addTarget() {
    const options = refOptions(targetType).filter((o) => !o.taken)
    const ref = options.some((o) => o.value === targetRef) ? targetRef : options[0]?.value
    if (!ref) return
    update({ targets: [...draft.targets, { id: newId(), targetType, refId: ref }] })
  }

  const affected = affectedVariants(catalog, draft)
  const ship = isShip(draft.type)
  const options = refOptions(targetType)
  const refValue = options.some((o) => o.value === targetRef && !o.taken) ? targetRef : (options.find((o) => !o.taken)?.value ?? "")

  const panel = "border-t py-6 first:border-t-0"
  const panelTitle = "mb-1 text-lg font-bold tracking-tight"
  const help = "text-[12.5px] text-muted-foreground"
  const aside = "rounded-xl border bg-muted/40 p-4.5"

  return (
    <Sheet open onOpenChange={(open) => !open && onClose(dirty)}>
      <SheetContent showCloseButton={false} className="w-full gap-0 bg-card p-0 data-[side=right]:sm:max-w-[1140px]">
        <SheetTitle className="sr-only">{draft.name || "New promotion"}</SheetTitle>
        <DrawerHead
          kind="promotion"
          isNew={isNew}
          title={draft.name || "New promotion"}
          dirty={dirty}
          saving={saving}
          onClose={() => onClose(dirty)}
          onPayload={() => onPayload(draft)}
          onDelete={onDelete}
          onSave={save}
        />

        <div className="relative flex-1 overflow-y-auto overscroll-contain">
          <div className="grid gap-7 px-4 pb-18 sm:px-6 lg:grid-cols-[minmax(0,1fr)_352px]">
            <div className="min-w-0">
              {/* Offer */}
              <section className={panel}>
                <h2 className={cn(panelTitle, "mb-3.5")}>Offer</h2>
                <div className="grid gap-x-4.5 sm:grid-cols-2">
                  <Field label="Name" name="name" errors={errors} hint="Shown on receipts and in order history.">
                    <TextInput name="name" value={draft.name} errors={errors} placeholder="e.g. Eid 15% off fashion" maxLength={120} onChange={(name) => update({ name })} />
                  </Field>
                  <Field label="Priority" name="priority" errors={errors} hint="Higher numbers apply first when offers overlap.">
                    <NumberInput name="priority" step={1} value={draft.priority} errors={errors} onChange={(priority) => update({ priority: priority ?? 0 })} />
                  </Field>
                </div>
                <Field label="Description" name="description" errors={errors}>
                  <textarea
                    id="f-description"
                    rows={2}
                    value={draft.description}
                    placeholder="Terms shoppers should know, or a note for your team"
                    className={cn(inputClass, "h-auto py-2 leading-normal")}
                    onChange={(event) => update({ description: event.target.value })}
                  />
                </Field>

                <fieldset className="mt-1.5 mb-4.5 grid min-w-0 grid-cols-2 gap-2 md:grid-cols-3">
                  <legend className="mb-2 text-[13px] font-semibold">Offer type</legend>
                  {PROMO_TYPES.map((t) => (
                    <label key={t.value} className="relative block cursor-pointer">
                      <input
                        type="radio"
                        name="ptype"
                        value={t.value}
                        checked={draft.type === t.value}
                        onChange={() => update({ type: t.value })}
                        className="peer absolute inset-0 m-0 cursor-pointer opacity-0"
                      />
                      <span className="flex h-full flex-col gap-0.5 rounded-lg border px-3 py-2.5 peer-checked:border-emerald-700 peer-checked:bg-emerald-50 peer-checked:shadow-[inset_0_0_0_1px_var(--color-emerald-700)] peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50 hover:border-muted-foreground dark:peer-checked:bg-emerald-950">
                        <strong className="text-sm">{t.label}</strong>
                        <small className="text-xs leading-snug text-muted-foreground">{t.description}</small>
                      </span>
                    </label>
                  ))}
                </fieldset>

                <div className="grid gap-x-4.5 sm:grid-cols-3">
                  {draft.type === "PERCENTAGE" && (
                    <>
                      <Field label="Discount" name="value" errors={errors}>
                        <NumberInput name="value" after="%" min={0} max={100} step={0.5} placeholder="15" value={draft.value} errors={errors} onChange={(value) => update({ value })} />
                      </Field>
                      <Field label="Maximum discount" name="maxDiscountAmount" errors={errors} hint="Optional cap per order.">
                        <NumberInput name="maxDiscountAmount" before="৳" min={0} step={0.01} placeholder="No cap" value={draft.maxDiscountAmount} errors={errors} onChange={(maxDiscountAmount) => update({ maxDiscountAmount })} />
                      </Field>
                    </>
                  )}
                  {draft.type === "FIXED_AMOUNT" && (
                    <Field label="Amount off each item" name="value" errors={errors}>
                      <NumberInput name="value" before="৳" min={0} step={0.01} placeholder="500" value={draft.value} errors={errors} onChange={(value) => update({ value })} />
                    </Field>
                  )}
                  {draft.type === "FIXED_PRICE" && (
                    <Field label="Sale price" name="value" errors={errors} hint="Items already below this keep their price.">
                      <NumberInput name="value" before="৳" min={0} step={0.01} placeholder="999" value={draft.value} errors={errors} onChange={(value) => update({ value })} />
                    </Field>
                  )}
                  {draft.type === "BUY_X_GET_Y" && (
                    <>
                      <Field label="Shopper buys" name="buyQuantity" errors={errors}>
                        <NumberInput name="buyQuantity" after="items" min={1} step={1} placeholder="2" value={draft.buyQuantity} errors={errors} onChange={(buyQuantity) => update({ buyQuantity })} />
                      </Field>
                      <Field label="Gets free" name="getQuantity" errors={errors}>
                        <NumberInput name="getQuantity" after="items" min={1} step={1} placeholder="1" value={draft.getQuantity} errors={errors} onChange={(getQuantity) => update({ getQuantity })} />
                      </Field>
                    </>
                  )}
                  {draft.type === "SHIPPING_DISCOUNT" && (
                    <Field label="Amount off delivery" name="value" errors={errors}>
                      <NumberInput name="value" before="৳" min={0} step={0.01} placeholder="30" value={draft.value} errors={errors} onChange={(value) => update({ value })} />
                    </Field>
                  )}
                  <Field label="Minimum order" name="minOrderAmount" errors={errors} hint="Optional cart subtotal needed to qualify.">
                    <NumberInput name="minOrderAmount" before="৳" min={0} step={0.01} placeholder="None" value={draft.minOrderAmount} errors={errors} onChange={(minOrderAmount) => update({ minOrderAmount })} />
                  </Field>
                </div>
              </section>

              {/* Applies to */}
              <section className={panel}>
                <h2 className={cn(panelTitle, "mb-3")}>Applies to</h2>
                <div className="mb-3 inline-flex flex-wrap gap-0.5 rounded-lg bg-muted p-[3px]" role="radiogroup" aria-label="Applies to">
                  {(
                    [
                      ["ALL", "All products"],
                      ["SPECIFIC", "Specific products"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={draft.scope === value}
                      onClick={() => changeScope(value)}
                      className="rounded-md px-3 py-1.5 text-[13px] font-semibold text-foreground/75 aria-checked:bg-card aria-checked:text-foreground aria-checked:shadow-sm"
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {draft.scope === "ALL" ? (
                  <p className={help}>
                    This promotion applies to all products.
                    {savedTargets > 0 && ` Its ${plural(savedTargets, "target")} will be removed when you save.`}
                  </p>
                ) : (
                  <>
                    <p className={help}>
                      {ship ? "The delivery offer kicks in when the cart has at least one matching item." : "Items only need to match one target."}
                    </p>
                    {draft.targets.length === 0 && (
                      <p className="mt-3 rounded-lg bg-amber-50 px-3.5 py-2.5 text-[13px] text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                        No targets: this promotion currently applies to no products.
                      </p>
                    )}
                    {draft.targets.length > 0 && (
                      <div className="my-3 flex flex-wrap gap-1.5">
                        {draft.targets.map((t, i) => {
                          const info = targetInfo(catalog, t)
                          return (
                            <span key={t.id} className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[12.5px] font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                              <em className="text-[11.5px] text-muted-foreground not-italic">{info.type}</em>
                              {info.name}
                              <button
                                type="button"
                                aria-label={`Remove ${info.type} ${info.name}`}
                                className="grid rounded-full opacity-70 hover:opacity-100"
                                onClick={() => update({ targets: draft.targets.filter((_, j) => j !== i) })}
                              >
                                <XIcon className="size-3.5" />
                              </button>
                            </span>
                          )
                        })}
                      </div>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <select
                        aria-label="Target type"
                        value={targetType}
                        className={cn(inputClass, "w-auto flex-[0_1_170px]")}
                        onChange={(event) => setTargetType(event.target.value as TargetType)}
                      >
                        {TARGET_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                      <select
                        aria-label={`Choose the ${targetType.toLowerCase()}`}
                        value={refValue}
                        className={cn(inputClass, "w-auto flex-[1_1_220px]")}
                        onChange={(event) => setTargetRef(event.target.value)}
                      >
                        {options.length === 0 && <option value="">Nothing to choose yet</option>}
                        {options.map((o) => (
                          <option key={o.value} value={o.value} disabled={o.taken}>
                            {o.group ? `${o.group}: ` : ""}
                            {o.label}
                            {o.taken ? " (added)" : ""}
                          </option>
                        ))}
                      </select>
                      <Button variant="outline" className="h-10" disabled={!refValue} onClick={addTarget}>
                        <PlusIcon data-icon="inline-start" />
                        Add target
                      </Button>
                    </div>
                  </>
                )}

                <AlertDialog open={confirmAll} onOpenChange={setConfirmAll}>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Switch to All products?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Switching to All products will remove the {plural(savedTargets, "existing target")}. Continue?
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <Button
                        onClick={() => {
                          update({ scope: "ALL" })
                          setConfirmAll(false)
                        }}
                      >
                        Switch to All products
                      </Button>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </section>

              {/* Schedule */}
              <section className={panel}>
                <h2 className={cn(panelTitle, "mb-3.5")}>Schedule</h2>
                <div className="grid gap-x-4.5 sm:grid-cols-2">
                  <Field label="Status" name="status" errors={errors}>
                    <select
                      id="f-status"
                      value={draft.status}
                      className={inputClass}
                      onChange={(event) => update({ status: event.target.value as Promotion["status"] })}
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {STATUS_LABEL[s]}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <div className="mb-4 flex flex-col justify-center gap-1.5">
                    <Toggle checked={draft.isActive} label="Enabled" onChange={(isActive) => update({ isActive })} />
                    <p className={help}>Turn off to pause the offer without changing its status.</p>
                  </div>
                </div>
                <div className="grid gap-x-4.5 sm:grid-cols-2">
                  <Field label="Starts" name="startsAt" errors={errors} hint="Leave empty to start as soon as it’s active.">
                    <DateTimeInput name="startsAt" value={draft.startsAt} errors={errors} onChange={(startsAt) => update({ startsAt })} />
                  </Field>
                  <Field label="Ends" name="endsAt" errors={errors} hint="Leave empty to run until you end it.">
                    <DateTimeInput name="endsAt" value={draft.endsAt} errors={errors} onChange={(endsAt) => update({ endsAt })} />
                  </Field>
                </div>
              </section>

              {/* Campaigns */}
              <section className={panel}>
                <h2 className={panelTitle}>Campaigns</h2>
                <p className={cn(help, "mb-4")}>Show this offer on campaign pages.</p>
                {data.campaigns.length === 0 ? (
                  <EmptyState title="No campaigns yet" text="Create a campaign first, then link it here." />
                ) : (
                  <div className="flex flex-col overflow-hidden rounded-lg border">
                    {data.campaigns.map((c) => {
                      const on = draft.campaignIds.includes(c.id)
                      return (
                        <label key={c.id} className="flex cursor-pointer items-center gap-3 border-t border-border/60 px-3.5 py-3 first:border-t-0 hover:bg-muted/40">
                          <input
                            type="checkbox"
                            checked={on}
                            className="size-[18px] flex-none accent-emerald-700"
                            onChange={(event) =>
                              update({
                                campaignIds: event.target.checked ? [...draft.campaignIds, c.id] : draft.campaignIds.filter((id) => id !== c.id),
                              })
                            }
                          />
                          <Thumb name={c.name} seed={c.slug} size={32} />
                          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                            <span className="font-semibold">{c.name}</span>
                            <span className="flex flex-wrap items-center gap-2 text-[12.5px] text-muted-foreground">
                              <StatusBadge status={c.status} />
                              {schedText(c)}
                            </span>
                            {on && !datesOverlap(draft, c) && (
                              <span className="text-[12.5px] text-amber-700">This offer runs outside the campaign’s dates</span>
                            )}
                          </span>
                        </label>
                      )
                    })}
                  </div>
                )}
              </section>
            </div>

            {/* Preview */}
            <aside className="flex flex-col gap-3.5 self-start pt-5 lg:sticky lg:top-5" aria-label="Preview">
              <div className={aside}>
                <div className="-mx-4.5 -mt-4.5 mb-3.5 rounded-t-xl border-b-2 border-dashed border-background bg-emerald-700 px-4.5 pt-5.5 pb-5">
                  <span className="text-[40px] leading-none font-extrabold tracking-tight break-words text-white">{offerText(draft)}</span>
                </div>
                <p className="mb-3.5 text-[15px] leading-snug font-medium">{offerSentence(draft)}</p>
                <dl className="flex flex-col gap-2.5">
                  <div className="grid grid-cols-[84px_minmax(0,1fr)] gap-2.5">
                    <dt className="text-[13px] text-muted-foreground">Status</dt>
                    <dd className="flex flex-wrap items-center gap-1.5 text-[13.5px]">
                      <StatusBadge status={draft.status} />
                      <HintText hint={hint(draft, now)} className="basis-full" />
                    </dd>
                  </div>
                  <div className="grid grid-cols-[84px_minmax(0,1fr)] gap-2.5">
                    <dt className="text-[13px] text-muted-foreground">Runs</dt>
                    <dd className="text-[13.5px]">{schedText(draft)}</dd>
                  </div>
                  <div className="grid grid-cols-[84px_minmax(0,1fr)] gap-2.5">
                    <dt className="text-[13px] text-muted-foreground">Applies to</dt>
                    <dd className="text-[13.5px]">{targetsSummary(catalog, draft)}</dd>
                  </div>
                </dl>
                {!isNew && !(initial.isActive && initial.status !== "ARCHIVED") && !(draft.isActive && draft.status !== "ARCHIVED") && (
                  <p className="mt-3.5 rounded-lg bg-amber-50 px-3.5 py-2.5 text-[13px] text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                    This promotion is paused or archived, so its targets and campaign links can’t change. Enable it (and
                    don’t archive it) to edit them.
                  </p>
                )}
                <ErrorBlock errors={errors} label={(key) => LABELS[key] ?? key} onJump={jumpTo} />
              </div>

              <div className={aside}>
                <h2 className="mb-2.5 text-[15px] font-bold">Covered products</h2>
                {draft.scope === "SPECIFIC" && draft.targets.length === 0 && (
                  <p className={help}>Add a target to see which products this covers.</p>
                )}
                {(draft.scope === "ALL" || draft.targets.length > 0) && affected.length === 0 && (
                  <p className={help}>No active products match yet.</p>
                )}
                {affected.length > 0 && (
                  <>
                    <p className={cn(help, "mb-2.5")}>
                      {plural(new Set(affected.map((x) => x.p.id)).size, "product")}, {plural(affected.length, "variant")}
                      {ship && ". Prices stay the same; delivery is discounted."}
                    </p>
                    <table className="w-full border-collapse text-[13px]">
                      <thead>
                        <tr className="[&>th]:border-b [&>th]:py-1 [&>th]:text-left [&>th]:text-xs [&>th]:font-semibold [&>th]:text-muted-foreground">
                          <th>Product</th>
                          {ship ? (
                            <th className="!text-right">Price</th>
                          ) : (
                            <>
                              <th className="!text-right">Was</th>
                              <th className="!text-right">{draft.type === "BUY_X_GET_Y" ? "Each, in a bundle" : "Now"}</th>
                            </>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {affected.slice(0, 8).map(({ p, v }) => {
                          const after = unitAfter(draft, v.price)
                          return (
                            <tr key={v.id} className="border-b border-border/60 [&>td]:py-1.5 [&>td]:align-top">
                              <td>
                                {p.name}
                                <small className="block text-xs text-muted-foreground">{v.name}</small>
                              </td>
                              {ship ? (
                                <td className="pl-2 text-right whitespace-nowrap">{money(v.price)}</td>
                              ) : (
                                <>
                                  <td className="pl-2 text-right whitespace-nowrap">
                                    {after < v.price ? <s className="text-muted-foreground">{money(v.price)}</s> : money(v.price)}
                                  </td>
                                  <td className="pl-2 text-right font-bold whitespace-nowrap text-emerald-700 dark:text-emerald-400">{money(after)}</td>
                                </>
                              )}
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                    {affected.length > 8 && <p className="mt-2 text-[12.5px] text-muted-foreground">And {affected.length - 8} more variants</p>}
                  </>
                )}
              </div>

              <div className={aside}>
                <h2 className="mb-2.5 text-[15px] font-bold">Try it on a cart</h2>
                <CartSimulator draft={draft} data={data} now={now} sim={sim} onChange={setSim} />
              </div>
            </aside>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function CartSimulator({
  draft,
  data,
  now,
  sim,
  onChange,
}: {
  draft: Promotion
  data: MarketingData
  now: number
  sim: { variantId: string; qty: number; ship: number }
  onChange: (sim: { variantId: string; qty: number; ship: number }) => void
}) {
  const variants = allVariants(data.catalog)
  const found = variants.find((x) => x.v.id === sim.variantId)

  if (!found) {
    return <p className="text-[12.5px] text-muted-foreground">Add products to your catalog to try the offer on a cart.</p>
  }

  const { p, v } = found
  const qty = Math.max(1, Math.floor(sim.qty || 1))
  const ship = Math.max(0, sim.ship || 0)
  const subtotal = round2(v.price * qty)
  const eligible = isEligible(data.catalog, draft, p, v.id)
  const meetsMin = !draft.minOrderAmount || subtotal >= draft.minOrderAmount

  let itemDiscount = 0
  let shipDiscount = 0
  let note = ""
  let warn = false
  if (!eligible) {
    note = "This product isn’t covered by the promotion."
    warn = true
  } else if (!meetsMin) {
    note = `Add ${money(round2(draft.minOrderAmount! - subtotal))} more to qualify.`
  } else if (isShip(draft.type)) {
    shipDiscount = draft.type === "FREE_SHIPPING" ? ship : Math.min(draft.value ?? 0, ship)
  } else {
    itemDiscount = lineDiscount(draft, v.price, qty)
    if (draft.type === "BUY_X_GET_Y" && itemDiscount === 0 && draft.buyQuantity && draft.getQuantity) {
      const bundle = draft.buyQuantity + draft.getQuantity
      note = `Add ${plural(bundle - (qty % bundle), "more item")} to unlock the free ${draft.getQuantity === 1 ? "one" : "ones"}.`
    }
  }
  const total = round2(subtotal - itemDiscount + ship - shipDiscount)

  return (
    <>
      <div className="mb-4 flex flex-col gap-1.5">
        <label htmlFor="sim-v" className="text-[13px] font-semibold">
          Product in cart
        </label>
        <select id="sim-v" value={sim.variantId} className={inputClass} onChange={(event) => onChange({ ...sim, variantId: event.target.value })}>
          {variants.map(({ p, v }) => (
            <option key={v.id} value={v.id}>
              {p.name}, {v.name} ({money(v.price)})
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <div className="mb-4 flex flex-col gap-1.5">
          <label htmlFor="sim-q" className="text-[13px] font-semibold">
            Quantity
          </label>
          <input
            id="sim-q"
            type="number"
            min={1}
            max={99}
            value={sim.qty}
            className={inputClass}
            onChange={(event) => onChange({ ...sim, qty: Number(event.target.value) })}
          />
        </div>
        <div className="mb-4 flex flex-col gap-1.5">
          <label htmlFor="sim-s" className="text-[13px] font-semibold">
            Delivery charge
          </label>
          <input
            id="sim-s"
            type="number"
            min={0}
            step={10}
            value={sim.ship}
            className={inputClass}
            onChange={(event) => onChange({ ...sim, ship: Number(event.target.value) })}
          />
        </div>
      </div>

      <dl className="mt-1 flex flex-col gap-1.5 border-t border-dashed pt-2.5 text-[13.5px]">
        <div className="flex justify-between gap-2.5">
          <dt>{plural(qty, "item")}</dt>
          <dd className="font-semibold">{money(subtotal)}</dd>
        </div>
        {itemDiscount > 0 && (
          <div className="flex justify-between gap-2.5 text-emerald-700 dark:text-emerald-400">
            <dt>{draft.name || "Promotion"}</dt>
            <dd className="font-semibold">−{money(itemDiscount)}</dd>
          </div>
        )}
        <div className="flex justify-between gap-2.5">
          <dt>Delivery</dt>
          <dd className="font-semibold">{money(ship)}</dd>
        </div>
        {shipDiscount > 0 && (
          <div className="flex justify-between gap-2.5 text-emerald-700 dark:text-emerald-400">
            <dt>{draft.name || "Delivery offer"}</dt>
            <dd className="font-semibold">−{money(shipDiscount)}</dd>
          </div>
        )}
        <div className="mt-1 flex justify-between gap-2.5 border-t border-foreground pt-2 text-[15px] font-bold">
          <dt>Shopper pays</dt>
          <dd>{money(total)}</dd>
        </div>
      </dl>
      {note && <p className={cn("mt-2 text-[12.5px] text-muted-foreground", warn && "text-amber-700")}>{note}</p>}
      {!hint(draft, now)?.live && (
        <p className="mt-2 text-[12.5px] text-muted-foreground">This offer isn’t live right now. The test ignores status and dates.</p>
      )}
    </>
  )
}
