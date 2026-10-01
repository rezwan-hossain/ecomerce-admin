"use server"

import { revalidatePath } from "next/cache"

import type {
  Campaign,
  Catalog,
  MarketingData,
  Promotion,
  Rule,
  PromotionScope,
  TargetType,
} from "@/components/marketing/marketing-utils"
import { handleRequest } from "@/lib/action-response"
import { api } from "@/lib/api"
import type { Category } from "@/types/category.type"

// API shapes, only the fields the planner reads. Decimals come back as strings.
type ApiCampaign = Omit<Campaign, "banners" | "sections" | "promotionIds" | "description" | "bannerUrl" | "thumbnailUrl" | "metaTitle" | "metaDescription" | "metaImageUrl"> & {
  description: string | null
  bannerUrl: string | null
  thumbnailUrl: string | null
  metaTitle: string | null
  metaDescription: string | null
  metaImageUrl: string | null
  banners: { id: string; title: string | null; imageUrl: string; mobileImageUrl: string | null; linkUrl: string | null; isActive: boolean; position: number }[]
  sections: { id: string; title: string; slug: string | null; description: string | null; bannerUrl: string | null; isActive: boolean; position: number }[]
}
type ApiRule = Omit<Rule, "minPrice" | "maxPrice"> & { minPrice: string | null; maxPrice: string | null }
type ApiPromotion = {
  id: string
  name: string
  description: string | null
  type: Promotion["type"]
  status: Promotion["status"]
  value: string | null
  buyQuantity: number | null
  getQuantity: number | null
  minOrderAmount: string | null
  maxDiscountAmount: string | null
  startsAt: string | null
  endsAt: string | null
  isActive: boolean
  priority: number
  scope?: PromotionScope // missing until the backend returns it
  targets: { id: string; targetType: TargetType; productId: string | null; variantId: string | null; categoryId: string | null; brandId: string | null; tagId: string | null }[]
  campaigns: { campaignId: string }[]
}
type ApiProduct = {
  id: string
  name: string
  status: string
  brand: { id: string } | null
  categories: { category: { id: string } }[]
  tags: { tag: { id: string } }[]
  variants: { id: string; sku: string; price: string; isActive: boolean }[]
}

const num = (value: string | null) => (value === null ? null : Number(value))

// Which id field of a PromotionTarget holds the target, by type.
const TARGET_FIELD: Record<TargetType, "categoryId" | "brandId" | "tagId" | "productId" | "variantId"> = {
  CATEGORY: "categoryId",
  BRAND: "brandId",
  TAG: "tagId",
  PRODUCT: "productId",
  VARIANT: "variantId",
}

function revalidate() {
  revalidatePath("/marketing/planner")
  revalidatePath("/marketing/campaigns")
  revalidatePath("/marketing/promotions")
}

// Drops null fields: create endpoints (and banner/section updates) only accept
// missing optional fields, not null.
const withoutNulls = (body: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(body).filter(([, value]) => value !== null))

/* ---------- Load ---------- */

