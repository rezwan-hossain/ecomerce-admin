// The purchase orders API (/purchase-orders). Money arrives as decimal strings; send numbers back.

export type PoStatus = "DRAFT" | "SUBMITTED" | "CONFIRMED" | "PARTIAL" | "RECEIVED" | "CANCELLED" | "CLOSED";
export type PoLineStatus = "PENDING" | "PARTIAL" | "RECEIVED" | "CANCELLED";
type UserRef = { id: string; name: string } | null;

// A row from GET /purchase-orders.
export interface PurchaseOrderListRow {
  id: string;
  poNumber: string; // "PO-2026-00042"
  status: PoStatus;
  supplierId: string;
  supplier: { id: string; code: string; name: string };
  currency: string;
  subtotalAmount: string;
  taxAmount: string;
  shippingAmount: string;
  totalAmount: string;
  orderedAt: string | null; // set on submit
  expectedAt: string | null;
  receivedAt: string | null; // set when fully received
  cancelledAt: string | null;
  note: string | null;
  metadata: unknown | null;
  createdBy: UserRef;
  lineCount: number;
  orderedUnits: number;
  receivedUnits: number;
  damagedUnits: number;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseOrderLine {
  id: string; // sent as itemId when receiving
  variantId: string;
  warehouseId: string;
  variant: { id: string; sku: string; productName: string; label: string }; // label "Red / XL", "" without options
  warehouse: { id: string; code: string; name: string };
  orderedQty: number;
  receivedQty: number; // good units booked into stock
  damagedQty: number; // refused at the dock
  outstandingQty: number; // still expected; 0 once cancelled
  unitCost: string;
  totalCost: string;
  status: PoLineStatus;
  note: string | null;
}

// GET /purchase-orders/:id
export interface PurchaseOrder extends Omit<PurchaseOrderListRow, "lineCount" | "orderedUnits" | "receivedUnits" | "damagedUnits"> {
  approvedBy: UserRef; // set on confirm
  items: PurchaseOrderLine[];
}

// POST creates a draft; PATCH takes any subset, and `items` replaces every line.
export interface PurchaseOrderDto {
  supplierId: string;
  expectedAt: string | null;
  note: string | null;
  taxAmount: number;
  shippingAmount: number;
  items: { variantId: string; warehouseId?: string; orderedQty: number; unitCost: number }[];
}

export interface ReceivePurchaseOrderDto {
  reference?: string; // supplier invoice or delivery note
  note?: string;
  lines: {
    itemId: string;
    quantity: number; // good units into stock
    damagedQty?: number; // refused at the dock
    batchNumber?: string;
    expiresAt?: string;
    locationId?: string; // put-away rack; omitted = the default rack
  }[];
}
