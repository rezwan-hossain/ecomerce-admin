export interface Tag {
  id: string
  name: string
  slug: string
  createdAt: string
  updatedAt: string
}

export interface CreateTagDto {
  name: string
  slug: string
}

export interface UpdateTagDto {
  name?: string
  slug?: string
}
