"use server"

import { revalidatePath } from "next/cache"

import { handleRequest } from "@/lib/action-response"
import { api } from "@/lib/api"
import type { Batch, BatchDetail, WriteOffReason } from "@/types/batch.type"

export type BatchFilters = {
  search?: string
  warehouseId?: string
  status?: string
  expiry?: string
  inStock?: string
  sortBy?: string
  sortOrder?: string
  page?: string
  limit?: string
}

// Write-off, quarantine and release change stock and can clear expiry alerts.
function refresh(stockChanged = false) {
  revalidatePath("/inventory/batches")
  if (!stockChanged) return
  revalidatePath("/inventory/stock")
  revalidatePath("/inventory", "layout") // the Alerts tab badge
}

export async function getBatches(filters: BatchFilters) {
  const query = new URLSearchParams({ limit: "20" })
  for (const [key, value] of Object.entries(filters)) if (value) query.set(key, value)
  return handleRequest(() => api.get<{ data: Batch[]; meta: { total: number; page: number; totalPages: number } }>(`/inventory/batches?${query}`))
}

// A scanned or typed lot number or barcode; one batch per warehouse holding it.
export async function lookupBatch(code: string) {
  return handleRequest(async () => (await api.get<{ data: Batch[] }>(`/inventory/batches/lookup?code=${encodeURIComponent(code)}`)).data)
}

export async function getBatch(id: string) {
  return handleRequest(async () => (await api.get<{ data: BatchDetail }>(`/inventory/batches/${id}`)).data)
}

// Fixes label data; null clears a field.
export async function updateBatch(id: string, dto: { barcode: string | null; note: string | null; manufacturedAt: string | null; expiresAt: string | null }) {
  const res = await handleRequest(async () => (await api.patch<{ data: BatchDetail }>(`/inventory/batches/${id}`, dto)).data)
  if (res.success) refresh()
  return res
}

// No quantity = everything left; EXPIRED and RECALLED always take everything.
export async function writeOffBatch(id: string, dto: { reason: WriteOffReason; quantity?: number; note?: string }) {
  const res = await handleRequest(async () => (await api.post<{ data: BatchDetail }>(`/inventory/batches/${id}/write-off`, dto)).data)
  if (res.success) refresh(true)
  return res
}

// Answers with the held copy in the quality-check warehouse.
export async function quarantineBatch(id: string, dto: { toWarehouseId?: string; note?: string }) {
  const res = await handleRequest(async () => (await api.post<{ data: BatchDetail }>(`/inventory/batches/${id}/quarantine`, dto)).data)
  if (res.success) refresh(true)
  return res
}

// Either the held copy or the original; answers with the original, AVAILABLE again.
export async function releaseBatch(id: string, note?: string) {
  const res = await handleRequest(async () => (await api.post<{ data: BatchDetail }>(`/inventory/batches/${id}/release`, { note })).data)
  if (res.success) refresh(true)
  return res
}
