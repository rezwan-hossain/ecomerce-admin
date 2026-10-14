// Warehouse-to-warehouse transfers (/inventory/transfers). Line unitCost is a decimal string, set at ship time.

export type TransferStatus = "DRAFT" | "PENDING" | "IN_TRANSIT" | "PARTIAL" | "COMPLETED" | "CANCELLED";
type UserRef = { id: string; name: string } | null;
type WarehouseRef = { id: string; code: string; name: string };

// A row from GET /inventory/transfers.
export interface TransferListRow {
  id: string;
  transferNumber: string; // "TRF-2026-00012"
  status: TransferStatus;
  fromWarehouseId: string;
  toWarehouseId: string;
  fromWarehouse: WarehouseRef;
  toWarehouse: WarehouseRef;
  initiatedBy: UserRef;
  shippedAt: string | null;
  receivedAt: string | null; // set when COMPLETED
  cancelledAt: string | null;
  note: string | null;
  lineCount: number;
  requestedUnits: number;
  receivedUnits: number;
  damagedUnits: number;
  createdAt: string;
  updatedAt: string;
}

export interface TransferLine {
  id: string; // sent as itemId when receiving
  variantId: string;
  variant: { id: string; sku: string; productName: string; label: string }; // label "Red / XL", "" without options
  requestedQty: number;
  shippedQty: number; // 0 until shipped, then the full requested quantity
  receivedQty: number; // good units booked at the destination
  damagedQty: number; // arrived damaged, kept in the destination's damaged bucket
  outstandingQty: number; // still on the road; 0 before shipping
  unitCost: string | null; // the source's average cost, frozen at ship time
  note: string | null;
  // Once shipped: which batches left the source (the destination gets the same lot and expiry).
  batches?: { batchId: string; batchNumber: string; expiresAt: string | null; quantity: number; received: number }[];
}

// GET /inventory/transfers/:id
export interface Transfer extends Omit<TransferListRow, "lineCount" | "requestedUnits" | "receivedUnits" | "damagedUnits"> {
  receivedBy: UserRef;
  items: TransferLine[];
}

// POST creates a draft; PATCH (DRAFT only) takes any subset, and `items` replaces every line.
export interface TransferDto {
  fromWarehouseId: string;
  toWarehouseId: string;
  note: string | null;
  items: { variantId: string; quantity: number }[];
}

export interface ReceiveTransferDto {
  lines: { itemId: string; receivedQty: number; damagedQty?: number; locationId?: string }[];
}

// The 409 body when a ship is short: nothing ships until every line can.
export type ShortLine = { variantId: string; sku: string; wanted: number; available: number };
