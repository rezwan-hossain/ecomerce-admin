"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { slugify } from "@/lib/slug"
import { cn } from "@/lib/utils"
import type { Category } from "@/types/category.type"

import { BasicInfoPanel } from "./basic-info-panel"
import { MediaPanel } from "./media-panel"
import { OptionsPanel } from "./options-panel"
import {
  buildSku,
  checkRows,
  combos,
  isPrice,
  isStock,
  keyOf,
  namePrefix,
  plural,
  uid,
  withNewVariants,
  type Bulk,
  type ProductImage,
  type ProductOption,
  type SavedOption,
  type VariantRow,
  type VariantState,
} from "./product-utils"
import {
  BrandPanel,
  CategoriesPanel,
  TagsPanel,
  TemplatePanel,
  VisibilityPanel,
  type BrandItem,
  type TagItem,
  type Status,
} from "./side-panels"
import { VariantsPanel } from "./variants-panel"

const DRAFT_KEY = "create-product-draft-v2"

export type TemplateData = { id: string; name: string; options: { name: string; values: string[] }[] }

type ErrorItem = { id: string; message: string }

const statusPill: Record<Status, { label: string; className: string }> = {
  ACTIVE: { label: "Active", className: "bg-emerald-50 text-emerald-700" },
  DRAFT: { label: "Draft", className: "border border-border bg-muted text-muted-foreground" },
  ARCHIVED: { label: "Archived", className: "bg-amber-50 text-amber-800" },
}

// Where "Fix N issues" links scroll to.
const scrollTargets: Record<string, string> = { fName: "nameInput", fSlug: "slugInput" }

const timeNow = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })

