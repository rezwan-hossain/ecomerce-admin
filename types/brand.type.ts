export interface Brand {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  createdAt: string;
  updatedAt: string;
  _count: { products: number };
}

export interface CreateBrandDto {
  name: string;
  slug: string;
  logoUrl?: string; // "" means no logo; the backend rejects null
}

export interface UpdateBrandDto {
  name?: string;
  slug?: string;
  logoUrl?: string;
}