export async function loadMarketing() {
  return handleRequest(async (): Promise<MarketingData> => {
    const [campaignList, promotionList, brands, tags, tree, products] = await Promise.all([
      api.get<{ data: { id: string }[] }>("/campaigns?limit=100"),
      api.get<{ data: { id: string }[] }>("/promotions?limit=100"),
      api.get<{ data: { id: string; name: string }[] }>("/brands?limit=100"),
      api.get<{ data: { id: string; name: string }[] }>("/tags?limit=100"),
      api.get<{ data: Category[] }>("/categories/tree"),
      api.get<{ data: ApiProduct[] }>("/products?limit=100"),
    ])

    // The list endpoints leave out banners, sections, targets and links, so load each one.
    const promotions = await Promise.all(
      promotionList.data.map(async ({ id }) => {
        const { data: p } = await api.get<{ data: ApiPromotion }>(`/promotions/${id}`)
        return {
          id: p.id,
          name: p.name,
          description: p.description ?? "",
          type: p.type,
          status: p.status,
          value: num(p.value),
          buyQuantity: p.buyQuantity,
          getQuantity: p.getQuantity,
          minOrderAmount: num(p.minOrderAmount),
          maxDiscountAmount: num(p.maxDiscountAmount),
          startsAt: p.startsAt,
          endsAt: p.endsAt,
          isActive: p.isActive,
          priority: p.priority,
          // The schema's default, until the running backend returns scope.
          scope: p.scope ?? "SPECIFIC",
          targets: p.targets.map((t) => ({
            id: t.id,
            targetType: t.targetType,
            refId: t[TARGET_FIELD[t.targetType]]!,
          })),
          campaignIds: p.campaigns.map((c) => c.campaignId),
        } satisfies Promotion
      })
    )

    const campaigns = await Promise.all(
      campaignList.data.map(async ({ id }) => {
        const { data: c } = await api.get<{ data: ApiCampaign }>(`/campaigns/${id}`)
        const sections = await Promise.all(
          [...c.sections]
            .sort((a, b) => a.position - b.position)
            .map(async (s) => {
              const [rules, sectionProducts] = await Promise.all([
                api.get<{ data: ApiRule[] }>(`/campaigns/sections/${s.id}/rules`),
                api.get<{ data: { productId: string; position: number }[] }>(`/campaigns/sections/${s.id}/products`),
              ])
              return {
                id: s.id,
                title: s.title,
                slug: s.slug ?? "",
                description: s.description ?? "",
                bannerUrl: s.bannerUrl ?? "",
                isActive: s.isActive,
                productIds: [...sectionProducts.data].sort((a, b) => a.position - b.position).map((p) => p.productId),
                rules: rules.data.map((r) => ({
                  id: r.id,
                  categoryId: r.categoryId,
                  brandId: r.brandId,
                  tagId: r.tagId,
                  matchType: r.matchType,
                  minPrice: num(r.minPrice),
                  maxPrice: num(r.maxPrice),
                })),
              }
            })
        )
        return {
          id: c.id,
          name: c.name,
          slug: c.slug,
          description: c.description ?? "",
          status: c.status,
          startsAt: c.startsAt,
          endsAt: c.endsAt,
          bannerUrl: c.bannerUrl ?? "",
          thumbnailUrl: c.thumbnailUrl ?? "",
          isActive: c.isActive,
          isFeatured: c.isFeatured,
          metaTitle: c.metaTitle ?? "",
          metaDescription: c.metaDescription ?? "",
          metaImageUrl: c.metaImageUrl ?? "",
          banners: [...c.banners]
            .sort((a, b) => a.position - b.position)
            .map((b) => ({
              id: b.id,
              title: b.title ?? "",
              imageUrl: b.imageUrl,
              mobileImageUrl: b.mobileImageUrl ?? "",
              linkUrl: b.linkUrl ?? "",
              isActive: b.isActive,
            })),
          sections,
          promotionIds: promotions.filter((p) => p.campaignIds.includes(c.id)).map((p) => p.id),
        } satisfies Campaign
      })
    )

    const flatten = (nodes: Category[]): Catalog["categories"] =>
      nodes.flatMap((n) => [{ id: n.id, name: n.name, parentId: n.parentId }, ...flatten(n.children ?? [])])

    const catalog: Catalog = {
      categories: flatten(tree.data),
      brands: brands.data.map((b) => ({ id: b.id, name: b.name })),
      tags: tags.data.map((t) => ({ id: t.id, name: t.name })),
      products: products.data
        .filter((p) => p.status === "ACTIVE")
        .map((p) => ({
          id: p.id,
          name: p.name,
          brandId: p.brand?.id ?? null,
          categoryIds: p.categories.map((c) => c.category.id),
          tagIds: p.tags.map((t) => t.tag.id),
          variants: p.variants
            .filter((v) => v.isActive)
            .map((v) => ({
              id: v.id,
              sku: v.sku,
              price: Number(v.price),
              name: v.sku, // the product list has no option values, so the SKU names the variant
            })),
        }))
        .filter((p) => p.variants.length > 0),
    }

    return { campaigns, promotions, catalog }
  })
}

/* ---------- Campaign ---------- */

const isNew = (id: string) => id.startsWith("new-")

// The API only accepts changes to banners, sections, targets and links while the
// record is on and not archived.
const editable = (r: { isActive: boolean; status: string }) => r.isActive && r.status !== "ARCHIVED"

