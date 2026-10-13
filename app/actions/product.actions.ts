"use server"

import { revalidatePath } from "next/cache"

import { handleRequest } from "@/lib/action-response"
import { api } from "@/lib/api"
import { slugify } from "@/lib/slug"
import type { Option } from "@/types/option.type"
import type { Product, ProductCreate, ProductDetail, ProductUpdate } from "@/types/product.type"

const PAGE_PATH = "/products"

// The API returns at most 100 per page, so walk the pages until there are no more.
export async function getProducts() {
  return handleRequest(async () => {
    const products: Product[] = []
    let page = 1
    let hasNext = true
    while (hasNext) {
      const res = await api.get<{ data: Product[]; meta: { hasNext: boolean } }>(
        `/products?limit=100&page=${page}&sortBy=createdAt&sortOrder=desc`
      )
      products.push(...res.data)
      hasNext = res.meta.hasNext
      page++
    }
    return products
  })
}

// publish → ACTIVE, archive → ARCHIVED, unarchive → DRAFT
export async function changeProductStatus(id: string, action: "publish" | "archive" | "unarchive") {
  const res = await handleRequest(async () => {
    const res = await api.patch<{ data: Product }>(`/products/${id}/${action}`, {})
    return res.data
  })
  if (res.success) {
    revalidatePath(PAGE_PATH)
    revalidatePath(`/products/${id}`)
  }
  return res
}

// Soft delete: the product disappears from the list but stays in the database.
export async function deleteProduct(id: string) {
  const res = await handleRequest(async () => {
    await api.delete(`/products/${id}`)
    return true
  })
  if (res.success) revalidatePath(PAGE_PATH)
  return res
}

// Creates the product with its variants in one call. Each variant's stock and cost are written to the
// inventory ledger as opening stock in the default warehouse, so the product shows up in Inventory right away.
export async function createProduct(input: ProductCreate) {
  const res = await handleRequest(async () => {
    let brandId = input.brand.id
    if (brandId.startsWith("new-")) {
      const brand = await api.post<{ data: { id: string } }>("/brands", {
        name: input.brand.name,
        slug: slugify(input.brand.name),
      })
      brandId = brand.data.id
    }

    // Options are matched to saved ones by name; a new option or value is created first.
    const saved = (await api.get<{ data: Option[] }>("/options?limit=100")).data
    async function optionFor(name: string) {
      const found = saved.find((o) => o.name.toLowerCase() === name.toLowerCase())
      if (found) return found
      const created = await api.post<{ data: Option }>("/options", { name })
      const option = { ...created.data, values: [] }
      saved.push(option)
      return option
    }
    async function valueId(name: string, value: string) {
      const option = await optionFor(name)
      const found = option.values.find((v) => v.value.toLowerCase() === value.toLowerCase())
      if (found) return found.id
      const created = await api.post<{ data: Option["values"][number] }>(`/options/${option.id}/values`, { value })
      option.values.push(created.data)
      return created.data.id
    }

    const variants = []
    for (const v of input.variants) {
      const optionValueIds = []
      for (const o of v.options) optionValueIds.push(await valueId(o.name, o.value))
      variants.push({
        sku: v.sku,
        price: v.price,
        stock: v.stock,
        ...(v.costPrice !== null && { costPrice: v.costPrice }),
        isActive: v.isActive,
        optionValueIds,
        ...(v.imageUrl && { images: [{ url: v.imageUrl, isPrimary: true, position: 0 }] }),
      })
    }
    const optionNames = [...new Set(input.variants.flatMap((v) => v.options.map((o) => o.name.toLowerCase())))]
    // The API wants at least 2 characters of description, so an empty editor is left out.
    const hasDescription = input.description.replace(/<[^>]*>/g, "").trim().length >= 2

    // Unlike brands and options, the products endpoints return the record without a { data } wrapper.
    const created = await api.post<{ id: string; name: string }>("/products", {
      name: input.name,
      slug: input.slug,
      ...(input.shortDescription && { shortDescription: input.shortDescription }),
      ...(hasDescription && { description: input.description }),
      status: input.status,
      isActive: input.isActive,
      brandId,
      ...(input.supplierId && { supplierId: input.supplierId }),
      categoryIds: input.categoryIds,
      primaryCategoryId: input.categoryIds[0],
      tagIds: input.tagIds,
      images: input.images.map((image, position) => ({
        url: image.url,
        ...(image.altText && { altText: image.altText }),
        isPrimary: position === 0,
        position,
      })),
      optionIds: saved.filter((o) => optionNames.includes(o.name.toLowerCase())).map((o) => o.id),
      variants,
    })
    return created
  })
  if (res.success) {
    revalidatePath(PAGE_PATH)
    revalidatePath("/inventory/products")
    revalidatePath("/inventory/stock")
  }
  return res
}

