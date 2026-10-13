"use server"

import { revalidatePath } from "next/cache"

import { handleRequest } from "@/lib/action-response"
import { api } from "@/lib/api"
import type { PurchaseOrder, PurchaseOrderDto, PurchaseOrderListRow, ReceivePurchaseOrderDto } from "@/types/purchase-order.type"

type Page<T> = { data: T[]; meta: { totalPages: number } }

// Submitting, receiving, cancelling and closing all change incoming or on-hand stock.
function refresh() {
  revalidatePath("/inventory/purchase-orders")
  revalidatePath("/inventory/stock")
  revalidatePath("/inventory/products")
}

// Newest first, 100 at a time until there are no more.
export async function getPurchaseOrders() {
  return handleRequest(async () => {
    const rows: PurchaseOrderListRow[] = []
    let page = 1
    let totalPages = 1
    while (page <= totalPages) {
      const res = await api.get<Page<PurchaseOrderListRow>>(`/purchase-orders?limit=100&page=${page}`)
      rows.push(...res.data)
      totalPages = res.meta.totalPages
      page++
    }
    return rows
  })
}

export async function getPurchaseOrder(id: string) {
  return handleRequest(async () => (await api.get<{ data: PurchaseOrder }>(`/purchase-orders/${id}`)).data)
}

export async function createPurchaseOrder(dto: PurchaseOrderDto) {
  const res = await handleRequest(async () => (await api.post<{ data: PurchaseOrder }>("/purchase-orders", dto)).data)
  if (res.success) refresh()
  return res
}

export async function updatePurchaseOrder(id: string, dto: Partial<PurchaseOrderDto>) {
  const res = await handleRequest(async () => (await api.patch<{ data: PurchaseOrder }>(`/purchase-orders/${id}`, dto)).data)
  if (res.success) refresh()
  return res
}

export async function deletePurchaseOrder(id: string) {
  const res = await handleRequest(() => api.delete(`/purchase-orders/${id}`))
  if (res.success) refresh()
  return res
}

// submit: DRAFT → SUBMITTED (adds to incoming). confirm: the supplier acknowledged it.
// cancel: before anything arrives. close: after receipts, cancels what's still outstanding.
export async function purchaseOrderAction(id: string, action: "submit" | "confirm" | "cancel" | "close") {
  const res = await handleRequest(async () => (await api.post<{ data: PurchaseOrder }>(`/purchase-orders/${id}/${action}`, {})).data)
  if (res.success) refresh()
  return res
}

// All or nothing: if one line fails, nothing is booked.
export async function receivePurchaseOrder(id: string, dto: ReceivePurchaseOrderDto) {
  const res = await handleRequest(async () => (await api.post<{ data: PurchaseOrder }>(`/purchase-orders/${id}/receive`, dto)).data)
  if (res.success) refresh()
  return res
}
