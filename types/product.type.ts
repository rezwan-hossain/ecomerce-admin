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

// GET /products/:id. `options[].option.values` lists every value of the option, not only the used ones.
export interface ProductDetail extends Omit<Product, "images" | "variants"> {
  description: string | null;
  shortDescription: string | null;
  options: { option: { id: string; name: string; values: { id: string; value: string }[] } }[];
  images: { id: string; url: string; altText: string | null; isPrimary: boolean; position: number }[];
  variants: (Product["variants"][number] & {
    optionValues: { optionValue: { optionId: string; value: string } }[];
    images: { url: string }[];
  })[];
}

// What the edit page sends. Images are in display order; the first is primary.
// Variants without an id are new; saved variants missing from the list are deleted.
export interface ProductUpdate {
  name: string;
  slug: string;
  shortDescription: string;
  description: string;
  status: ProductStatus;
  isActive: boolean;
  brand: { id: string; name: string };
  categoryIds: string[]; // the first is the primary category
  tagIds: string[];
  images: { url: string; altText: string }[];
  variants: {
    id?: string;
    sku: string;
    price: number;
    stock: number;
    isActive: boolean;
    options: { optionId: string; value: string }[];
    imageUrl: string | null;
  }[];
}
