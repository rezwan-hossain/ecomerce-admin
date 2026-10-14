// The damage section (/inventory/damaged-stock): units marked damaged, held in each warehouse's DAMAGE location.

export type DamagedStockRow = {
  id: string;
  inventoryLevelId: string;
  warehouseId: string;
  warehouseCode: string;
  locationId: string;
  locationCode: string; // always "DAMAGE"
  variantId: string;
  sku: string;
  productName: string;
  variantLabel: string | null;
  batchId: string | null;
  batchNumber: string | null;
  expiresAt: string | null;
  quantity: number;
  unitCost: string; // weighted average of the damaged units
  value: string; // quantity × unitCost
  firstDamagedAt: string;
  lastDamagedAt: string;
};

export type DamagedStockList = {
  data: DamagedStockRow[];
  totals: { units: number; value: string; skuCount: number }; // the whole filter, not just the page
  meta: { total: number; page: number; limit: number; totalPages: number };
};

export type DamagedStockMovement = {
  id: string;
  quantity: number;
  fromLocationCode: string | null; // the rack it came off
  note: string | null; // the reason as entered (adjustment or transfer number, write-off note)
  referenceType: string | null; // "ADJUSTMENT", "TRANSFER", or null for manual changes and batch write-offs
  referenceId: string | null;
  performedBy: { id: string; name: string } | null;
  createdAt: string;
};
