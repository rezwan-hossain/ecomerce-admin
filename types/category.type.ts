export interface CategoryCount {
  products: number
  children?: number // the deepest level of /categories/tree has no children count
}

export interface Category {
  id: string
  name: string
  slug: string
  isActive: boolean
  position: number
  parentId: string | null
  createdAt: string
  updatedAt: string
  _count: CategoryCount
  children?: Category[]
}

export interface CreateCategoryDto {
  name: string
  slug: string
  parentId: string | null
  isActive: boolean
  position?: number
}

export interface UpdateCategoryDto {
  name?: string
  slug?: string
  parentId?: string | null
  isActive?: boolean
  position?: number
}

// Matches the backend's MoveCategoryDto.
export interface MoveCategoryDto {
  newParentId: string | null
  position: number
}
