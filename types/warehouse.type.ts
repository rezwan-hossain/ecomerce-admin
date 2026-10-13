// The warehouses API (GET/POST/PATCH/DELETE /inventory/warehouses). Decimals arrive as strings.

export type WarehouseType = "PHYSICAL" | "STORE" | "VIRTUAL_DAMAGE" | "VIRTUAL_QC" | "VIRTUAL_RETURN";

export interface Warehouse {
  id: string;
  code: string; // fixed after create
  name: string;
  type: WarehouseType;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null; // division
  postalCode: string | null;
  country: string | null;
  priority: number; // higher = reserved from first at checkout
  isDefault: boolean; // exactly one
  isActive: boolean;
  floorWidth: string | null;
  floorDepth: string | null;
  createdAt: string;
  updatedAt: string;
  counts: {
    locations: number; // racks and bins, not UNASSIGNED
    variantsStocked: number; // SKUs with stock on hand
    unitsOnHand: number;
    stockValue: string;
  };
}

// GET /inventory/warehouses/:id/stock
export interface WarehouseStockRow {
  id: string; // inventory level id
  onHand: number;
  reserved: number;
  available: number;
  incoming: number;
  damaged: number;
  unitCost: string;
  totalCost: string;
  updatedAt: string;
  variant: { id: string; sku: string; productName: string; label: string }; // label "Red / XL", "" without options
  defaultLocation: { id: string; code: string } | null;
}

// Create sends the code; edit can't change it.
export interface WarehouseDto {
  code?: string;
  name: string;
  type: WarehouseType;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  priority: number;
  isDefault: boolean;
  isActive: boolean;
}