export function CreateProductPage({
  initialBrands,
  initialTags,
  savedOptions,
  categoryTree,
  templates,
}: {
  initialBrands: BrandItem[]
  initialTags: TagItem[]
  savedOptions: SavedOption[]
  categoryTree: Category[]
  templates: TemplateData[]
}) {
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [slugAuto, setSlugAuto] = useState(true)
  const [shortDesc, setShortDesc] = useState("")
  const [descHtml, setDescHtml] = useState("")
  const [descKey, setDescKey] = useState(0) // bump to load a draft into the editor
  const [status, setStatus] = useState<Status>("ACTIVE")
  const [isActive, setIsActive] = useState(true)
  const [brands, setBrands] = useState(initialBrands)
  const [brandId, setBrandId] = useState<string | null>(null)
  const [categoryIds, setCategoryIds] = useState<string[]>([])
  const [allTags, setAllTags] = useState(initialTags)
  const [tagIds, setTagIds] = useState<string[]>([])
  const [templateId, setTemplateId] = useState("none")
  const [images, setImages] = useState<ProductImage[]>([])
  const [options, setOptions] = useState<ProductOption[]>([])
  // Starts with the default variant, used while the product has no options.
  const [variants, setVariants] = useState<Record<string, VariantState>>(() =>
    withNewVariants([], {}, { price: "", stock: "", prefix: "" })
  )
  const [removed, setRemoved] = useState<string[]>([])
  const [bulk, setBulk] = useState<Bulk>({ price: "", stock: "", prefix: "" })

  const [errors, setErrors] = useState<ErrorItem[]>([])
  const [triedPublish, setTriedPublish] = useState(false)
  const [saveMeta, setSaveMeta] = useState("Not saved yet")
  const [savedDraft, setSavedDraft] = useState<ReturnType<typeof serialize> | null>(null)
  const [payloadOpen, setPayloadOpen] = useState(false)

  const errorIds = errors.map((e) => e.id)
  const allCombos = combos(options)
  const rows: VariantRow[] = allCombos
    .map((parts) => ({ key: keyOf(parts), parts, v: variants[keyOf(parts)] }))
    .filter((row) => row.v && !removed.includes(row.key))

  // Offer the saved draft once the page is in the browser.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY)
      if (raw) setSavedDraft(JSON.parse(raw))
    } catch {}
  }, [])

  function clearError(id: string) {
    if (errorIds.includes(id)) setErrors(errors.filter((e) => e.id !== id))
  }

  /* ---------- Changes ---------- */

  function changeName(value: string) {
    setName(value)
    if (slugAuto) setSlug(slugify(value))
    clearError("fName")
  }

  function changeSlugAuto(auto: boolean) {
    setSlugAuto(auto)
    if (auto) setSlug(slugify(name))
  }

  function changeStatus(next: Status) {
    setStatus(next)
    if (next === "ACTIVE") setIsActive(true)
  }

  function updateOptions(next: ProductOption[]) {
    setOptions(next)
    const prefix = bulk.prefix || namePrefix(name)
    setVariants((current) => withNewVariants(next, current, { ...bulk, prefix }))
    clearError("fOptions")
  }

  function removeOption(index: number) {
    const option = options[index]
    updateOptions(options.filter((_, i) => i !== index))
    toast(`Option “${option.name || "Untitled"}” removed`, {
      action: { label: "Undo", onClick: () => updateOptions(options) },
    })
  }

  function changeTemplate(id: string) {
    const template = templates.find((t) => t.id === id)
    const previous = { templateId, options }
    setTemplateId(id)
    if (!template) return

    updateOptions(template.options.map((o) => ({ id: uid(), name: o.name, values: [...o.values] })))
    toast(`Applied “${template.name}”`, {
      action: {
        label: "Undo",
        onClick: () => {
          setTemplateId(previous.templateId)
          updateOptions(previous.options)
        },
      },
    })
  }

  function removeImage(index: number) {
    const image = images[index]
    const usedBy = Object.keys(variants).filter((key) => variants[key].imageId === image.id)
    setImages(images.filter((_, i) => i !== index))
    updateVariants(usedBy, { imageId: null })
    toast("Image removed", {
      action: {
        label: "Undo",
        onClick: () => {
          setImages(images)
          updateVariants(usedBy, { imageId: image.id })
        },
      },
    })
  }

  function updateVariants(keys: string[], patch: Partial<VariantState>) {
    setVariants((current) => {
      const next = { ...current }
      for (const key of keys) next[key] = { ...next[key], ...patch }
      return next
    })
    clearError("fMatrix")
  }

  function removeRow(key: string) {
    setRemoved([...removed, key])
    toast("Variant removed", {
      action: { label: "Undo", onClick: () => setRemoved((current) => current.filter((k) => k !== key)) },
    })
  }

  function applyBulk() {
    if (bulk.price.trim() && !isPrice(bulk.price)) {
      toast.error("Enter a bulk price above 0, like 120 or 119.99.")
      return
    }
    if (bulk.stock.trim() && !isStock(bulk.stock)) {
      toast.error("Enter bulk stock as a whole number.")
      return
    }
    // Ticked rows only, or every row when none are ticked.
    let selected = rows.filter((row) => row.v.selected)
    if (selected.length === 0) selected = rows
    setVariants((current) => {
      const next = { ...current }
      for (const { key, parts } of selected) {
        next[key] = {
          ...next[key],
          sku: buildSku(bulk.prefix || namePrefix(name), parts),
          ...(bulk.price.trim() && { price: Number(bulk.price).toFixed(2) }),
          ...(bulk.stock.trim() && { stock: String(Number(bulk.stock)) }),
        }
      }
      return next
    })
    toast.success(`Updated ${selected.length} ${plural(selected.length, "variant", "variants")}`)
  }

  /* ---------- Publish ---------- */

  function validateAll() {
    const found: ErrorItem[] = []
    if (!name.trim()) found.push({ id: "fName", message: "Enter a product name." })
    if (!slug.trim()) found.push({ id: "fSlug", message: "Enter a URL slug." })
    if (!brandId) found.push({ id: "fBrand", message: "Select or create a brand." })
    if (categoryIds.length === 0) found.push({ id: "fCats", message: "Choose at least one category." })
    if (images.length === 0) found.push({ id: "fMedia", message: "Upload at least one product image." })
    if (options.some((o) => o.values.length > 0 && !o.name.trim())) {
      found.push({ id: "fOptions", message: "Name every option, for example Size or Color." })
    }
    if (!rows.some((row) => row.v.active)) found.push({ id: "fMatrix", message: "Add at least one active variant." })

    const { totals } = checkRows(rows)
    if (totals.dup) found.push({ id: "fMatrix", message: `${totals.dup} variants share a SKU. Give each variant a unique SKU.` })
    if (totals.empty) {
      found.push({ id: "fMatrix", message: `${totals.empty} ${plural(totals.empty, "variant is", "variants are")} missing a SKU.` })
    }
    if (totals.badPrice) {
      found.push({ id: "fMatrix", message: `${totals.badPrice} active ${plural(totals.badPrice, "variant needs", "variants need")} a price above 0.` })
    }
    if (totals.badStock) {
      found.push({ id: "fMatrix", message: `${totals.badStock} ${plural(totals.badStock, "variant has", "variants have")} a stock count that isn't a whole number.` })
    }
    return found
  }

  function publish() {
    const found = validateAll()
    setErrors(found)
    setTriedPublish(true)
    if (found.length > 0) {
      window.scrollTo({ top: 0, behavior: "smooth" })
      return
    }
    // UI only for now: nothing is sent to the API yet.
    setStatus("ACTIVE")
    try {
      localStorage.removeItem(DRAFT_KEY)
    } catch {}
    setSavedDraft(null)
    setSaveMeta(`Published at ${timeNow()}`)
    toast.success("Product published")
  }

  function goToError(id: string) {
    const element = document.getElementById(scrollTargets[id] ?? id)!
    element.scrollIntoView({ behavior: "smooth", block: "center" })
    setTimeout(() => {
      const focusable = element.matches("input")
        ? element
        : element.querySelector<HTMLElement>("[aria-invalid=true], input:not([type=checkbox]), [role=button]")
      focusable?.focus({ preventScroll: true })
    }, 350)
  }

  /* ---------- Draft and payload ---------- */

  function serialize(withImages: boolean) {
    return {
      name, slug, slugAuto, shortDesc, descHtml, status, isActive, brands, brandId, categoryIds, allTags, tagIds,
      templateId, images: withImages ? images : [], options, variants, removed, bulk,
      savedAt: new Date().toISOString(),
    }
  }

  function saveDraft() {
    let note = "Draft saved"
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(serialize(true)))
    } catch {
      // Uploaded images are data URLs and can be too big for browser storage.
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(serialize(false)))
        note = "Draft saved without images. They're too large for browser storage."
      } catch {
        toast.error("The draft couldn't be saved. Browser storage is unavailable.")
        return
      }
    }
    setSavedDraft(null)
    setSaveMeta(`Draft saved at ${timeNow()}`)
    toast.success(note)
  }

  function restoreDraft(draft: ReturnType<typeof serialize>) {
    setName(draft.name)
    setSlug(draft.slug)
    setSlugAuto(draft.slugAuto)
    setShortDesc(draft.shortDesc)
    setDescHtml(draft.descHtml)
    setDescKey(descKey + 1)
    setStatus(draft.status)
    setIsActive(draft.isActive)
    setBrands(draft.brands)
    setBrandId(draft.brandId)
    setCategoryIds(draft.categoryIds)
    setAllTags(draft.allTags)
    setTagIds(draft.tagIds)
    setTemplateId(draft.templateId)
    setImages(draft.images)
    setOptions(draft.options)
    setVariants(draft.variants)
    setRemoved(draft.removed)
    setBulk(draft.bulk)
    setSavedDraft(null)
    setSaveMeta("Draft restored")
    toast.success("Draft restored")
  }

  function discardDraft() {
    try {
      localStorage.removeItem(DRAFT_KEY)
    } catch {}
    setSavedDraft(null)
  }

  function payload() {
    const brand = brands.find((b) => b.id === brandId)
    return {
      name: name.trim(),
      slug,
      shortDescription: shortDesc.trim(),
      description: descHtml,
      status,
      isActive: status === "ACTIVE" && isActive,
      brand: brand ? { id: brand.id, name: brand.name } : null,
      categoryIds,
      tagIds,
      variantTemplateId: templateId === "none" ? null : templateId,
      images: images.map((image, index) => ({
        position: index,
        isPrimary: index === 0,
        altText: image.alt,
        url: image.src.startsWith("data:")
          ? `[uploaded image, ${Math.max(1, Math.round((image.src.length * 0.75) / 1024))} KB]`
          : image.src,
      })),
      options: options.filter((o) => o.values.length > 0).map((o) => ({ name: o.name, values: o.values })),
      variants: rows.map(({ parts, v }) => {
        const imageIndex = images.findIndex((i) => i.id === v.imageId)
        return {
          options: Object.fromEntries(parts.map((p) => [p.option.name || "Option", p.value])),
          sku: v.sku.trim(),
          price: isPrice(v.price) ? Number(v.price) : null,
          stock: isStock(v.stock) ? Number(v.stock) : null,
          isActive: v.active,
          imageIndex: imageIndex >= 0 ? imageIndex : null,
          compareAtPrice: v.compareAt ? Number(v.compareAt) : null,
          costPerItem: v.cost ? Number(v.cost) : null,
          barcode: v.barcode || null,
          weightGrams: v.weight ? Number(v.weight) : null,
        }
      }),
    }
  }

  async function copyPayload() {
    await navigator.clipboard.writeText(JSON.stringify(payload(), null, 2))
    toast.success("JSON copied")
  }

  /* ---------- Page ---------- */

  const pill = statusPill[status]

  return (
    <div className="min-h-full flex-1 bg-muted/70 text-sm">
      <header className="sticky top-0 z-20 border-b bg-card">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-3 lg:px-6">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-[22px] leading-tight font-bold tracking-tight">Create product</h1>
            <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", pill.className)}>{pill.label}</span>
            <span className="text-[12.5px] text-muted-foreground">{saveMeta}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="ghost" onClick={() => setPayloadOpen(true)}>
              View payload
            </Button>
            <Button type="button" variant="outline" onClick={saveDraft}>
              Save draft
            </Button>
            <Button type="button" onClick={publish}>
              Publish product
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl p-4 lg:p-6">
        {savedDraft && (
          <div className="mb-5 flex flex-wrap items-center gap-3 rounded-[10px] border border-primary/30 bg-primary/10 px-4.5 py-3.5">
            <span className="min-w-50 flex-1">
              You have a saved draft of “{savedDraft.name || "Untitled product"}” from{" "}
              {new Date(savedDraft.savedAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}.
            </span>
            <Button type="button" size="sm" variant="outline" className="bg-card" onClick={() => restoreDraft(savedDraft)}>
              Restore draft
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={discardDraft}>
              Discard
            </Button>
          </div>
        )}

        {errors.length > 0 && (
          <section
            aria-live="assertive"
            className="mb-5 rounded-[10px] border border-destructive/45 bg-destructive/10 px-4.5 py-3.5"
          >
            <h2 className="mb-1.5 text-[15px] font-semibold text-destructive">
              Fix {errors.length} {plural(errors.length, "issue", "issues")} before publishing
            </h2>
            <ul className="list-disc pl-4.5">
              {errors.map((error) => (
                <li key={error.message} className="my-0.5">
                  <button type="button" className="text-left font-medium hover:underline" onClick={() => goToError(error.id)}>
                    {error.message}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,7fr)_minmax(0,3fr)]">
          <div>
            <BasicInfoPanel
              key={descKey}
              name={name}
              slug={slug}
              slugAuto={slugAuto}
              shortDesc={shortDesc}
              initialDescHtml={descHtml}
              errorIds={errorIds}
              onNameChange={changeName}
              onSlugChange={(value) => {
                setSlug(value)
                clearError("fSlug")
              }}
              onSlugAutoChange={changeSlugAuto}
              onShortDescChange={setShortDesc}
              onDescChange={setDescHtml}
            />
            <MediaPanel
              images={images}
              hasError={errorIds.includes("fMedia")}
              onChange={(next) => {
                setImages(next)
                clearError("fMedia")
              }}
              onRemove={removeImage}
            />
          </div>

          <aside>
            <VisibilityPanel
              status={status}
              isActive={isActive}
              onStatusChange={changeStatus}
              onIsActiveChange={setIsActive}
            />
            <BrandPanel
              brands={brands}
              brandId={brandId}
              hasError={errorIds.includes("fBrand")}
              onBrandsChange={setBrands}
              onBrandIdChange={(id) => {
                setBrandId(id)
                clearError("fBrand")
              }}
            />
            <CategoriesPanel
              tree={categoryTree}
              selected={categoryIds}
              hasError={errorIds.includes("fCats")}
              onChange={(ids) => {
                setCategoryIds(ids)
                clearError("fCats")
              }}
            />
            <TagsPanel allTags={allTags} selectedIds={tagIds} onAllTagsChange={setAllTags} onChange={setTagIds} />
            <TemplatePanel templates={templates} templateId={templateId} onChange={changeTemplate} />
          </aside>
        </div>

        <OptionsPanel
          options={options}
          savedOptions={savedOptions}
          hasError={errorIds.includes("fOptions")}
          onChange={updateOptions}
          onRemove={removeOption}
        />
        <VariantsPanel
          rows={rows}
          totalCombos={allCombos.length}
          images={images}
          bulk={bulk}
          hasError={errorIds.includes("fMatrix")}
          showErrors={triedPublish}
          onBulkChange={setBulk}
          onApplyBulk={applyBulk}
          onUpdate={updateVariants}
          onRemoveRow={removeRow}
          onRestoreAll={() => {
            setRemoved([])
            toast.success("Removed variants restored")
          }}
        />
      </main>

      <Dialog open={payloadOpen} onOpenChange={setPayloadOpen}>
        <DialogContent className="sm:max-w-190">
          <DialogHeader>
            <DialogTitle>Product payload</DialogTitle>
            <DialogDescription>The JSON this form would send to your API.</DialogDescription>
          </DialogHeader>
          <pre className="max-h-[60vh] overflow-auto rounded-lg border bg-muted/60 p-3.5 font-mono text-[12.5px] leading-relaxed whitespace-pre">
            {JSON.stringify(payload(), null, 2)}
          </pre>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={copyPayload}>
              Copy JSON
            </Button>
            <Button type="button" onClick={() => setPayloadOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
