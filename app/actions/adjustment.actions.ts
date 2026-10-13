"use server"

import { revalidatePath } from "next/cache"

import { handleRequest } from "@/lib/action-response"
import { api } from "@/lib/api"
import type { Adjustment, AdjustmentDto, AdjustmentListRow } from "@/types/adjustment.type"

type Page<T> = { data: T[]; meta: { totalPages: number } }

function refresh(stockChanged = false) {
  revalidatePath("/inventory/adjustments")
  if (!stockChanged) return
  revalidatePath("/inventory/stock")
  revalidatePath("/inventory/movements")
  revalidatePath("/inventory/products")
}

// Newest first, 100 at a time; `warehouseId` keeps adjustments with any line there.
export async function getAdjustments(warehouseId?: string) {
  return handleRequest(async () => {
    const rows: AdjustmentListRow[] = []
    let page = 1
    let totalPages = 1
    while (page <= totalPages) {
      const filter = warehouseId ? `&warehouseId=${warehouseId}` : ""
      const res = await api.get<Page<AdjustmentListRow>>(`/inventory/adjustments?limit=100&page=${page}${filter}`)
      rows.push(...res.data)
      totalPages = res.meta.totalPages
      page++
    }
    return rows
  })
}

export async function getAdjustment(id: string) {
  return handleRequest(async () => (await api.get<{ data: Adjustment }>(`/inventory/adjustments/${id}`)).data)
}

export async function createAdjustment(dto: AdjustmentDto) {
  const res = await handleRequest(async () => (await api.post<{ data: Adjustment }>("/inventory/adjustments/requests", dto)).data)
  if (res.success) refresh()
  return res
}

// PENDING only; the type is fixed after create.
export async function updateAdjustment(id: string, dto: Omit<AdjustmentDto, "type">) {
  const res = await handleRequest(async () => (await api.patch<{ data: Adjustment }>(`/inventory/adjustments/${id}`, dto)).data)
  if (res.success) refresh()
  return res
}

// approve: PENDING → APPROVED. apply: APPROVED → APPLIED, the only step that changes stock.
// reject: PENDING only. cancel: PENDING or APPROVED.
export async function adjustmentAction(id: string, action: "approve" | "apply" | "reject" | "cancel") {
  const res = await handleRequest(async () => (await api.post<{ data: Adjustment }>(`/inventory/adjustments/${id}/${action}`, {})).data)
  if (res.success) refresh(action === "apply")
  return res
}
