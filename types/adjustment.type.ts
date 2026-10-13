// Adjustment documents (/inventory/adjustments). Stock changes only on apply.
// The instant POST /inventory/adjustments used by the stock sheet is separate (inventory.type.ts).

export type AdjustmentType = "INCREASE" | "DECREASE" | "CYCLE_COUNT";
export type AdjustmentReason = "CYCLE_COUNT" | "DAMAGE" | "THEFT" | "LOSS" | "EXPIRY" | "CORRECTION" | "OPENING_STOCK" | "PROMOTIONAL" | "OTHER";
export type AdjustmentStatus = "PENDING" | "APPROVED" | "APPLIED" | "REJECTED" | "CANCELLED";
type UserRef = { id: string; name: string } | null;

// A row from GET /inventory/adjustments.
export interface AdjustmentListRow {
  id: string;
  adjustmentNumber: string; // "ADJ-2026-00042"
  type: AdjustmentType;
  reason: AdjustmentReason;
  status: AdjustmentStatus;
  note: string | null;
  createdBy: UserRef;
  approvedBy: UserRef;
  lineCount: number;
  createdAt: string;
  updatedAt: string;
  approvedAt: string | null;
  appliedAt: string | null;
}

export interface AdjustmentLine {
  id: string;
  variantId: string;
  warehouseId: string;
  locationId: string | null;
  variant: { id: string; sku: string; productName: string; label: string }; // label "Red / XL", "" without options
  warehouse: { id: string; code: string; name: string };
  location: { id: string; code: string } | null; // null = the whole warehouse
  expectedQty: number | null; // system count the server snapshotted (re-based on apply for counts)
  actualQty: number | null; // CYCLE_COUNT: what was counted
  adjustmentQty: number; // signed change
  unitCost: string | null;
  note: string | null;
  createdAt: string;
}

// GET /inventory/adjustments/:id
export interface Adjustment extends Omit<AdjustmentListRow, "lineCount"> {
  items: AdjustmentLine[];
}

// POST /inventory/adjustments/requests; PATCH takes reason, note and items (which replace every line).
export interface AdjustmentDto {
  type: AdjustmentType;
  reason: AdjustmentReason;
  note: string | null;
  items: {
    variantId: string;
    warehouseId: string;
    locationId: string | null;
    actualQty?: number; // CYCLE_COUNT
    adjustmentQty?: number; // INCREASE > 0, DECREASE < 0
  }[];
}
