"use server"

import { revalidatePath } from "next/cache"

import { handleRequest } from "@/lib/action-response"
import { api } from "@/lib/api"
import type { Order, OrderDetail, OrderStatus, ShipmentDto, ShipmentStatus } from "@/types/order.type"

// The API returns at most 100 per page, so walk the pages until there are no more.
export async function getOrders() {
  return handleRequest(async () => {
    const orders: Order[] = []
    let page = 1
    let totalPages = 1
    while (page <= totalPages) {
      const res = await api.get<{ data: Order[]; meta: { totalPages: number } }>(
        `/orders?limit=100&page=${page}&sortBy=createdAt&sortOrder=desc`
      )
      orders.push(...res.data)
      totalPages = res.meta.totalPages
      page++
    }
    return orders
  })
}

export async function getOrder(id: string) {
  return handleRequest(async () => (await api.get<{ data: OrderDetail }>(`/orders/${id}`)).data)
}

// Every write changes the order page, the lists and (ship, cancel) stock.
function refresh(id: string) {
  revalidatePath(`/orders/${id}`)
  revalidatePath("/orders")
  revalidatePath("/orders/pending")
  revalidatePath("/shipping")
}

export async function updateOrderStatus(id: string, status: OrderStatus, note?: string) {
  const res = await handleRequest(() => api.patch(`/orders/${id}/status`, { status, note }))
  if (res.success) refresh(id)
  return res
}

export async function cancelOrder(id: string, reason: string) {
  const res = await handleRequest(() => api.patch(`/orders/${id}/cancel`, { reason }))
  if (res.success) refresh(id)
  return res
}

export async function markPaymentPaid(id: string, paymentId: string, transactionId?: string) {
  const res = await handleRequest(() => api.patch(`/orders/${id}/payments/${paymentId}/paid`, { transactionId }))
  if (res.success) refresh(id)
  return res
}

export async function markPaymentFailed(id: string, paymentId: string, failureMessage?: string) {
  const res = await handleRequest(() => api.patch(`/orders/${id}/payments/${paymentId}/failed`, { failureMessage }))
  if (res.success) refresh(id)
  return res
}

export async function createShipment(id: string, dto: ShipmentDto) {
  const res = await handleRequest(() => api.post(`/orders/${id}/shipments`, dto))
  if (res.success) refresh(id)
  return res
}

export async function updateShipmentStatus(id: string, shipmentId: string, status: ShipmentStatus) {
  const res = await handleRequest(() => api.patch(`/orders/${id}/shipments/${shipmentId}`, { status }))
  if (res.success) refresh(id)
  return res
}

export async function createRefundRequest(id: string, amount: number, reason: string) {
  const res = await handleRequest(() => api.post(`/orders/${id}/refund-requests`, { amount, reason }))
  if (res.success) refresh(id)
  return res
}

// approve/reject a PENDING request; process an APPROVED one (marks the payment refunded).
export async function reviewRefund(orderId: string, refundId: string, action: "approve" | "reject" | "process", adminNote?: string) {
  const res = await handleRequest(() => api.patch(`/orders/refund-requests/${refundId}/${action}`, { adminNote }))
  if (res.success) refresh(orderId)
  return res
}