// Saves the campaign, then brings its banners, sections, rules, products and
// promotion links in line with the draft. linkedBefore = promotion ids it had when opened.
export async function saveCampaign(draft: Campaign, linkedBefore: string[]) {
  const res = await handleRequest(async () => {
    const core = {
      name: draft.name.trim(),
      slug: draft.slug,
      description: draft.description.trim() || null,
      status: draft.status,
      startsAt: draft.startsAt,
      endsAt: draft.endsAt,
      bannerUrl: draft.bannerUrl.trim() || null,
      thumbnailUrl: draft.thumbnailUrl.trim() || null,
      isActive: draft.isActive,
      isFeatured: draft.isFeatured,
      metaTitle: draft.metaTitle.trim() || null,
      metaDescription: draft.metaDescription.trim() || null,
      metaImageUrl: draft.metaImageUrl.trim() || null,
    }

    // A new campaign starts editable; its chosen on/off state and status are applied at the end.
    let id = draft.id
    if (isNew(id)) {
      const created = await api.post<{ data: { id: string } }>(
        "/campaigns",
        withoutNulls({ ...core, isActive: true, status: core.status === "ARCHIVED" ? "DRAFT" : core.status })
      )
      id = created.data.id
    }

    const { data: current } = await api.get<{ data: ApiCampaign }>(`/campaigns/${id}`)
    // Change the rows while the campaign still accepts them: after switching it on, before switching it off.
    const coreFirst = !editable(current)
    if (coreFirst) await api.patch(`/campaigns/${id}`, core)

    // Banners
    for (const b of current.banners) {
      if (!draft.banners.some((x) => x.id === b.id)) await api.delete(`/campaigns/banners/${b.id}`)
    }
    for (const [position, b] of draft.banners.entries()) {
      const body = {
        title: b.title.trim() || null,
        imageUrl: b.imageUrl.trim(),
        mobileImageUrl: b.mobileImageUrl.trim() || null,
        linkUrl: b.linkUrl.trim() || null,
        isActive: b.isActive,
        position,
      }
      // Banner and section updates reject null too, so an emptied optional field can't be cleared yet.
      if (isNew(b.id)) await api.post(`/campaigns/${id}/banners`, withoutNulls(body))
      else await api.patch(`/campaigns/banners/${b.id}`, withoutNulls(body))
    }

    // Sections, each with its rules and hand-picked products
    for (const s of current.sections) {
      if (!draft.sections.some((x) => x.id === s.id)) await api.delete(`/campaigns/sections/${s.id}`)
    }
    for (const [position, s] of draft.sections.entries()) {
      const body = {
        title: s.title.trim(),
        slug: s.slug || null,
        description: s.description.trim() || null,
        bannerUrl: s.bannerUrl.trim() || null,
        isActive: s.isActive,
        position,
      }
      let sectionId = s.id
      let currentRules: ApiRule[] = []
      let currentProducts: string[] = []
      if (isNew(s.id)) {
        const created = await api.post<{ data: { id: string } }>(`/campaigns/${id}/sections`, withoutNulls(body))
        sectionId = created.data.id
      } else {
        await api.patch(`/campaigns/sections/${s.id}`, withoutNulls(body))
        const [rules, products] = await Promise.all([
          api.get<{ data: ApiRule[] }>(`/campaigns/sections/${s.id}/rules`),
          api.get<{ data: { productId: string; position: number }[] }>(`/campaigns/sections/${s.id}/products`),
        ])
        currentRules = rules.data
        currentProducts = [...products.data].sort((a, b) => a.position - b.position).map((p) => p.productId)
      }

      for (const r of currentRules) {
        if (!s.rules.some((x) => x.id === r.id)) await api.delete(`/campaigns/sections/rules/${r.id}`)
      }
      for (const r of s.rules) {
        const ruleBody = {
          categoryId: r.categoryId,
          brandId: r.brandId,
          tagId: r.tagId,
          matchType: r.matchType,
          minPrice: r.minPrice,
          maxPrice: r.maxPrice,
        }
        if (isNew(r.id)) await api.post(`/campaigns/sections/${sectionId}/rules`, withoutNulls(ruleBody))
        else await api.patch(`/campaigns/sections/rules/${r.id}`, ruleBody)
      }

      // Products keep their order through `position`, so re-attach them when anything changed.
      if (currentProducts.join() !== s.productIds.join()) {
        for (const productId of currentProducts) {
          await api.delete(`/campaigns/sections/${sectionId}/products/${productId}`)
        }
        if (s.productIds.length > 0) {
          await api.post(`/campaigns/sections/${sectionId}/products`, {
            products: s.productIds.map((productId, i) => ({ productId, position: i })),
          })
        }
      }
    }

    if (!coreFirst) await api.patch(`/campaigns/${id}`, core)

    // Promotion links live on the promotion side of the API (and need the promotion to be on).
    for (const promotionId of draft.promotionIds.filter((p) => !linkedBefore.includes(p))) {
      await api.post(`/promotions/${promotionId}/campaigns`, { campaignIds: [id] })
    }
    for (const promotionId of linkedBefore.filter((p) => !draft.promotionIds.includes(p))) {
      await api.delete(`/promotions/${promotionId}/campaigns/${id}`)
    }

    return { id }
  })
  if (res.success) revalidate()
  return res
}

