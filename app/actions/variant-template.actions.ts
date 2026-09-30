"use server"

import { revalidatePath } from "next/cache"

import { handleRequest } from "@/lib/action-response"
import { api } from "@/lib/api"
import type {
  CreateVariantTemplateDto,
  UpdateVariantTemplateDto,
  VariantTemplate,
} from "@/types/variant-template.type"

const PAGE_PATH = "/products/variant-templates"

export async function getVariantTemplates() {
  return handleRequest(async () => {
    const res = await api.get<{ data: VariantTemplate[] }>("/variant-templates?limit=100")
    return res.data
  })
}

export async function createVariantTemplate(dto: CreateVariantTemplateDto) {
  const res = await handleRequest(async () => {
    const res = await api.post<{ data: VariantTemplate }>("/variant-templates", dto)
    return res.data
  })
  if (res.success) revalidatePath(PAGE_PATH)
  return res
}

export async function updateVariantTemplate(id: string, dto: UpdateVariantTemplateDto) {
  const res = await handleRequest(async () => {
    const res = await api.patch<{ data: VariantTemplate }>(`/variant-templates/${id}`, dto)
    return res.data
  })
  if (res.success) revalidatePath(PAGE_PATH)
  return res
}

export async function deleteVariantTemplate(id: string) {
  const res = await handleRequest(async () => {
    await api.delete(`/variant-templates/${id}`)
    return true
  })
  if (res.success) revalidatePath(PAGE_PATH)
  return res
}
