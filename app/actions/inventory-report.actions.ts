"use server"

import { handleRequest } from "@/lib/action-response"
import { api } from "@/lib/api"
import type { SlowMovingReport, StockHistoryReport, StockValueReport, TurnoverReport } from "@/types/inventory-report.type"

// Drops empty filters so the API applies its defaults.
function query(params: Record<string, string | number | boolean | undefined>) {
  const q = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") q.set(key, String(value))
  }
  return q.toString()
}

export async function getStockValueReport(includeInactive: boolean) {
  return handleRequest(async () => (await api.get<{ data: StockValueReport }>(`/inventory/reports/stock-value?${query({ includeInactive })}`)).data)
}

export async function getSlowMovingReport(params: {
  days?: string
  coverDays?: string
  status?: string
  warehouseId?: string
  search?: string
  sortBy?: string
  sortOrder?: string
  page?: string
}) {
  return handleRequest(() => api.get<SlowMovingReport>(`/inventory/reports/slow-moving?${query({ ...params, limit: 20 })}`))
}

export async function getTurnoverReport(params: { days?: string; warehouseId?: string; search?: string; sortBy?: string; sortOrder?: string; page?: string }) {
  return handleRequest(() => api.get<TurnoverReport>(`/inventory/reports/turnover?${query({ ...params, limit: 20 })}`))
}

export async function getStockHistory(variantId: string, params: { warehouseId?: string; dateFrom?: string; dateTo?: string; page?: string }) {
  return handleRequest(() => api.get<StockHistoryReport>(`/inventory/reports/variants/${variantId}/stock-history?${query({ ...params, limit: 100 })}`))
}
