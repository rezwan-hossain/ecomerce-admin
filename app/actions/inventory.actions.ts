"use server"

import { revalidatePath } from "next/cache"

import { handleRequest } from "@/lib/action-response"
import { api } from "@/lib/api"
import type {
  AdjustStockDto,
  InventorySummary,
  LedgerMovement,
  LocationDto,
  MoveStockDto,
  StockCountDto,
  StorageLocation,
  VariantStock,
  VariantStockDetail,
} from "@/types/inventory.type"

const STOCK_PATH = "/inventory/stock"
const LOCATIONS_PATH = "/inventory/setup/racks"

// The ledger only grows, so the Movements page shows the latest ones.
const MOVEMENT_PAGES = 5

type Page<T> = { data: T[]; meta: { totalPages: number } }

// Walks the pages of a list endpoint until there are no more (or `maxPages`).
async function allPages<T>(path: string, limit: number, maxPages = Infinity) {
  const rows: T[] = []
  let page = 1
  let totalPages = 1
  while (page <= totalPages && page <= maxPages) {
    const res = await api.get<Page<T>>(`${path}${path.includes("?") ? "&" : "?"}limit=${limit}&page=${page}`)
    rows.push(...res.data)
    totalPages = res.meta.totalPages
    page++
  }
  return rows
}

export async function getStock() {
  return handleRequest(() => allPages<VariantStock>("/inventory?sortBy=stock&sortOrder=asc", 100))
}

export async function getProductStock(productId: string) {
  return handleRequest(() => allPages<VariantStock>(`/inventory?productId=${productId}&sortBy=sku`, 100))
}

export async function getInventorySummary() {
  return handleRequest(async () => (await api.get<{ data: InventorySummary }>("/inventory/summary")).data)
}

export async function getVariantStock(variantId: string) {
  return handleRequest(async () => (await api.get<{ data: VariantStockDetail }>(`/inventory/variants/${variantId}`)).data)
}

export async function getMovements() {
  return handleRequest(() => allPages<LedgerMovement>("/inventory/movements", 100, MOVEMENT_PAGES))
}

export async function getLocations() {
  return handleRequest(() => allPages<StorageLocation>("/inventory/locations", 200))
}

export async function adjustStock(dto: AdjustStockDto) {
  const res = await handleRequest(() => api.post("/inventory/adjustments", dto))
  if (res.success) revalidatePath(STOCK_PATH)
  return res
}

// All or nothing: one ledger transaction for every line, e.g. a delivery of many variants.
export async function bulkAdjustStock(items: AdjustStockDto[]) {
  const res = await handleRequest(() => api.post("/inventory/adjustments/bulk", { items }))
  if (res.success) revalidatePath(STOCK_PATH)
  return res
}

export async function countStock(variantId: string, dto: StockCountDto) {
  const res = await handleRequest(async () => {
    const res = await api.post<{ message: string }>(`/inventory/variants/${variantId}/count`, dto)
    return res.message // "Stock already matches count" when nothing changed
  })
  if (res.success) revalidatePath(STOCK_PATH)
  return res
}

export async function moveStock(dto: MoveStockDto) {
  const res = await handleRequest(() => api.post("/inventory/location-moves", dto))
  if (res.success) revalidatePath(STOCK_PATH)
  return res
}

export async function updateThreshold(variantId: string, lowStockThreshold: number) {
  const res = await handleRequest(() => api.patch(`/inventory/variants/${variantId}/threshold`, { lowStockThreshold }))
  if (res.success) revalidatePath(STOCK_PATH)
  return res
}

// null clears it, so stock coming in goes to the UNASSIGNED rack again.
export async function setDefaultRack(variantId: string, warehouseId: string, locationId: string | null) {
  const res = await handleRequest(() =>
    api.patch(`/inventory/variants/${variantId}/default-location`, { warehouseId, locationId })
  )
  if (res.success) revalidatePath(STOCK_PATH)
  return res
}

// The ledger filters by variant only, so a product's movements are fetched per variant and merged.
export async function getProductMovements(variantIds: string[], limit = 25) {
  return handleRequest(async () => {
    const pages = await Promise.all(
      variantIds.map((id) => api.get<Page<LedgerMovement> & { meta: { total: number } }>(`/inventory/movements?variantId=${id}&limit=${limit}`))
    )
    const movements = pages
      .flatMap((p) => p.data)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit)
    return { movements, total: pages.reduce((sum, p) => sum + p.meta.total, 0) }
  })
}

export async function getWarehouseMovements(warehouseId: string, limit: number) {
  return handleRequest(async () => (await api.get<Page<LedgerMovement>>(`/inventory/movements?warehouseId=${warehouseId}&limit=${limit}`)).data)
}

// Ledger rows written for one document, e.g. an order's sale and reservation rows.
export async function getReferenceMovements(referenceId: string) {
  return handleRequest(async () => (await api.get<Page<LedgerMovement>>(`/inventory/movements?referenceId=${referenceId}&limit=100`)).data)
}

export async function getRecentMovements(limit: number) {
  return handleRequest(async () => (await api.get<Page<LedgerMovement>>(`/inventory/movements?limit=${limit}`)).data)
}

export async function createLocation(dto: LocationDto) {
  const res = await handleRequest(() => api.post("/inventory/locations", dto))
  if (res.success) revalidatePath(LOCATIONS_PATH)
  return res
}

export async function updateLocation(id: string, dto: Partial<LocationDto>) {
  const res = await handleRequest(() => api.patch(`/inventory/locations/${id}`, dto))
  if (res.success) revalidatePath(LOCATIONS_PATH)
  return res
}

export async function deleteLocation(id: string) {
  const res = await handleRequest(() => api.delete(`/inventory/locations/${id}`))
  if (res.success) revalidatePath(LOCATIONS_PATH)
  return res
}
