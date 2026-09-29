"use server"

import { revalidatePath } from "next/cache"

import { api, ApiError } from "@/lib/api"
import type {
  Category,
  CreateCategoryDto,
  MoveCategoryDto,
  UpdateCategoryDto,
} from "@/types/category.type"

const PAGE_PATH = "/products/categories"

export type ActionResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string; fieldErrors?: Record<string, string> }

// Runs an API call and turns thrown errors into a result the UI can show.
// (Next.js hides thrown error messages from the browser in production.)
async function handleRequest<T>(fn: () => Promise<T>): Promise<ActionResponse<T>> {
  try {
    return { success: true, data: await fn() }
  } catch (error) {
    if (error instanceof ApiError) {
      return { success: false, error: error.message, fieldErrors: error.fieldErrors }
    }
    return { success: false, error: "Something went wrong" }
  }
}

export async function getCategoryTree() {
  return handleRequest(async () => {
    const res = await api.get<{ data: Category[] }>("/categories/tree")
    return res.data
  })
}

export async function createCategory(dto: CreateCategoryDto) {
  const res = await handleRequest(async () => {
    const res = await api.post<{ data: Category }>("/categories", dto)
    return res.data
  })
  if (res.success) revalidatePath(PAGE_PATH)
  return res
}

export async function updateCategory(id: string, dto: UpdateCategoryDto) {
  const res = await handleRequest(async () => {
    const res = await api.patch<{ data: Category }>(`/categories/${id}`, dto)
    return res.data
  })
  if (res.success) revalidatePath(PAGE_PATH)
  return res
}

export async function moveCategory(id: string, dto: MoveCategoryDto) {
  const res = await handleRequest(async () => {
    const res = await api.patch<{ data: Category }>(`/categories/${id}/move`, dto)
    return res.data
  })
  if (res.success) revalidatePath(PAGE_PATH)
  return res
}

// Only works when the category has no subcategories and no products.
export async function deleteCategory(id: string) {
  const res = await handleRequest(async () => {
    await api.delete(`/categories/${id}`)
    return true
  })
  if (res.success) revalidatePath(PAGE_PATH)
  return res
}

// Deletes the category and all its subcategories.
export async function deleteCategoryCascade(id: string) {
  const res = await handleRequest(async () => {
    await api.delete(`/categories/${id}/cascade`)
    return true
  })
  if (res.success) revalidatePath(PAGE_PATH)
  return res
}
