"use server"

import { revalidatePath } from "next/cache"

import { handleRequest } from "@/lib/action-response"
import { api } from "@/lib/api"
import type { CreateTagDto, Tag, UpdateTagDto } from "@/types/tag.type"

const PAGE_PATH = "/products/tags"

export async function getTags() {
  return handleRequest(async () => {
    const res = await api.get<{ data: Tag[] }>("/tags?limit=100")
    return res.data
  })
}

export async function createTag(dto: CreateTagDto) {
  const res = await handleRequest(async () => {
    const res = await api.post<{ data: Tag }>("/tags", dto)
    return res.data
  })
  if (res.success) revalidatePath(PAGE_PATH)
  return res
}

export async function updateTag(id: string, dto: UpdateTagDto) {
  const res = await handleRequest(async () => {
    const res = await api.patch<{ data: Tag }>(`/tags/${id}`, dto)
    return res.data
  })
  if (res.success) revalidatePath(PAGE_PATH)
  return res
}

export async function deleteTag(id: string) {
  const res = await handleRequest(async () => {
    await api.delete(`/tags/${id}`)
    return true
  })
  if (res.success) revalidatePath(PAGE_PATH)
  return res
}
