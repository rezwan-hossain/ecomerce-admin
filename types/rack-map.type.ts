// The rack map API (docs/api/rack-map.md in the backend). Coordinates are metres, money is a decimal string.

export type Rotation = 0 | 90 | 180 | 270;
export type Face = "north" | "east" | "south" | "west";
export type MapLocationType = "ZONE" | "AISLE" | "RACK" | "SHELF" | "BIN" | "RECEIVING" | "STAGING" | "PACKING" | "DAMAGE";

export interface Point {
  x: number;
  y: number;
}
export interface Box {
  x: number; // north-west corner
  y: number;
  width: number;
  height: number;
}
export interface Placement {
  centerX: number;
  centerY: number;
  length: number; // along the slots (A → B → C)
  depth: number; // across the rack
  rotation: Rotation;
}

export interface CellStats {
  units: number;
  value: string;
  skuCount: number;
  movements: number; // ledger rows in or out in the last `activityDays`
}
export interface TopSku {
  inventoryLevelId: string;
  variantId: string;
  sku: string;
  quantity: number;
}
export interface MapBin {
  id: string;
  code: string;
  slotIndex: number;
  isActive: boolean;
  isPickable: boolean;
  stock: CellStats;
  topSkus: TopSku[];
}
export interface MapLevel {
  id: string;
  levelNumber: number;
  bins: MapBin[];
}

export interface FloorItem {
  id: string;
  code: string;
  name: string | null;
  type: MapLocationType;
  parentId: string | null;
  isActive: boolean;
  isPickable: boolean;
  pickSequence: number;
  placement: Placement;
  box: Box;
  pickFace: Face | null; // racks only
  slotCount: number | null; // racks only
  levels: MapLevel[] | null; // racks only, ground level first
  stock: CellStats; // whole subtree
}

export interface FloorPlan {
  warehouse: { id: string; name: string; code: string; type: string; floorWidth: number | null; floorDepth: number | null };
  items: FloorItem[];
  unplaced: { id: string; code: string; name: string | null; type: MapLocationType }[];
  totals: { unitsOnRacks: number; binsTotal: number; binsUsed: number; unitsToPutAway: number; damagedUnits: number }; // damaged units are never on racks
  maxCell: { units: number; value: string; movements: number };
  activityDays: number;
  generatedAt: string;
}

export interface LocationContents {
  location: {
    id: string;
    code: string;
    name: string | null;
    type: MapLocationType;
    isActive: boolean;
    isPickable: boolean;
    pickSequence: number;
    rackId: string | null;
  };
  rows: {
    inventoryLevelId: string;
    variantId: string;
    sku: string;
    productName: string;
    variantLabel: string;
    quantity: number;
    unitCost: string;
    value: string;
    isDefault: boolean;
  }[];
  recentMovements: {
    id: string;
    type: string;
    quantity: number;
    sku: string;
    fromLocationCode: string | null;
    toLocationCode: string | null;
    createdAt: string;
    performedBy: string | null;
  }[];
}

export interface PutAwayLine {
  locationId: string;
  locationCode: string;
  inventoryLevelId: string;
  sku: string;
  productName: string;
  quantity: number;
  suggestedLocationId: string | null;
  suggestedLocationCode: string | null;
}

export interface PickRoute {
  orderId: string;
  start: Point | null;
  end: Point | null;
  startLocationCode: string | null;
  stops: {
    sequence: number;
    locationId: string;
    locationCode: string;
    rackId: string | null;
    inventoryLevelId: string;
    sku: string;
    productName: string;
    quantity: number;
    point: Point | null; // null when the location isn't on the map
  }[];
  shortages: { inventoryLevelId: string; sku: string; quantity: number }[];
}

export interface CreateRackDto {
  code: string;
  name?: string;
  zoneId?: string;
  levels: number; // 1-8
  binsPerLevel: number; // 1-6
  rotation: Rotation;
  length?: number; // metres along the bins; default binsPerLevel × 1.4
  depth?: number; // default 1.2
}

export interface LocationMoveDto {
  inventoryLevelId: string;
  toLocationId: string;
  quantity: number;
  makeDefault?: boolean;
}
