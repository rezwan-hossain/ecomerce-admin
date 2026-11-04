"use server"

import { refresh as refreshOpenPage, revalidatePath } from "next/cache"

import { handleRequest } from "@/lib/action-response"
import { api } from "@/lib/api"
import type { Order, OrderAddress, OrderAddressBody, OrderDetail, OrderStatus, ReceiveReturnedItemsBody, ShipmentDto, ShipmentStatus } from "@/types/order.type"

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

// The list rows have no addresses, so read each order's shipping address from its detail.
export async function getShippingAddresses(ids: string[]) {
  const details = await Promise.all(ids.map((id) => getOrder(id)))
  const addresses: Record<string, OrderAddress> = {}
  for (const d of details) {
    if (!d.success) continue
    const address = d.data.addresses.find((a) => a.type === "SHIPPING")
    if (address) addresses[d.data.id] = address
  }
  return addresses
}

// Every write changes the order page, the lists and (ship, cancel) stock.
function refresh(id: string) {
  revalidatePath(`/orders/${id}`)
  revalidatePath("/orders")
  revalidatePath("/orders/pending")
  revalidatePath("/shipping")
  // revalidatePath alone left the open order page showing old data after a booking; this re-fetches it now.
  refreshOpenPage()
}

export async function updateOrderStatus(id: string, status: OrderStatus, note?: string) {
  const res = await handleRequest(() => api.patch(`/orders/${id}/status`, { status, note }))
  if (res.success) refresh(id)
  return res
}

// Allowed until the order ships. Send only the fields that changed.
export async function updateOrderAddress(id: string, type: "SHIPPING" | "BILLING", dto: Partial<OrderAddressBody>) {
  const res = await handleRequest(() => api.patch(`/orders/${id}/addresses/${type}`, dto))
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

// Puts returned units back into stock (damaged ones into the damage section). Answers with the whole order.
export async function receiveReturnedItems(id: string, body: ReceiveReturnedItemsBody) {
  const res = await handleRequest(async () => (await api.post<{ data: OrderDetail }>(`/orders/${id}/returns`, body)).data)
  if (res.success) {
    revalidatePath("/inventory", "layout")
    refresh(id)
  }
  return res
}
