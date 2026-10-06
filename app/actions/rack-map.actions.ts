"use server"

import { revalidatePath } from "next/cache"

import { handleRequest } from "@/lib/action-response"
import { api } from "@/lib/api"
import type {
  Box,
  CreateRackDto,
  Face,
  FloorItem,
  FloorPlan,
  LocationContents,
  LocationMoveDto,
  PickRoute,
  Placement,
  PutAwayLine,
} from "@/types/rack-map.type"

// The rack map endpoints answer without the usual { data } wrapper.

export async function getFloorPlan(warehouseId: string, activityDays = 30) {
  return handleRequest(() => api.get<FloorPlan>(`/inventory/warehouses/${warehouseId}/floor-plan?activityDays=${activityDays}`))
}

export async function getPutAway(warehouseId: string) {
  return handleRequest(async () => (await api.get<{ lines: PutAwayLine[] }>(`/inventory/warehouses/${warehouseId}/put-away`)).lines)
}

// Orders with stock held at this warehouse, for the pick route picker.
export async function getPickOrders(warehouseId: string) {
  return handleRequest(
    async () => (await api.get<{ orders: { orderId: string; lines: number }[] }>(`/inventory/warehouses/${warehouseId}/pick-route`)).orders
  )
}

export async function getPickRoute(warehouseId: string, orderId: string) {
  return handleRequest(() => api.get<PickRoute>(`/inventory/warehouses/${warehouseId}/pick-route?orderId=${orderId}`))
}

export async function getLocationContents(locationId: string) {
  return handleRequest(() => api.get<LocationContents>(`/inventory/locations/${locationId}/contents`))
}

/* ---------- Layout (never changes stock) ---------- */

export async function setFloorSize(warehouseId: string, floorWidth: number, floorDepth: number) {
  return handleRequest(() => api.put(`/inventory/warehouses/${warehouseId}/floor-size`, { floorWidth, floorDepth }))
}

export async function setPlacement(locationId: string, body: Placement | { remove: true }) {
  return handleRequest(() => api.patch<{ placement: Placement | null; box: Box | null }>(`/inventory/locations/${locationId}/placement`, body))
}

// `shifted` means the turned rack collided, so the server moved it to the nearest free spot.
export async function rotateLocation(locationId: string, direction: "cw" | "ccw" | "180") {
  return handleRequest(() =>
    api.post<{ placement: Placement; box: Box; pickFace: Face | null; shifted: boolean }>(`/inventory/locations/${locationId}/rotate`, {
      direction,
    })
  )
}

export async function createRack(warehouseId: string, dto: CreateRackDto) {
  return handleRequest(() => api.post<FloorItem>(`/inventory/warehouses/${warehouseId}/racks`, dto))
}

// A location with history is switched off instead of deleted.
export async function removeLocation(locationId: string) {
  return handleRequest(() => api.delete<{ message: string; result: "deleted" | "deactivated" }>(`/inventory/locations/${locationId}`))
}

export async function updateLocationFlags(locationId: string, dto: { isPickable?: boolean; isActive?: boolean; name?: string | null }) {
  return handleRequest(() => api.patch(`/inventory/locations/${locationId}`, dto))
}

/* ---------- Stock (writes ledger rows) ---------- */

export async function moveFromLocation(fromLocationId: string, dto: LocationMoveDto) {
  const res = await handleRequest(() =>
    api.post<{ movementId: string; from: { locationId: string; quantity: number }; to: { locationId: string; quantity: number } }>(
      `/inventory/locations/${fromLocationId}/moves`,
      dto
    )
  )
  if (res.success) revalidatePath("/inventory/stock")
  return res
}

// `adjustment` is null when the count matched. Without a signed-in admin the API keeps it PENDING.
export async function countLocation(locationId: string, lines: { inventoryLevelId: string; countedQty: number }[], applyNow: boolean) {
  const res = await handleRequest(() =>
    api.post<{ adjustment: { id: string; adjustmentNumber: string; status: string } | null }>(`/inventory/locations/${locationId}/counts`, {
      lines,
      applyNow,
    })
  )
  if (res.success) revalidatePath("/inventory/stock")
  return res
}
