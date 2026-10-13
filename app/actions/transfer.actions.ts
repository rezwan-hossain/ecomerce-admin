"use server"

import { revalidatePath } from "next/cache"

import { handleRequest } from "@/lib/action-response"
import { api, ApiError } from "@/lib/api"
import type { ReceiveTransferDto, ShortLine, Transfer, TransferDto, TransferListRow } from "@/types/transfer.type"

type Page<T> = { data: T[]; meta: { totalPages: number } }

function refresh(stockChanged = false) {
  revalidatePath("/inventory/transfers")
  if (!stockChanged) return
  revalidatePath("/inventory/stock")
  revalidatePath("/inventory/movements")
  revalidatePath("/inventory/products")
}

// Newest first, 100 at a time until there are no more.
export async function getTransfers() {
  return handleRequest(async () => {
    const rows: TransferListRow[] = []
    let page = 1
    let totalPages = 1
    while (page <= totalPages) {
      const res = await api.get<Page<TransferListRow>>(`/inventory/transfers?limit=100&page=${page}`)
      rows.push(...res.data)
      totalPages = res.meta.totalPages
      page++
    }
    return rows
  })
}

export async function getTransfer(id: string) {
  return handleRequest(async () => (await api.get<{ data: Transfer }>(`/inventory/transfers/${id}`)).data)
}

export async function createTransfer(dto: TransferDto) {
  const res = await handleRequest(async () => (await api.post<{ data: Transfer }>("/inventory/transfers", dto)).data)
  if (res.success) refresh()
  return res
}

export async function updateTransfer(id: string, dto: TransferDto) {
  const res = await handleRequest(async () => (await api.patch<{ data: Transfer }>(`/inventory/transfers/${id}`, dto)).data)
  if (res.success) refresh()
  return res
}

export async function deleteTransfer(id: string) {
  const res = await handleRequest(() => api.delete(`/inventory/transfers/${id}`))
  if (res.success) refresh()
  return res
}

// approve: DRAFT → PENDING. cancel: only before shipping.
export async function transferAction(id: string, action: "approve" | "cancel") {
  const res = await handleRequest(async () => (await api.post<{ data: Transfer }>(`/inventory/transfers/${id}/${action}`, {})).data)
  if (res.success) refresh()
  return res
}

// Every line ships in full or nothing does; a shortfall answers 409 with the short lines.
export async function shipTransfer(id: string): Promise<{ success: true; data: Transfer } | { success: false; error: string; shortLines: ShortLine[] }> {
  try {
    const res = await api.post<{ data: Transfer }>(`/inventory/transfers/${id}/ship`, {})
    refresh(true)
    return { success: true, data: res.data }
  } catch (error) {
    if (!(error instanceof ApiError)) return { success: false, error: "Something went wrong", shortLines: [] }
    const shortLines = (error.details as { shortLines?: ShortLine[] } | null)?.shortLines ?? []
    return { success: false, error: error.message, shortLines }
  }
}

// All or nothing; partial receipts leave the transfer PARTIAL.
export async function receiveTransfer(id: string, dto: ReceiveTransferDto) {
  const res = await handleRequest(async () => (await api.post<{ data: Transfer }>(`/inventory/transfers/${id}/receive`, dto)).data)
  if (res.success) refresh(true)
  return res
}
