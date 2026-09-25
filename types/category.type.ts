// types/category.type.ts

/* =========================================================
   RESPONSE TYPES
   ========================================================= */

/**
 * Parent category returned when creating/getting
 * a category with its parent.
 */
export interface CategoryParent {
  id: string;
  name: string;
  slug: string;
}

/**
 * A single category.
 */
export interface Category {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  isActive: boolean;
  position: number;
  createdAt: string;
  updatedAt: string;

  // Parent category is returned by some API endpoints.
  parent?: CategoryParent | null;
}

/**
 * Category with nested children.
 */
export interface CategoryTree extends Category {
  children: CategoryTree[];
}

/* =========================================================
   API RESPONSE TYPES
   ========================================================= */

/**
 * Standard response when creating a category.
 *
 * Example:
 *
 * {
 *   message: "Category created successfully",
 *   data: { ... }
 * }
 */
export interface CreateCategoryResponse {
  message: string;
  data: Category;
}

/**
 * Response when getting a paginated list of categories.
 */
export interface CategoryListResponse {
  message?: string;

  data: Category[];

  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Response when getting the category tree.
 */
export interface CategoryTreeResponse {
  message?: string;
  data: CategoryTree[];
}

/* =========================================================
   MUTATION TYPES
   ========================================================= */

/**
 * Data required to create a category.
 */
export interface CreateCategory {
  name: string;
  slug: string;
  parentId?: string | null;
  isActive?: boolean;
  position?: number;
}

/**
 * Data used to update a category.
 *
 * All fields are optional because we can update
 * only one property.
 */
export interface UpdateCategory {
  name?: string;
  slug?: string;
  parentId?: string | null;
  isActive?: boolean;
  position?: number;
}

/* =========================================================
   QUERY TYPES
   ========================================================= */

/**
 * Query parameters for getting categories.
 */
export interface CategoryQuery {
  page?: number;
  limit?: number;
  search?: string;
  parentId?: string | "null";
  isActive?: boolean;
  includeTree?: boolean;
}

/**
 * Query parameters when values come from
 * URL / FormData / Server Actions.
 *
 * URL values are normally strings.
 */
export interface CategoryQueryParams {
  page?: string | number;
  limit?: string | number;
  search?: string;
  parentId?: string;
  isActive?: string | boolean;
  includeTree?: string | boolean;
}
