"use server"

import { revalidatePath } from "next/cache"

import { handleRequest } from "@/lib/action-response"
import { api } from "@/lib/api"
import type { Supplier, SupplierDto } from "@/types/supplier.type"

const PAGE_PATH = "/inventory/setup/suppliers"

export async function getSuppliers({ activeOnly = false } = {}) {
  return handleRequest(async () => {
    const res = await api.get<{ data: Supplier[] }>(`/suppliers?limit=100${activeOnly ? "&isActive=true" : ""}`)
    return res.data
  })
}

export async function createSupplier(dto: SupplierDto) {
  const res = await handleRequest(async () => (await api.post<{ data: Supplier }>("/suppliers", dto)).data)
  if (res.success) revalidatePath(PAGE_PATH)
  return res
}

// No delete: suppliers stay for traceability, so one is retired with { isActive: false }.
export async function updateSupplier(id: string, dto: SupplierDto) {
  const res = await handleRequest(async () => (await api.patch<{ data: Supplier }>(`/suppliers/${id}`, dto)).data)
  if (res.success) revalidatePath(PAGE_PATH)
  return res
}
