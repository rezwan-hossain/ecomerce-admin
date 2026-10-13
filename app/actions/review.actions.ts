"use server"

import { revalidatePath } from "next/cache"

import { handleRequest } from "@/lib/action-response"
import { api } from "@/lib/api"
import type { Review } from "@/types/review.type"

// Every status, newest first, so pending reviews show up too.
export async function getProductReviews(productId: string) {
  return handleRequest(async () => (await api.get<{ data: Review[] }>(`/reviews?productId=${productId}&limit=100`)).data)
}

// Every review of every product, 100 at a time.
export async function getReviews() {
  return handleRequest(async () => {
    const reviews: Review[] = []
    let page = 1
    let totalPages = 1
    while (page <= totalPages) {
      const res = await api.get<{ data: Review[]; meta: { totalPages: number } }>(`/reviews?limit=100&page=${page}`)
      reviews.push(...res.data)
      totalPages = res.meta.totalPages
      page++
    }
    return reviews
  })
}

// Approve or reject a review; only approved ones show in the store and count toward the rating.
export async function moderateReview(id: string, productId: string, status: "APPROVED" | "REJECTED") {
  const res = await handleRequest(() => api.patch(`/reviews/${id}/status`, { status }))
  if (res.success) {
    revalidatePath(`/products/${productId}`)
    revalidatePath("/products")
  }
  return res
}
