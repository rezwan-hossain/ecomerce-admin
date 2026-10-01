"use client"

import { useRef, useState } from "react"
import { ChevronRightIcon, PlusIcon, Trash2Icon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import { slugify } from "@/lib/slug"
import { cn } from "@/lib/utils"

import { EmptyState } from "./campaign-list"
import {
  DateTimeInput,
  DrawerHead,
  ErrorBlock,
  Field,
  ImagePreview,
  inputClass,
  isUrl,
  jumpTo,
  move,
  NumberInput,
  OrderButtons,
  PrefixInput,
  SLUG_RE,
  TextInput,
  Toggle,
  type Errors,
} from "./form-bits"
import {
  campaignProductCount,
  catOptions,
  datesOverlap,
  hint,
  minPrice,
  money,
  plural,
  ruleHasCondition,
  ruleMatches,
  schedText,
  sectionProducts,
  STATUS_LABEL,
  STATUSES,
  type Banner,
  type Campaign,
  type MarketingData,
  type Rule,
  type Section,
} from "./marketing-utils"
import { HintText, PriceTag, StatusBadge } from "./status"

const newId = () => `new-${Math.random().toString(36).slice(2, 10)}`

function validate(c: Campaign, others: Campaign[]) {
  const e: Errors = {}
  if (c.name.trim().length < 2) e.name = "Enter a campaign name (at least 2 characters)."
  if (!c.slug.trim()) e.slug = "Enter a URL slug."
  else if (!SLUG_RE.test(c.slug)) e.slug = "Use lowercase letters, numbers and single hyphens."
  else if (others.some((x) => x.slug === c.slug && x.id !== c.id)) e.slug = "Another campaign already uses this slug."
  if (c.startsAt && c.endsAt && new Date(c.endsAt) <= new Date(c.startsAt)) e.endsAt = "End must be after the start."
  if (c.status === "SCHEDULED" && !c.startsAt) e.startsAt = "Scheduled campaigns need a start date."
  for (const key of ["bannerUrl", "thumbnailUrl", "metaImageUrl"] as const) {
    if (c[key].trim() && !isUrl(c[key].trim())) e[key] = "Enter a full URL, starting with https://"
  }
  if (c.metaTitle.length > 255) e.metaTitle = "Keep it under 255 characters."

  c.banners.forEach((b, i) => {
    if (!b.imageUrl.trim()) e[`banners.${i}.imageUrl`] = "Add a desktop image URL."
    else if (!isUrl(b.imageUrl.trim())) e[`banners.${i}.imageUrl`] = "Enter a full URL, starting with https://"
    if (b.mobileImageUrl.trim() && !isUrl(b.mobileImageUrl.trim())) e[`banners.${i}.mobileImageUrl`] = "Enter a full URL."
    if (b.linkUrl.trim() && !isUrl(b.linkUrl.trim())) e[`banners.${i}.linkUrl`] = "Enter a full URL, like https://yourstore.com/campaigns/eid"
  })

  const slugs = new Set<string>()
  c.sections.forEach((s, i) => {
    if (s.title.trim().length < 2) e[`sections.${i}.title`] = "Enter a section title (at least 2 characters)."
    if (s.slug) {
      if (!SLUG_RE.test(s.slug)) e[`sections.${i}.slug`] = "Use lowercase letters, numbers and single hyphens."
      else if (slugs.has(s.slug)) e[`sections.${i}.slug`] = "Another section in this campaign uses this slug."
      slugs.add(s.slug)
    }
    if (s.bannerUrl.trim() && !isUrl(s.bannerUrl.trim())) e[`sections.${i}.bannerUrl`] = "Enter a full URL."
    s.rules.forEach((r, j) => {
      const key = `sections.${i}.rules.${j}`
      if (!ruleHasCondition(r)) e[key] = "Pick at least one condition, or remove the rule."
      else if (r.minPrice !== null && r.maxPrice !== null && r.minPrice > r.maxPrice) e[key] = "Min price is higher than max price."
      else if ((r.minPrice ?? 0) < 0 || (r.maxPrice ?? 0) < 0) e[key] = "Prices can’t be negative."
    })
  })
  return e
}

const GROUP_OF = (key: string) => {
  if (key.startsWith("banners")) return "banners"
  if (key.startsWith("sections")) return "sections"
  if (key.startsWith("meta")) return "seo"
  return "details"
}

function errorLabel(key: string) {
  const names: Record<string, string> = {
    name: "Name",
    slug: "URL slug",
    startsAt: "Start date",
    endsAt: "End date",
    bannerUrl: "Hero banner",
    thumbnailUrl: "Thumbnail",
    metaTitle: "Meta title",
    metaImageUrl: "Share image",
  }
  if (names[key]) return names[key]
  let m = key.match(/^banners\.(\d+)/)
  if (m) return `Banner ${Number(m[1]) + 1}`
  m = key.match(/^sections\.(\d+)\.rules\.(\d+)$/)
  if (m) return `Section ${Number(m[1]) + 1}, rule ${Number(m[2]) + 1}`
  m = key.match(/^sections\.(\d+)\.(\w+)$/)
  if (m) return `Section ${Number(m[1]) + 1} ${m[2]}`
  return key
}

export function CampaignDrawer({
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
  initial: Campaign
  isNew: boolean
  data: MarketingData
  now: number
  saving: boolean
  onClose: (dirty: boolean) => void
  onSave: (draft: Campaign) => void
  onDelete: () => void
  onPayload: (draft: Campaign) => void
}) {
  const [draft, setDraft] = useState(initial)
  const [dirty, setDirty] = useState(false)
  const [showErrors, setShowErrors] = useState(false)
  const [openSections, setOpenSections] = useState<string[]>(initial.sections[0] ? [initial.sections[0].id] : [])
  const [tab, setTab] = useState("details")
  const scrollRef = useRef<HTMLDivElement>(null)

  const catalog = data.catalog
  const errors = showErrors ? validate(draft, data.campaigns) : {}

  function update(patch: Partial<Campaign>) {
    setDraft({ ...draft, ...patch })
    setDirty(true)
  }

  function updateBanner(i: number, patch: Partial<Banner>) {
    update({ banners: draft.banners.map((b, j) => (j === i ? { ...b, ...patch } : b)) })
  }

  function updateSection(i: number, patch: Partial<Section>) {
    update({ sections: draft.sections.map((s, j) => (j === i ? { ...s, ...patch } : s)) })
  }

  function updateRule(i: number, j: number, patch: Partial<Rule>) {
    const rules = draft.sections[i].rules.map((r, k) => (k === j ? { ...r, ...patch } : r))
    updateSection(i, { rules })
  }

  // The slug follows the name until someone edits it.
  function changeName(name: string) {
    const followsName = !draft.slug || draft.slug === slugify(draft.name)
    update({ name, slug: followsName ? slugify(name) : draft.slug })
  }

  function changeSectionTitle(i: number, title: string) {
    const s = draft.sections[i]
    const followsTitle = !s.slug || s.slug === slugify(s.title)
    updateSection(i, { title, slug: followsTitle ? slugify(title) : s.slug })
  }

  function save() {
    const found = validate(draft, data.campaigns)
    if (Object.keys(found).length > 0) {
      setShowErrors(true)
      // Open the sections that have problems so their fields are visible.
      const withErrors = Object.keys(found)
        .map((k) => k.match(/^sections\.(\d+)/))
        .filter((m) => m !== null)
        .map((m) => draft.sections[Number(m![1])].id)
      setOpenSections([...new Set([...openSections, ...withErrors])])
      jumpTo(Object.keys(found)[0])
      return
    }
    onSave(draft)
  }

  function scrollToGroup(key: string) {
    const group = document.getElementById(`g-${key}`)
    const box = scrollRef.current!
    setTab(key)
    box.scrollTo({ top: group!.offsetTop - 52, behavior: "smooth" })
  }

  // Highlights the jump link for the part of the form in view.
  function spy() {
    const box = scrollRef.current!
    const groups = [...box.querySelectorAll<HTMLElement>("[data-group]")]
    let current = groups[0].dataset.group!
    if (box.scrollTop + box.clientHeight >= box.scrollHeight - 4) current = groups[groups.length - 1].dataset.group!
    else for (const g of groups) if (g.offsetTop - 76 <= box.scrollTop) current = g.dataset.group!
    if (current !== tab) setTab(current)
  }

  const promos = draft.promotionIds
    .map((id) => data.promotions.find((p) => p.id === id))
    .filter((p) => p !== undefined)
  const groups = [
    { key: "details", label: "Details", count: null },
    { key: "banners", label: "Banners", count: draft.banners.length },
    { key: "sections", label: "Sections", count: draft.sections.length },
    { key: "promotions", label: "Promotions", count: draft.promotionIds.length },
    { key: "seo", label: "Search and sharing", count: null },
  ]
  const panel = "border-t py-6 first:border-t-0"
  const panelTitle = "mb-1 text-lg font-bold tracking-tight"
  const help = "text-[12.5px] text-muted-foreground"

  return (
    <Sheet open onOpenChange={(open) => !open && onClose(dirty)}>
      <SheetContent showCloseButton={false} className="w-full gap-0 bg-card p-0 data-[side=right]:sm:max-w-[1000px]">
        <SheetTitle className="sr-only">{draft.name || "New campaign"}</SheetTitle>
        <DrawerHead
          kind="campaign"
          isNew={isNew}
          title={draft.name || "New campaign"}
          dirty={dirty}
          saving={saving}
          onClose={() => onClose(dirty)}
          onPayload={() => onPayload(draft)}
          onDelete={onDelete}
          onSave={save}
        />

        <div ref={scrollRef} onScroll={spy} className="relative flex-1 overflow-y-auto overscroll-contain">
          {/* Facts */}
          <div className="border-b bg-muted/40 px-4 py-4 sm:px-6">
            <div className="grid grid-cols-2 gap-x-8 gap-y-3 sm:flex sm:flex-wrap">
              <div>
                <span className="mb-0.5 block text-xs text-muted-foreground">Status</span>
                <div className="flex flex-wrap items-center gap-1.5 text-[13.5px] font-medium">
                  <StatusBadge status={draft.status} />
                  <HintText hint={hint(draft, now)} className="basis-full" />
                </div>
              </div>
              <div>
                <span className="mb-0.5 block text-xs text-muted-foreground">Runs</span>
                <div className="text-[13.5px] font-medium">{schedText(draft)}</div>
              </div>
              <div>
                <span className="mb-0.5 block text-xs text-muted-foreground">Storefront</span>
                <div className="text-[13.5px] font-medium">
                  {draft.isActive ? "Visible" : "Hidden"}
                  {draft.isFeatured && ", featured on homepage"}
                </div>
              </div>
              <div>
                <span className="mb-0.5 block text-xs text-muted-foreground">On the page</span>
                <div className="text-[13.5px] font-medium">
                  {plural(draft.banners.filter((b) => b.isActive).length, "banner")},{" "}
                  {plural(draft.sections.filter((s) => s.isActive).length, "section")},{" "}
                  {plural(campaignProductCount(catalog, draft), "product")}
                </div>
              </div>
              <div className="col-span-2">
                <span className="mb-0.5 block text-xs text-muted-foreground">Promotions</span>
                <div className="flex flex-wrap items-center gap-1.5 text-[13.5px] font-medium">
                  {promos.length > 0 ? promos.map((p) => <PriceTag key={p.id} promotion={p} />) : <span className="text-muted-foreground">None linked</span>}
                </div>
              </div>
            </div>
            {!isNew && !(initial.isActive && initial.status !== "ARCHIVED") && !(draft.isActive && draft.status !== "ARCHIVED") && (
              <p className="mt-3.5 rounded-lg bg-amber-50 px-3.5 py-2.5 text-[13px] text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                This campaign is hidden or archived, so its banners, sections and links can’t change. Make it visible
                (and not archived) to edit them.
              </p>
            )}
            <ErrorBlock errors={errors} label={errorLabel} onJump={jumpTo} />
          </div>

          {/* Jump links */}
          <nav className="sticky top-0 z-[5] flex gap-0.5 overflow-x-auto border-b bg-card px-3 py-2 sm:px-5" aria-label="Jump to part of the form">
            {groups.map((g) => (
              <button
                key={g.key}
                type="button"
                onClick={() => scrollToGroup(g.key)}
                className={cn(
                  "relative inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13.5px] font-semibold whitespace-nowrap text-muted-foreground hover:bg-muted hover:text-foreground",
                  tab === g.key && "bg-emerald-50 text-foreground dark:bg-emerald-950"
                )}
              >
                {g.label}
                {g.count !== null && <em className="text-xs font-medium not-italic opacity-80">{g.count}</em>}
                {Object.keys(errors).some((k) => GROUP_OF(k) === g.key) && <span className="size-[7px] rounded-full bg-destructive" />}
              </button>
            ))}
          </nav>

          <div className="min-w-0 px-4 pb-18 sm:px-6">
            {/* Details */}
            <div id="g-details" data-group="details" className="scroll-mt-16">
              <section className={panel}>
                <div className="grid gap-x-4.5 sm:grid-cols-2">
                  <Field label="Name" name="name" errors={errors}>
                    <TextInput name="name" value={draft.name} errors={errors} placeholder="e.g. Eid Mega Sale" maxLength={255} onChange={changeName} />
                  </Field>
                  <Field label="URL slug" name="slug" errors={errors}>
                    <PrefixInput
                      name="slug"
                      before="/campaigns/"
                      value={draft.slug}
                      errors={errors}
                      placeholder="eid-mega-sale"
                      spellCheck={false}
                      onChange={(slug) => update({ slug: slug.toLowerCase() })}
                    />
                  </Field>
                </div>
                <Field label="Description" name="description" errors={errors}>
                  <textarea
                    id="f-description"
                    rows={3}
                    value={draft.description}
                    placeholder="What shoppers get from this campaign"
                    className={cn(inputClass, "h-auto py-2 leading-normal")}
                    onChange={(event) => update({ description: event.target.value })}
                  />
                </Field>
              </section>

              <section className={panel}>
                <h2 className={cn(panelTitle, "mb-3.5")}>Publishing</h2>
                <div className="grid gap-x-4.5 sm:grid-cols-2">
                  <Field
                    label="Status"
                    name="status"
                    errors={errors}
                    hint="Scheduled and Active campaigns can appear on the storefront. Visibility and dates still apply."
                  >
                    <select
                      id="f-status"
                      value={draft.status}
                      className={inputClass}
                      onChange={(event) => update({ status: event.target.value as Campaign["status"] })}
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {STATUS_LABEL[s]}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <div className="mb-4 flex flex-col justify-center gap-3">
                    <Toggle checked={draft.isActive} label="Visible on storefront" onChange={(isActive) => update({ isActive })} />
                    <Toggle checked={draft.isFeatured} label="Feature on homepage" onChange={(isFeatured) => update({ isFeatured })} />
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

              <section className={panel}>
                <h2 className={cn(panelTitle, "mb-3.5")}>Artwork</h2>
                <div className="grid gap-x-4.5 sm:grid-cols-2">
                  <div>
                    <Field label="Hero banner URL" name="bannerUrl" errors={errors}>
                      <TextInput name="bannerUrl" type="url" value={draft.bannerUrl} errors={errors} placeholder="https://" onChange={(bannerUrl) => update({ bannerUrl })} />
                    </Field>
                    <ImagePreview url={draft.bannerUrl} ratio="wide" />
                  </div>
                  <div>
                    <Field label="Thumbnail URL" name="thumbnailUrl" errors={errors} hint="Used in campaign lists and cards.">
                      <TextInput name="thumbnailUrl" type="url" value={draft.thumbnailUrl} errors={errors} placeholder="https://" onChange={(thumbnailUrl) => update({ thumbnailUrl })} />
                    </Field>
                    <ImagePreview url={draft.thumbnailUrl} ratio="square" />
                  </div>
                </div>
              </section>
            </div>

            {/* Banners */}
            <div id="g-banners" data-group="banners" className="scroll-mt-16">
              <section className={panel}>
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <h2 className={panelTitle}>Banners</h2>
                    <p className={help}>Slides at the top of the campaign page, shown in this order.</p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() =>
                      update({
                        banners: [...draft.banners, { id: newId(), title: "", imageUrl: "", mobileImageUrl: "", linkUrl: "", isActive: true }],
                      })
                    }
                  >
                    <PlusIcon data-icon="inline-start" />
                    Add banner
                  </Button>
                </div>
                {draft.banners.length === 0 && (
                  <EmptyState title="No banners yet" text="Add a banner to give the campaign page a hero slide." />
                )}
                {draft.banners.map((b, i) => {
                  const key = `banners.${i}`
                  return (
                    <div key={b.id} className="mb-3 grid grid-cols-[30px_minmax(0,1fr)] gap-2.5 rounded-lg border p-3 sm:grid-cols-[40px_minmax(0,1fr)] sm:gap-3.5 sm:p-4">
                      <div className="flex flex-col items-center gap-1.5">
                        <span className="text-[15px] font-bold text-muted-foreground">{i + 1}</span>
                        <OrderButtons index={i} length={draft.banners.length} onMove={(from, to) => update({ banners: move(draft.banners, from, to) })} />
                      </div>
                      <div className="min-w-0">
                        <div className="grid gap-4.5 md:grid-cols-[240px_minmax(0,1fr)]">
                          <ImagePreview url={b.imageUrl} ratio="wide" />
                          <div>
                            <div className="grid gap-x-4.5 sm:grid-cols-2">
                              <Field label="Title" name={`${key}.title`} errors={errors}>
                                <TextInput name={`${key}.title`} value={b.title} errors={errors} placeholder="Also used as alt text" onChange={(title) => updateBanner(i, { title })} />
                              </Field>
                              <Field label="Link" name={`${key}.linkUrl`} errors={errors}>
                                <TextInput name={`${key}.linkUrl`} type="url" value={b.linkUrl} errors={errors} placeholder="https://…/campaigns/slug#section" onChange={(linkUrl) => updateBanner(i, { linkUrl })} />
                              </Field>
                            </div>
                            <div className="grid gap-x-4.5 sm:grid-cols-2">
                              <Field label="Desktop image URL" name={`${key}.imageUrl`} errors={errors}>
                                <TextInput name={`${key}.imageUrl`} type="url" value={b.imageUrl} errors={errors} placeholder="https://" onChange={(imageUrl) => updateBanner(i, { imageUrl })} />
                              </Field>
                              <Field label="Mobile image URL" name={`${key}.mobileImageUrl`} errors={errors} hint="Falls back to the desktop image.">
                                <TextInput name={`${key}.mobileImageUrl`} type="url" value={b.mobileImageUrl} errors={errors} placeholder="Optional" onChange={(mobileImageUrl) => updateBanner(i, { mobileImageUrl })} />
                              </Field>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-2.5 border-t border-border/60 pt-2.5">
                          <Toggle checked={b.isActive} label="Show this banner" onChange={(isActive) => updateBanner(i, { isActive })} />
                          <Button variant="ghost" className="hover:text-destructive" onClick={() => update({ banners: draft.banners.filter((_, j) => j !== i) })}>
                            <Trash2Icon data-icon="inline-start" />
                            Remove
                          </Button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </section>
            </div>

            {/* Sections */}
            <div id="g-sections" data-group="sections" className="scroll-mt-16">
              <section className={panel}>
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <h2 className={panelTitle}>Sections</h2>
                    <p className={help}>
                      Product rows on the campaign page. Each one can mix hand-picked products with rules that pull in matches automatically.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => {
                      const s: Section = { id: newId(), title: "", slug: "", description: "", bannerUrl: "", isActive: true, productIds: [], rules: [] }
                      update({ sections: [...draft.sections, s] })
                      setOpenSections([...openSections, s.id])
                    }}
                  >
                    <PlusIcon data-icon="inline-start" />
                    Add section
                  </Button>
                </div>
                {draft.sections.length === 0 && (
                  <EmptyState title="No sections yet" text="Add a section to start filling the campaign page with products." />
                )}
                {draft.sections.map((s, i) => {
                  const isOpen = openSections.includes(s.id)
                  const key = `sections.${i}`
                  const { manual, ruled } = sectionProducts(catalog, s)
                  const available = catalog.products.filter((p) => !s.productIds.includes(p.id))
                  return (
                    <div key={s.id} className="mb-3 rounded-lg border">
                      <div className="flex items-center gap-2 px-2.5 py-2">
                        <OrderButtons index={i} length={draft.sections.length} onMove={(from, to) => update({ sections: move(draft.sections, from, to) })} />
                        <button
                          type="button"
                          aria-expanded={isOpen}
                          onClick={() => setOpenSections(isOpen ? openSections.filter((id) => id !== s.id) : [...openSections, s.id])}
                          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md p-1.5 text-left"
                        >
                          <span className="grid size-6 flex-none place-items-center rounded-md bg-muted text-xs font-bold">{i + 1}</span>
                          <span className={cn("truncate font-semibold", !s.isActive && "text-muted-foreground")}>{s.title || "Untitled section"}</span>
                          <span className="ml-auto text-[13px] whitespace-nowrap text-muted-foreground">
                            {plural(manual.length + ruled.length, "product")}
                          </span>
                          <ChevronRightIcon className={cn("size-4 text-muted-foreground transition-transform", isOpen && "rotate-90")} />
                        </button>
                        <Switch
                          checked={s.isActive}
                          title="Show this section"
                          aria-label={`Show ${s.title || "this section"}`}
                          className="data-checked:bg-emerald-700"
                          onCheckedChange={(isActive) => updateSection(i, { isActive })}
                        />
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Remove section"
                          className="hover:text-destructive"
                          onClick={() => update({ sections: draft.sections.filter((_, j) => j !== i) })}
                        >
                          <Trash2Icon />
                        </Button>
                      </div>

                      {isOpen && (
                        <div className="border-t border-border/60 px-4 pt-3.5 pb-4">
                          <div className="grid gap-x-4.5 sm:grid-cols-2">
                            <Field label="Title" name={`${key}.title`} errors={errors}>
                              <TextInput name={`${key}.title`} value={s.title} errors={errors} placeholder="e.g. Phones under ৳30,000" onChange={(title) => changeSectionTitle(i, title)} />
                            </Field>
                            <Field label="Anchor slug" name={`${key}.slug`} errors={errors} hint="Lets banners link straight to this section.">
                              <PrefixInput
                                name={`${key}.slug`}
                                before="#"
                                value={s.slug}
                                errors={errors}
                                placeholder="phones-under-30k"
                                spellCheck={false}
                                onChange={(slug) => updateSection(i, { slug: slug.toLowerCase() })}
                              />
                            </Field>
                          </div>
                          <Field label="Description" name={`${key}.description`} errors={errors}>
                            <textarea
                              id={`f-sections-${i}-description`}
                              rows={2}
                              value={s.description}
                              placeholder="Optional line under the title"
                              className={cn(inputClass, "h-auto py-2 leading-normal")}
                              onChange={(event) => updateSection(i, { description: event.target.value })}
                            />
                          </Field>
                          <Field label="Section banner URL" name={`${key}.bannerUrl`} errors={errors}>
                            <TextInput name={`${key}.bannerUrl`} type="url" value={s.bannerUrl} errors={errors} placeholder="Optional" onChange={(bannerUrl) => updateSection(i, { bannerUrl })} />
                          </Field>

                          {/* Hand-picked products */}
                          <div className="mt-3.5 border-t border-dashed pt-3.5">
                            <div className="mb-2.5 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                              <h3 className="text-sm font-semibold">Hand-picked products</h3>
                              <span className={help}>Shown first, in this order.</span>
                            </div>
                            {s.productIds.length > 0 && (
                              <ol className="mb-2.5 flex flex-col gap-1.5">
                                {manual.map((p, j) => (
                                  <li key={p.id} className="flex items-center gap-2.5 rounded-lg border border-border/60 px-2 py-1.5">
                                    <OrderButtons row index={j} length={manual.length} onMove={(from, to) => updateSection(i, { productIds: move(s.productIds, from, to) })} />
                                    <span className="min-w-0 flex-1 font-medium">
                                      {p.name}
                                      <small className="block text-xs font-normal text-muted-foreground">
                                        {catalog.brands.find((b) => b.id === p.brandId)?.name ?? "No brand"}, from {money(minPrice(p))}
                                      </small>
                                    </span>
                                    <Button
                                      variant="ghost"
                                      size="icon-sm"
                                      aria-label={`Remove ${p.name}`}
                                      className="hover:text-destructive"
                                      onClick={() => updateSection(i, { productIds: s.productIds.filter((id) => id !== p.id) })}
                                    >
                                      <XIcon />
                                    </Button>
                                  </li>
                                ))}
                              </ol>
                            )}
                            <ProductAdder
                              products={available}
                              onAdd={(productId) => updateSection(i, { productIds: [...s.productIds, productId] })}
                            />
                          </div>

                          {/* Rules */}
                          <div className="mt-3.5 border-t border-dashed pt-3.5">
                            <div className="mb-2.5 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                              <h3 className="text-sm font-semibold">Rules</h3>
                              <span className={help}>
                                Also include every product that matches. A product only needs to match one rule. Categories include their subcategories.
                              </span>
                            </div>
                            {s.rules.map((r, j) => {
                              const ruleKey = `${key}.rules.${j}`
                              const matches = catalog.products.filter((p) => ruleMatches(catalog, r, p)).length
                              return (
                                <div
                                  key={r.id}
                                  data-err={ruleKey}
                                  className={cn("mb-2.5 rounded-lg border border-border/60 bg-muted/40 px-3 pt-3 pb-2", errors[ruleKey] && "border-destructive")}
                                >
                                  <div className="grid grid-cols-2 gap-x-2.5 md:grid-cols-5">
                                    <RuleSelect
                                      label="Category"
                                      id={`${ruleKey}.categoryId`}
                                      value={r.categoryId}
                                      empty="Any category"
                                      options={catOptions(catalog)}
                                      onChange={(categoryId) => updateRule(i, j, { categoryId })}
                                    />
                                    <RuleSelect
                                      label="Brand"
                                      id={`${ruleKey}.brandId`}
                                      value={r.brandId}
                                      empty="Any brand"
                                      options={catalog.brands.map((b) => ({ value: b.id, label: b.name }))}
                                      onChange={(brandId) => updateRule(i, j, { brandId })}
                                    />
                                    <RuleSelect
                                      label="Tag"
                                      id={`${ruleKey}.tagId`}
                                      value={r.tagId}
                                      empty="Any tag"
                                      options={catalog.tags.map((t) => ({ value: t.id, label: t.name }))}
                                      onChange={(tagId) => updateRule(i, j, { tagId })}
                                    />
                                    <Field label="Min price" name={`${ruleKey}.minPrice`} errors={{}} className="mb-2.5">
                                      <NumberInput name={`${ruleKey}.minPrice`} before="৳" min={0} step={0.01} placeholder="0" value={r.minPrice} errors={{}} onChange={(minPrice) => updateRule(i, j, { minPrice })} />
                                    </Field>
                                    <Field label="Max price" name={`${ruleKey}.maxPrice`} errors={{}} className="mb-2.5">
                                      <NumberInput name={`${ruleKey}.maxPrice`} before="৳" min={0} step={0.01} placeholder="No limit" value={r.maxPrice} errors={{}} onChange={(maxPrice) => updateRule(i, j, { maxPrice })} />
                                    </Field>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-3">
                                    <div className="inline-flex flex-wrap gap-0.5 rounded-lg bg-muted p-[3px]" role="radiogroup" aria-label="How the conditions combine">
                                      {(["ANY", "ALL"] as const).map((m) => (
                                        <button
                                          key={m}
                                          type="button"
                                          role="radio"
                                          aria-checked={r.matchType === m}
                                          onClick={() => updateRule(i, j, { matchType: m })}
                                          className="rounded-md px-2.5 py-1 text-[13px] font-semibold text-foreground/75 aria-checked:bg-card aria-checked:text-foreground aria-checked:shadow-sm"
                                        >
                                          {m === "ANY" ? "Match any condition" : "Match all conditions"}
                                        </button>
                                      ))}
                                    </div>
                                    <span className="ml-auto text-[13px] font-semibold text-emerald-700 dark:text-emerald-400">
                                      {ruleHasCondition(r) ? `Matches ${plural(matches, "product")}` : "Add a condition"}
                                    </span>
                                    <Button
                                      variant="ghost"
                                      size="icon-sm"
                                      aria-label={`Remove rule ${j + 1}`}
                                      className="hover:text-destructive"
                                      onClick={() => updateSection(i, { rules: s.rules.filter((_, k) => k !== j) })}
                                    >
                                      <Trash2Icon />
                                    </Button>
                                  </div>
                                  {errors[ruleKey] && <p className="mt-1 text-[12.5px] font-medium text-destructive">{errors[ruleKey]}</p>}
                                </div>
                              )
                            })}
                            <Button
                              variant="ghost"
                              onClick={() =>
                                updateSection(i, {
                                  rules: [...s.rules, { id: newId(), categoryId: null, brandId: null, tagId: null, matchType: "ANY", minPrice: null, maxPrice: null }],
                                })
                              }
                            >
                              <PlusIcon data-icon="inline-start" />
                              Add rule
                            </Button>
                          </div>

                          {/* Preview */}
                          <div className="mt-3.5 border-t border-dashed pt-3.5">
                            {manual.length + ruled.length === 0 ? (
                              <>
                                <h3 className="mb-2 text-sm font-semibold">Preview</h3>
                                <p className={help}>This section is empty. Add products or a rule to fill it.</p>
                              </>
                            ) : (
                              <>
                                <div className="mb-2.5 flex flex-wrap items-baseline gap-x-2.5">
                                  <h3 className="text-sm font-semibold">Shoppers will see {plural(manual.length + ruled.length, "product")}</h3>
                                  <span className={help}>
                                    {manual.length} hand-picked, {ruled.length} from rules
                                  </span>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                  {[...manual.map((p) => ({ p, picked: true })), ...ruled.map((p) => ({ p, picked: false }))]
                                    .slice(0, 14)
                                    .map(({ p, picked }) => (
                                      <span
                                        key={p.id}
                                        className={cn(
                                          "inline-flex items-center rounded-full px-2.5 py-0.5 text-[12.5px] font-medium",
                                          picked
                                            ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                            : "text-emerald-800 shadow-[inset_0_0_0_1px_var(--color-emerald-700)] dark:text-emerald-300"
                                        )}
                                      >
                                        {p.name}
                                      </span>
                                    ))}
                                  {manual.length + ruled.length > 14 && (
                                    <span className="rounded-full bg-muted px-2.5 py-0.5 text-[12.5px] text-muted-foreground">
                                      +{manual.length + ruled.length - 14} more
                                    </span>
                                  )}
                                </div>
                                <div className="mt-2.5 flex gap-4 text-xs text-muted-foreground">
                                  <span className="inline-flex items-center gap-1.5">
                                    <i className="size-2.5 rounded-full bg-emerald-100" />
                                    Hand-picked
                                  </span>
                                  <span className="inline-flex items-center gap-1.5">
                                    <i className="size-2.5 rounded-full shadow-[inset_0_0_0_1px_var(--color-emerald-700)]" />
                                    From a rule
                                  </span>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </section>
            </div>

            {/* Linked promotions */}
            <div id="g-promotions" data-group="promotions" className="scroll-mt-16">
              <section className={panel}>
                <h2 className={panelTitle}>Linked promotions</h2>
                <p className={cn(help, "mb-4")}>Linked offers are shown on the campaign page. Each one still follows its own schedule and targets.</p>
                {data.promotions.length === 0 ? (
                  <EmptyState title="No promotions yet" text="Create a promotion first, then link it here." />
                ) : (
                  <div className="flex flex-col overflow-hidden rounded-lg border">
                    {data.promotions.map((p) => {
                      const on = draft.promotionIds.includes(p.id)
                      // The API only changes links on promotions that are on and not archived.
                      const locked = !p.isActive || p.status === "ARCHIVED"
                      return (
                        <label
                          key={p.id}
                          className={cn(
                            "flex items-center gap-3 border-t border-border/60 px-3.5 py-3 first:border-t-0",
                            locked ? "cursor-not-allowed opacity-70" : "cursor-pointer hover:bg-muted/40"
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={on}
                            disabled={locked}
                            className="size-[18px] flex-none accent-emerald-700"
                            onChange={(event) =>
                              update({
                                promotionIds: event.target.checked
                                  ? [...draft.promotionIds, p.id]
                                  : draft.promotionIds.filter((id) => id !== p.id),
                              })
                            }
                          />
                          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                            <span className="font-semibold">{p.name}</span>
                            <span className="flex flex-wrap items-center gap-2 text-[12.5px] text-muted-foreground">
                              <StatusBadge status={p.status} />
                              {schedText(p)}
                            </span>
                            {on && !datesOverlap(draft, p) && (
                              <span className="text-[12.5px] text-amber-700">Runs outside this campaign’s dates</span>
                            )}
                            {locked && (
                              <span className="text-[12.5px] text-muted-foreground">Turn this promotion on to change its links.</span>
                            )}
                          </span>
                          <PriceTag promotion={p} />
                        </label>
                      )
                    })}
                  </div>
                )}
              </section>
            </div>

            {/* SEO */}
            <div id="g-seo" data-group="seo" className="scroll-mt-16">
              <section className={panel}>
                <h2 className={cn(panelTitle, "mb-3.5")}>Search and sharing</h2>
                <Field label="Meta title" name="metaTitle" errors={errors} hint={<CharCount text={draft.metaTitle} max={60} />}>
                  <TextInput
                    name="metaTitle"
                    value={draft.metaTitle}
                    errors={errors}
                    placeholder={`${draft.name || "Campaign name"} | Store`}
                    onChange={(metaTitle) => update({ metaTitle })}
                  />
                </Field>
                <Field label="Meta description" name="metaDescription" errors={errors} hint={<CharCount text={draft.metaDescription} max={160} />}>
                  <textarea
                    id="f-metaDescription"
                    rows={3}
                    value={draft.metaDescription}
                    placeholder="Falls back to the campaign description"
                    className={cn(inputClass, "h-auto py-2 leading-normal")}
                    onChange={(event) => update({ metaDescription: event.target.value })}
                  />
                </Field>
                <Field
                  label="Share image URL"
                  name="metaImageUrl"
                  errors={errors}
                  hint="Shown when the link is shared on Facebook or WhatsApp. 1200 × 630 works best."
                >
                  <TextInput name="metaImageUrl" type="url" value={draft.metaImageUrl} errors={errors} placeholder="https://" onChange={(metaImageUrl) => update({ metaImageUrl })} />
                </Field>
                <div className="mt-3.5 border-t border-dashed pt-3.5">
                  <h3 className="mb-2.5 text-sm font-semibold">Search result preview</h3>
                  <SearchPreview campaign={draft} />
                </div>
              </section>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function CharCount({ text, max }: { text: string; max: number }) {
  return (
    <span className={cn(text.length > max && "text-amber-700")}>
      {text.length} of {max} characters{text.length > max && ", may be cut off"}
    </span>
  )
}

// Roughly how the page shows up in Google.
function SearchPreview({ campaign }: { campaign: Campaign }) {
  const title = campaign.metaTitle || `${campaign.name || "Campaign name"} | Store`
  const description =
    campaign.metaDescription || campaign.description || "Add a meta description so search engines show a useful summary."
  return (
    <div className="max-w-[600px] rounded-lg border bg-white px-4 py-3.5 font-[Arial,Helvetica,sans-serif]">
      <div className="text-xs text-[#4d5156]">yourstore.com › campaigns › {campaign.slug || "slug"}</div>
      <div className="my-0.5 text-[19px] leading-snug text-[#1a0dab]">{title.length > 65 ? `${title.slice(0, 62)}…` : title}</div>
      <div className="text-[13.5px] leading-normal text-[#4d5156]">
        {description.length > 160 ? `${description.slice(0, 157)}…` : description}
      </div>
    </div>
  )
}

function RuleSelect({
  label,
  id,
  value,
  empty,
  options,
  onChange,
}: {
  label: string
  id: string
  value: string | null
  empty: string
  options: { value: string; label: string }[]
  onChange: (value: string | null) => void
}) {
  return (
    <Field label={label} name={id} errors={{}} className="mb-2.5">
      <select id={`f-${id.replace(/\./g, "-")}`} value={value ?? ""} className={inputClass} onChange={(event) => onChange(event.target.value || null)}>
        <option value="">{empty}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  )
}

function ProductAdder({
  products,
  onAdd,
}: {
  products: MarketingData["catalog"]["products"]
  onAdd: (productId: string) => void
}) {
  const [selected, setSelected] = useState("")
  const value = products.some((p) => p.id === selected) ? selected : (products[0]?.id ?? "")
  return (
    <div className="flex flex-wrap gap-2">
      <select
        aria-label="Choose a product to add"
        value={value}
        className={cn(inputClass, "w-auto flex-[1_1_220px]")}
        onChange={(event) => setSelected(event.target.value)}
        disabled={products.length === 0}
      >
        {products.length === 0 && <option value="">No products to add</option>}
        {products.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name} ({money(minPrice(p))})
          </option>
        ))}
      </select>
      <Button variant="outline" className="h-10" disabled={!value} onClick={() => onAdd(value)}>
        <PlusIcon data-icon="inline-start" />
        Add product
      </Button>
    </div>
  )
}

