// Inventory batches (lots), /inventory/batches. Expiry belongs to a batch, not to a product.

export type BatchStatus = "AVAILABLE" | "DEPLETED" | "EXPIRED" | "QUARANTINED" | "RECALLED";
export type ExpiryState = "NO_EXPIRY" | "EXPIRED" | "EXPIRING_SOON" | "OK";
type UserRef = { id: string; name: string } | null;

export interface Batch {
  id: string;
  batchNumber: string; // supplier lot, or a generated "RCV-…"
  barcode: string | null;
  status: BatchStatus;
  quantity: number; // units left, all racks
  initialQty: number; // received into this warehouse
  unitCost: string | null;
  manufacturedAt: string | null;
  expiresAt: string | null;
  receivedAt: string | null;
  note: string | null;
  metadata: { quarantinedFromBatchId?: string; quarantineBatchId?: string } | null;
  variantId: string;
  warehouseId: string;
  variant: { id: string; sku: string; productName: string; label: string };
  warehouse: { id: string; code: string; name: string; type: string };
  supplier: { id: string; code: string; name: string } | null;
  purchaseOrder: { id: string; poNumber: string } | null;
  locations: { locationId: string; code: string; quantity: number }[]; // racks holding it
  expiry: { state: ExpiryState; daysLeft: number | null }; // "expiring soon" = within 30 days
  createdAt: string;
  updatedAt: string;
}

export interface BatchDetail extends Batch {
  movements: {
    id: string;
    createdAt: string;
    type: string;
    direction: "IN" | "OUT" | "INTERNAL";
    quantity: number;
    onHandBefore: number;
    onHandAfter: number;
    fromLocation: { id: string; code: string } | null;
    toLocation: { id: string; code: string } | null;
    referenceType: string | null;
    referenceId: string | null;
    note: string | null;
    unitCost: string | null;
    totalCost: string | null;
    performedBy: UserRef;
  }[]; // oldest first
  related: { id: string; status: BatchStatus; quantity: number; warehouse: { id: string; code: string; name: string } }[]; // same lot elsewhere
}

export type WriteOffReason = "EXPIRED" | "RECALLED" | "DAMAGED" | "OTHER";
