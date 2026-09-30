"use server"

import { revalidatePath } from "next/cache"

import { handleRequest } from "@/lib/action-response"
import { api } from "@/lib/api"
import type {
  CreateOptionDto,
  CreateOptionValueDto,
  Option,
  OptionValue,
  UpdateOptionDto,
  UpdateOptionValueDto,
} from "@/types/option.type"

const PAGE_PATH = "/products/options"

export async function getOptions() {
  return handleRequest(async () => {
    const res = await api.get<{ data: Option[] }>("/options?limit=100")
    return res.data
  })
}

export async function createOption(dto: CreateOptionDto) {
  const res = await handleRequest(async () => {
    const res = await api.post<{ data: Option }>("/options", dto)
    return res.data
  })
  if (res.success) revalidatePath(PAGE_PATH)
  return res
}

export async function updateOption(id: string, dto: UpdateOptionDto) {
  const res = await handleRequest(async () => {
    const res = await api.patch<{ data: Option }>(`/options/${id}`, dto)
    return res.data
  })
  if (res.success) revalidatePath(PAGE_PATH)
  return res
}

export async function deleteOption(id: string) {
  const res = await handleRequest(async () => {
    await api.delete(`/options/${id}`)
    return true
  })
  if (res.success) revalidatePath(PAGE_PATH)
  return res
}

export async function addOptionValue(optionId: string, dto: CreateOptionValueDto) {
  const res = await handleRequest(async () => {
    const res = await api.post<{ data: OptionValue }>(`/options/${optionId}/values`, dto)
    return res.data
  })
  if (res.success) revalidatePath(PAGE_PATH)
  return res
}

export async function updateOptionValue(
  optionId: string,
  valueId: string,
  dto: UpdateOptionValueDto
) {
  const res = await handleRequest(async () => {
    const res = await api.patch<{ data: OptionValue }>(
      `/options/${optionId}/values/${valueId}`,
      dto
    )
    return res.data
  })
  if (res.success) revalidatePath(PAGE_PATH)
  return res
}

export async function deleteOptionValue(optionId: string, valueId: string) {
  const res = await handleRequest(async () => {
    await api.delete(`/options/${optionId}/values/${valueId}`)
    return true
  })
  if (res.success) revalidatePath(PAGE_PATH)
  return res
}
