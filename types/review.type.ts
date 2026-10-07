export type ReviewStatus = "PENDING" | "APPROVED" | "REJECTED";

// A row from GET /reviews (the admin list, every status).
export interface Review {
  id: string;
  productId: string;
  rating: number; // 1-5
  title: string | null;
  body: string | null;
  status: ReviewStatus;
  isVerifiedPurchase: boolean;
  createdAt: string;
  user: { id: string; firstName: string | null; lastName: string | null; image: string | null } | null;
}
