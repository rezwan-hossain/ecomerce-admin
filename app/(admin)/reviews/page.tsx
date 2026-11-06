import { connection } from "next/server"

import { getProducts } from "@/app/actions/product.actions"
import { getReviews } from "@/app/actions/review.actions"
import { PageHeader } from "@/components/page-header"
import { ReviewsManager } from "@/components/reviews/reviews-manager"

export default async function ReviewsPage() {
  await connection()

  const [reviews, products] = await Promise.all([getReviews(), getProducts()])
  // Reviews only name the product, so show each product's primary image beside it.
  const images: Record<string, string> = {}
  for (const p of products.success ? products.data : []) {
    const image = p.images.find((i) => i.isPrimary) ?? p.images[0]
    if (image) images[p.id] = image.url
  }

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <PageHeader title="Reviews" description="Approve what customers say before it shows in the store, and see which products they love or don't." />
      {reviews.success ? (
        <ReviewsManager reviews={reviews.data} images={images} />
      ) : (
        <p className="px-4 text-muted-foreground lg:px-6">Couldn’t load reviews: {reviews.error}</p>
      )}
    </div>
  )
}
