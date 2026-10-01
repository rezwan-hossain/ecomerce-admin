export type ProductStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";

// A row from GET /products. Decimals (price) come back as strings.
export interface Product {
  id: string;
  name: string;
  slug: string;
  status: ProductStatus;
  isActive: boolean;
  createdAt: string;
  brand: { id: string; name: string } | null;
  categories: { isPrimary: boolean; category: { id: string; name: string } }[];
  tags: { tag: { id: string; name: string } }[];
  images: { id: string; url: string; altText: string | null; isPrimary: boolean }[];
  variants: { id: string; sku: string; price: string; stock: number; isActive: boolean }[];
}
