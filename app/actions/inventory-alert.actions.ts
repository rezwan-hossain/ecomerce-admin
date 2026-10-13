"use server"

import { revalidatePath } from "next/cache"

import { handleRequest } from "@/lib/action-response"
import { api } from "@/lib/api"
import type { AlertStatus, AlertSummary, InventoryAlert } from "@/types/inventory-alert.type"

type Page<T> = { data: T[]; meta: { totalPages: number } }

// The alerts page and the badge on the inventory tabs.
function refresh() {
  revalidatePath("/inventory", "layout")
}

// Newest first, 100 at a time. OPEN = active and acknowledged; no status = every alert.
export async function getAlerts(status: AlertStatus | "OPEN" | null) {
  return handleRequest(async () => {
    const rows: InventoryAlert[] = []
    let page = 1
    let totalPages = 1
    while (page <= totalPages) {
      const filter = status ? `&status=${status}` : ""
      const res = await api.get<Page<InventoryAlert>>(`/inventory/alerts?limit=100&page=${page}${filter}`)
      rows.push(...res.data)
      totalPages = res.meta.totalPages
      page++
    }
    return rows
  })
}

export async function getAlertSummary() {
  return handleRequest(async () => (await api.get<{ data: AlertSummary }>("/inventory/alerts/summary")).data)
}

// acknowledge: "I'm on it", it stays open. resolve: close it now. dismiss: hide it until the condition clears and returns.
export async function alertAction(id: string, action: "acknowledge" | "resolve" | "dismiss") {
  const res = await handleRequest(async () => (await api.post<{ data: InventoryAlert }>(`/inventory/alerts/${id}/${action}`, {})).data)
  if (res.success) refresh()
  return res
}

// Re-checks every variant; slow on a big catalogue.
export async function scanAlerts() {
  const res = await handleRequest(async () =>
    (await api.post<{ data: { variantsChecked: number; created: number; updated: number; resolved: number } }>("/inventory/alerts/scan", {})).data
  )
  if (res.success) refresh()
  return res
}
