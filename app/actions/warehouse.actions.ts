"use server"

import { revalidatePath } from "next/cache"

import { handleRequest } from "@/lib/action-response"
import { api } from "@/lib/api"
import type { Warehouse, WarehouseDto, WarehouseStockRow } from "@/types/warehouse.type"

// Default and active flags change what the storefront can sell, so stock pages refresh too.
function refresh() {
  revalidatePath("/inventory/setup/warehouses", "layout")
  revalidatePath("/inventory/stock")
  revalidatePath("/inventory/products")
}

// Default first, then by priority. Not paginated.
export async function getWarehouse() {
  return handleRequest(async () => (await api.get<{ data: Warehouse[] }>("/inventory/warehouses")).data)
}

export async function getWarehouseById(id: string) {
  return handleRequest(async () => (await api.get<{ data: Warehouse }>(`/inventory/warehouses/${id}`)).data)
}

export async function getWarehouseStock(id: string, page: number, search: string) {
  const query = new URLSearchParams({ page: String(page), limit: "20" })
  if (search) query.set("search", search)
  return handleRequest(() =>
    api.get<{ data: WarehouseStockRow[]; meta: { total: number; page: number; totalPages: number } }>(`/inventory/warehouses/${id}/stock?${query}`)
  )
}

export async function createWarehouse(dto: WarehouseDto) {
  const res = await handleRequest(async () => (await api.post<{ data: Warehouse }>("/inventory/warehouses", dto)).data)
  if (res.success) refresh()
  return res
}

export async function updateWarehouse(id: string, dto: Partial<WarehouseDto>) {
  const res = await handleRequest(async () => (await api.patch<{ data: Warehouse }>(`/inventory/warehouses/${id}`, dto)).data)
  if (res.success) refresh()
  return res
}

// Only for an unused warehouse; one with stock, racks or documents answers 409 "Deactivate it instead".
export async function deleteWarehouse(id: string) {
  const res = await handleRequest(() => api.delete(`/inventory/warehouses/${id}`))
  if (res.success) refresh()
  return res
}
