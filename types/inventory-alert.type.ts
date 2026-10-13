// Inventory alerts (/inventory/alerts). The server raises and resolves them; staff acknowledge, resolve or dismiss.

export type AlertType = "LOW_STOCK" | "OUT_OF_STOCK" | "EXPIRING_SOON" | "OVERSTOCK" | "NEGATIVE_STOCK" | "REORDER_TRIGGERED";
export type AlertStatus = "ACTIVE" | "ACKNOWLEDGED" | "RESOLVED" | "DISMISSED";

export interface InventoryAlert {
  id: string;
  type: AlertType;
  status: AlertStatus;
  title: string; // "SKU-1 is low on stock"
  message: string | null; // "3 sellable units left (threshold 5)."
  currentStock: number; // kept up to date while the alert is open
  threshold: number | null; // low-stock threshold, reorder point or expiry window in days
  variantId: string;
  warehouseId: string | null; // null = store-wide
  variant: { id: string; sku: string; productName: string; label: string };
  warehouse: { id: string; code: string; name: string } | null;
  // Reorder-rule alerts: { reorderRuleId, reorderPoint, reorderQty, incoming }.
  // EXPIRING_SOON: { batches: [{ id, batchNumber, quantity, expiresAt, expired }] }, earliest first.
  metadata: {
    reorderPoint?: number;
    reorderQty?: number;
    incoming?: number;
    batches?: { id: string; batchNumber: string; quantity: number; expiresAt: string; expired: boolean }[];
  } | null;
  acknowledgedBy: { id: string; name: string } | null;
  acknowledgedAt: string | null;
  resolvedAt: string | null; // RESOLVED: when; DISMISSED: when the condition cleared
  createdAt: string; // when it was raised
  updatedAt: string;
}

export interface AlertSummary {
  open: number; // active + acknowledged
  active: number;
  acknowledged: number;
  byType: Partial<Record<AlertType, number>>; // open alerts per type
}
