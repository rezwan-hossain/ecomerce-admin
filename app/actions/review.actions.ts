"use server"

import { handleRequest } from "@/lib/action-response"
import { api } from "@/lib/api"
import type { Review } from "@/types/review.type"

// Every status, newest first, so pending reviews show up too.
export async function getProductReviews(productId: string) {
  return handleRequest(async () => (await api.get<{ data: Review[] }>(`/reviews?productId=${productId}&limit=100`)).data)
}
