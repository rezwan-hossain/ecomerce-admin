export interface Tag {
  id: string
  name: string
  slug: string
  createdAt: string
  updatedAt: string
  _count: { products: number } // included in GET /tags, not in create/update responses
}

export interface CreateTagDto {
  name: string
  slug: string
}

export interface UpdateTagDto {
  name?: string
  slug?: string
}
