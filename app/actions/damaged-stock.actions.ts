"use server"

import { handleRequest } from "@/lib/action-response"
import { api } from "@/lib/api"
import type { DamagedStockList, DamagedStockMovement } from "@/types/damaged-stock.type"

export async function getDamagedStock(filters: { warehouseId?: string; search?: string; sortBy?: string; sortOrder?: string; page?: string }) {
  const query = new URLSearchParams({ limit: "20" })
  for (const [key, value] of Object.entries(filters)) if (value) query.set(key, value)
  return handleRequest(() => api.get<DamagedStockList>(`/inventory/damaged-stock?${query}`))
}

// Newest first, up to 100.
export async function getDamagedStockMovements(id: string) {
  return handleRequest(async () => (await api.get<{ data: DamagedStockMovement[] }>(`/inventory/damaged-stock/${id}/movements`)).data)
}
