export type ReviewStatus = "PENDING" | "APPROVED" | "REJECTED";

// A row from GET /reviews (the admin list, every status).
export interface Review {
  id: string;
  productId: string;
  userId: string | null;
  rating: number; // 1-5
  title: string | null;
  body: string | null;
  status: ReviewStatus;
  isVerifiedPurchase: boolean;
  createdAt: string;
  updatedAt: string;
  user: { id: string; firstName: string | null; lastName: string | null; image: string | null; email?: string } | null;
  product?: { id: string; name: string; slug: string };
}
