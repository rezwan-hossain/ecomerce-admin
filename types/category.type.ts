/* ══════════════ response ══════════════ */

export interface Category {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  isActive: boolean;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryTree extends Category {
  children: CategoryTree[];
}

export interface CategoryListResponse {
  data: Category[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CategoryTreeResponse {
  data: CategoryTree[];
}

/* ══════════════ Mutation ══════════════ */

export interface CreateCategory {
  name: string;
  slug: string;
  parentId?: string | null;
  isActive?: boolean;
  position?: number;
}

export interface UpdateCategory {
  name?: string;
  slug?: string;
  parentId?: string | null;
  isActive?: boolean;
  position?: number;
}

export interface CategoryQuery {
  page?: number;
  limit?: number;
  search?: string;
  parentId?: string | "null";
  isActive?: boolean;
  includeTree?: boolean;
}

/**
 * Useful when passing query params directly from a Server Action,
 * where values may initially be strings.
 */
export interface CategoryQueryParams {
  page?: string | number;
  limit?: string | number;
  search?: string;
  parentId?: string;
  isActive?: string | boolean;
  includeTree?: string | boolean;
}
