"use server"

import { revalidatePath } from "next/cache"

import type { ActionResponse } from "@/lib/action-response"
import { api, ApiError } from "@/lib/api"
import type { CreateCustomerBody, CustomerAccount } from "@/types/customer.type"

// POST /users isn't in the backend yet; until it is, a 404 here means "not built", not "not found".
export async function createCustomer(body: CreateCustomerBody): Promise<ActionResponse<CustomerAccount>> {
  try {
    const res = await api.post<{ data: CustomerAccount }>("/users", body)
    revalidatePath("/customers")
    return { success: true, data: res.data }
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return { success: false, error: "Adding customers isn't available yet: the backend has no POST /users endpoint." }
    }
    if (error instanceof ApiError) return { success: false, error: error.message, fieldErrors: error.fieldErrors }
    return { success: false, error: "Something went wrong" }
  }
}
