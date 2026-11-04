"use server";

import { refresh as refreshOpenPage, revalidatePath } from "next/cache";

import { handleRequest } from "@/lib/action-response";
import { api, ApiError } from "@/lib/api";
import type {
  BookPathaoDto,
  PathaoStore,
  PathaoSyncResult,
} from "@/types/pathao.type";

export async function getPathaoStores() {
  return handleRequest(() => api.get<PathaoStore[]>("/courier/pathao/stores"));
}

// Like handleRequest, but also hands back the raw reply (or the raw error body)
// so the admin can see exactly what the API answered.
async function withApiReply<T>(fn: () => Promise<T>) {
  try {
    const data = await fn();
    return { success: true as const, data, reply: data as unknown };
  } catch (error) {
    if (error instanceof ApiError)
      return {
        success: false as const,
        error: error.message,
        reply: {
          statusCode: error.status,
          ...(error.details as object),
        } as unknown,
      };
    return {
      success: false as const,
      error: "Something went wrong",
      reply: null as unknown,
    };
  }
}

// Books the parcel at Pathao and saves it as a PATHAO shipment on the order.
export async function bookPathaoShipment(orderId: string, dto: BookPathaoDto) {
  const res = await withApiReply(() =>
    api.post(`/courier/pathao/orders/${orderId}/shipments`, dto),
  );
  if (res.success) refresh(orderId);
  return res;
}

// Pulls the parcel's latest status from Pathao and applies it to the shipment.
export async function syncPathaoShipment(orderId: string, shipmentId: string) {
  const res = await withApiReply(() =>
    api.post<PathaoSyncResult>(
      `/courier/pathao/shipments/${shipmentId}/sync`,
      {},
    ),
  );
  if (res.success) refresh(orderId);
  return res;
}

function refresh(orderId: string) {
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");
  revalidatePath("/orders/pending");
  revalidatePath("/shipping");
  // revalidatePath alone left the open order page showing old data after a booking; this re-fetches it now.
  refreshOpenPage()
}
