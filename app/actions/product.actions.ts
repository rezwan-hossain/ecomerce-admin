"use server"

import { revalidatePath } from "next/cache"

import { handleRequest } from "@/lib/action-response"
import { api } from "@/lib/api"
import type { Product } from "@/types/product.type"

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
  if (res.success) revalidatePath(PAGE_PATH)
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
