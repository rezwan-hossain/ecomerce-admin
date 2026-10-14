export type StockStatus = "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";

export type MovementType =
  | "PURCHASE_RECEIVED"
  | "RETURN_RESTOCKED"
  | "ADJUSTMENT_INCREASE"
  | "TRANSFER_IN"
  | "INITIAL_STOCK"
  | "SALE"
  | "ADJUSTMENT_DECREASE"
  | "TRANSFER_OUT"
  | "DAMAGED"
  | "LOST"
  | "EXPIRED"
  | "SAMPLE"
  | "WRITE_OFF"
  | "RESERVATION_CREATED"
  | "RESERVATION_RELEASED"
  | "RESERVATION_EXPIRED"
  | "LOCATION_MOVE";

// The types an admin can post; the rest are written by checkout, shipping and transfers.
export type ManualMovementType =
  | "PURCHASE_RECEIVED"
  | "RETURN_RESTOCKED"
  | "ADJUSTMENT_INCREASE"
  | "ADJUSTMENT_DECREASE"
  | "DAMAGED"
  | "LOST"
  | "EXPIRED"
  | "SAMPLE"
  | "WRITE_OFF";

// DAMAGE is the warehouse's system-made damage section: unplaced at first, never pickable, can't be renamed or deleted.
export type LocationType = "ZONE" | "AISLE" | "RACK" | "SHELF" | "BIN" | "RECEIVING" | "STAGING" | "PACKING" | "DAMAGE";

// One warehouse's stock of a variant. Costs come back as strings.
export interface StockLevel {
  warehouseId: string;
  onHand: number;
  reserved: number;
  available: number;
  incoming: number;
  damaged: number;
  unitCost: string;
  warehouse: { code: string; name: string; type: string };
  defaultLocation: { id: string; code: string } | null;
  locationStocks: { quantity: number; location: { id: string; code: string; name: string | null } }[];
}

// A row from GET /inventory. `stock` is what can be sold (available in sellable warehouses);
// the other totals add up every warehouse.
export interface VariantStock {
  variantId: string;
  sku: string;
  name: string; // option values like "Red / 42", or the SKU when there are none
  product: { id: string; name: string; slug: string };
  stock: number;
  onHand: number;
  reserved: number;
  incoming: number;
  damaged: number;
  lowStockThreshold: number;
  stockStatus: StockStatus;
  isActive: boolean;
  levels: StockLevel[];
  updatedAt: string;
}

export interface InventorySummary {
  totalVariants: number;
  inStock: number;
  lowStock: number;
  outOfStock: number;
  units: { onHand: number; reserved: number; available: number; incoming: number; damaged: number };
  stockValue: string;
  activeReservations: number;
}

export interface Movement {
  id: string;
  type: MovementType;
  direction: "IN" | "OUT" | "INTERNAL";
  quantity: number;
  onHandBefore: number;
  onHandAfter: number;
  unitCost: string | null;
  referenceType: string | null;
  referenceId: string | null;
  note: string | null;
  createdAt: string;
  fromLocation: { code: string } | null;
  toLocation: { code: string } | null;
  batchId?: string | null; // the batch it took from or added to
}

// GET /inventory/movements adds the warehouse, variant and who did it.
export interface LedgerMovement extends Movement {
  inventoryLevel: {
    warehouse: { id: string; code: string; name: string };
    variant: { id: string; sku: string; product: { id: string; name: string } };
  };
  performedByUser: { firstName: string | null; lastName: string | null } | null;
}

// GET /inventory/variants/:id
export interface VariantStockDetail extends VariantStock {
  recentMovements: (Movement & { inventoryLevel: { warehouse: { code: string } } })[];
  activeReservations: { id: string; quantity: number; expiresAt: string; order: { orderNumber: string } | null }[];
}

export interface StorageLocation {
  id: string;
  warehouseId: string;
  code: string;
  name: string | null;
  type: LocationType;
  parentId: string | null;
  isPickable: boolean;
  isActive: boolean;
  pickSequence: number;
  note: string | null;
  warehouse: { id: string; code: string };
  parent: { id: string; code: string } | null;
  variantCount: number;
  totalUnits: number;
}

export interface AdjustStockDto {
  variantId: string;
  warehouseId?: string;
  locationId?: string;
  type: ManualMovementType;
  quantity: number;
  unitCost?: number;
  note?: string;
}

export interface StockCountDto {
  warehouseId?: string;
  locationId?: string;
  countedQuantity: number;
  note?: string;
}

export interface MoveStockDto {
  variantId: string;
  warehouseId?: string;
  fromLocationId: string;
  toLocationId: string;
  quantity: number;
  note?: string;
}

export interface LocationDto {
  warehouseId?: string; // create only
  code: string;
  name?: string | null; // null clears it (update only)
  type: LocationType;
  parentId?: string | null;
  isPickable: boolean;
  isActive?: boolean; // update only
  pickSequence: number;
  note?: string | null;
}