/* ---------- Promotion ---------- */

// Saves the promotion, then its targets and campaign links.
// before = target and campaign ids it had when opened.
export async function savePromotion(draft: Promotion, before: { targetIds: string[]; campaignIds: string[] }) {
  const res = await handleRequest(async () => {
    const t = draft.type
    const core = {
      name: draft.name.trim(),
      description: draft.description.trim() || null,
      type: t,
      status: draft.status,
      value: ["PERCENTAGE", "FIXED_AMOUNT", "FIXED_PRICE", "SHIPPING_DISCOUNT"].includes(t) ? draft.value : null,
      buyQuantity: t === "BUY_X_GET_Y" ? draft.buyQuantity : null,
      getQuantity: t === "BUY_X_GET_Y" ? draft.getQuantity : null,
      minOrderAmount: draft.minOrderAmount,
      maxDiscountAmount: t === "PERCENTAGE" ? draft.maxDiscountAmount : null,
      startsAt: draft.startsAt,
      endsAt: draft.endsAt,
      isActive: draft.isActive,
      priority: draft.priority,
      scope: draft.scope,
    }

    // A new promotion starts editable; its chosen on/off state and status are applied at the end.
    let id = draft.id
    if (isNew(id)) {
      const created = await api.post<{ data: { id: string } }>(
        "/promotions",
        withoutNulls({ ...core, isActive: true, status: core.status === "ARCHIVED" ? "DRAFT" : core.status })
      )
      id = created.data.id
    }

    const { data: current } = await api.get<{ data: ApiPromotion }>(`/promotions/${id}`)
    // Change targets and links while the promotion still accepts them.
    const coreFirst = !editable(current)
    if (coreFirst) await api.patch(`/promotions/${id}`, core)

    // Targets only exist on SPECIFIC promotions. Switching to ALL leaves them for
    // the backend to remove, so they're only edited while the scope is SPECIFIC.
    if (draft.scope === "SPECIFIC") {
      // An ALL promotion rejects targets, so move it to SPECIFIC before attaching any.
      if (current.scope === "ALL" && !coreFirst) await api.patch(`/promotions/${id}`, { scope: "SPECIFIC" })
      for (const targetId of before.targetIds.filter((tid) => !draft.targets.some((x) => x.id === tid))) {
        await api.delete(`/promotions/targets/${targetId}`)
      }
      const added = draft.targets.filter((x) => isNew(x.id))
      if (added.length > 0) {
        await api.post(`/promotions/${id}/targets`, {
          targets: added.map((x) => ({ targetType: x.targetType, [TARGET_FIELD[x.targetType]]: x.refId })),
        })
      }
    }

    const linked = draft.campaignIds.filter((c) => !before.campaignIds.includes(c))
    if (linked.length > 0) await api.post(`/promotions/${id}/campaigns`, { campaignIds: linked })
    for (const campaignId of before.campaignIds.filter((c) => !draft.campaignIds.includes(c))) {
      await api.delete(`/promotions/${id}/campaigns/${campaignId}`)
    }

    if (!coreFirst) await api.patch(`/promotions/${id}`, core)
    return { id }
  })
  if (res.success) revalidate()
  return res
}

/* ---------- Quick changes from the lists ---------- */

export async function patchCampaign(id: string, patch: { isActive?: boolean; isFeatured?: boolean }) {
  const res = await handleRequest(() => api.patch(`/campaigns/${id}`, patch))
  if (res.success) revalidate()
  return res
}

export async function patchPromotion(id: string, patch: { isActive?: boolean }) {
  const res = await handleRequest(() => api.patch(`/promotions/${id}`, patch))
  if (res.success) revalidate()
  return res
}

export async function removeCampaign(id: string) {
  const res = await handleRequest(() => api.delete(`/campaigns/${id}`))
  if (res.success) revalidate()
  return res
}

export async function removePromotion(id: string) {
  const res = await handleRequest(() => api.delete(`/promotions/${id}`))
  if (res.success) revalidate()
  return res
}