export async function getProduct(id: string) {
  return handleRequest(() => api.get<ProductDetail>(`/products/${id}`))
}

// The API has no single "save everything" call, so this patches the product,
// then syncs its images and variants one request at a time.
export async function updateProduct(id: string, input: ProductUpdate) {
  const res = await handleRequest(async () => {
    let brandId = input.brand.id
    // A brand typed into the form only exists there until the product is saved.
    if (brandId.startsWith("new-")) {
      const brand = await api.post<{ data: { id: string } }>("/brands", {
        name: input.brand.name,
        slug: slugify(input.brand.name),
      })
      brandId = brand.data.id
    }

    await api.patch(`/products/${id}`, {
      name: input.name,
      slug: input.slug,
      shortDescription: input.shortDescription,
      description: input.description,
      status: input.status,
      isActive: input.isActive,
      brandId,
      categoryIds: input.categoryIds,
      primaryCategoryId: input.categoryIds[0],
      tagIds: input.tagIds,
    })
    const current = await api.get<ProductDetail>(`/products/${id}`)

    // Images are matched by URL.
    const urls = input.images.map((image) => image.url)
    for (const image of current.images) {
      if (!urls.includes(image.url)) await api.delete(`/products/${id}/images/${image.id}`)
    }
    let saved = current.images.filter((image) => urls.includes(image.url))
    const added = input.images.filter((image) => !saved.some((s) => s.url === image.url))
    if (added.length > 0) {
      const created = await api.post<ProductDetail["images"]>(`/products/${id}/images`, {
        images: added.map((image) => ({
          url: image.url,
          ...(image.altText && { altText: image.altText }),
          isPrimary: false,
          position: urls.indexOf(image.url),
        })),
      })
      saved = [...saved, ...created]
    }
    const savedImage = (url: string) => saved.find((s) => s.url === url)!
    await api.patch(`/products/${id}/images/reorder`, {
      items: input.images.map((image, position) => ({ id: savedImage(image.url).id, position })),
    })
    for (const [index, image] of input.images.entries()) {
      const s = savedImage(image.url)
      const makePrimary = index === 0 && !s.isPrimary
      if (makePrimary || (s.altText ?? "") !== image.altText) {
        await api.patch(`/products/${id}/images/${s.id}`, {
          altText: image.altText,
          ...(makePrimary && { isPrimary: true }),
        })
      }
    }

    // Delete first so a removed variant's SKU can be reused.
    const keptIds = input.variants.map((v) => v.id)
    for (const variant of current.variants) {
      if (!keptIds.includes(variant.id)) await api.delete(`/products/variants/${variant.id}`)
    }

    const values = current.options.flatMap(({ option }) => option.values.map((v) => ({ ...v, optionId: option.id })))
    // New variants need option value ids; a value typed in the form is created on its option.
    async function valueId(optionId: string, value: string) {
      const found = values.find((v) => v.optionId === optionId && v.value.toLowerCase() === value.toLowerCase())
      if (found) return found.id
      const created = await api.post<{ data: { id: string } }>(`/options/${optionId}/values`, { value })
      values.push({ id: created.data.id, value, optionId })
      return created.data.id
    }

    for (const variant of input.variants) {
      const fields = { sku: variant.sku, price: variant.price, stock: variant.stock, isActive: variant.isActive }
      const before = current.variants.find((v) => v.id === variant.id)
      if (!before) {
        const optionValueIds = []
        for (const o of variant.options) optionValueIds.push(await valueId(o.optionId, o.value))
        await api.post(`/products/${id}/variants`, {
          ...fields,
          optionValueIds,
          ...(variant.imageUrl && { images: [{ url: variant.imageUrl, isPrimary: true, position: 0 }] }),
        })
      } else if (
        before.sku !== variant.sku ||
        Number(before.price) !== variant.price ||
        before.stock !== variant.stock ||
        before.isActive !== variant.isActive
      ) {
        await api.patch(`/products/variants/${variant.id}`, fields)
      }
    }
    return true
  })
  if (res.success) revalidatePath(PAGE_PATH)
  return res
}
