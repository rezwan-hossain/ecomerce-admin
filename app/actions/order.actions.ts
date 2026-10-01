"use server"

import { handleRequest } from "@/lib/action-response"
import { api } from "@/lib/api"
import type { Order } from "@/types/order.type"

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
