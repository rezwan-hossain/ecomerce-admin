import type { ShipmentStatus } from "./order.type";

// The Pathao courier API (docs/api/pathao-courier.md in the backend). Pathao's own
// shapes are snake_case and come back without a { data } wrapper.

export interface PathaoStore {
  store_id: number;
  store_name: string;
  store_address: string;
  is_active: number; // 1 = active
  city_id: number;
  zone_id: number;
  is_default_store: boolean | number;
}

export type PathaoDeliveryType = "NORMAL" | "ON_DEMAND";
export type PathaoItemType = "PARCEL" | "DOCUMENT";

// Every field is optional: the store defaults to PATHAO_STORE_ID, quantity to the
// order's units and the cash to collect to what's still due. Pathao works out the
// city, zone and area from the address text.
export interface BookPathaoDto {
  storeId?: number;
  deliveryType: PathaoDeliveryType;
  itemType: PathaoItemType;
  itemWeight: number; // kg, 0.5 – 10
  itemQuantity?: number;
  itemDescription?: string;
  specialInstruction?: string;
  amountToCollect?: number; // whole taka
}

// `updated: false` when Pathao's status needs no change on our side.
export interface PathaoSyncResult {
  pathaoStatus: string;
  updated: boolean;
  status: ShipmentStatus;
}
