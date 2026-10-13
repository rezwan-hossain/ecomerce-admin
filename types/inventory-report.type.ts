// Read-only inventory reports (/inventory/reports). Money arrives as decimal strings; ratios are numbers or null.

import type { MovementType } from "./inventory.type";
import type { WarehouseType } from "./warehouse.type";

type VariantLine = { id: string; sku: string; productName: string; label: string }; // label "Red / XL"
type WarehouseRef = { id: string; code: string; name: string };
export type ReportMeta = { total: number; page: number; limit: number; totalPages: number };
type Units = { onHand: number; reserved: number; available: number; damaged: number; incoming: number };

export interface StockValueReport {
  warehouses: {
    warehouse: WarehouseRef & { type: WarehouseType; isActive: boolean };
    variantsStocked: number;
    units: Units;
    stockValue: string;
    shareOfValue: number; // % of the total
  }[]; // highest value first
  totals: { variantsStocked: number; units: Units; stockValue: string };
}

export type SlowStatus = "DEAD" | "SLOW" | "NEW" | "OK";

export interface SlowMovingRow {
  variant: VariantLine;
  status: SlowStatus;
  onHand: number;
  stockValue: string;
  unitsSold: number; // in the window
  daysOfCover: number | null; // null if nothing sold
  lastSaleAt: string | null; // ever
  daysSinceLastSale: number | null;
  lastReceivedAt: string | null;
}

export interface SlowMovingReport {
  data: SlowMovingRow[];
  meta: ReportMeta & {
    days: number;
    coverDays: number;
    // Every status whatever the filter, for the summary cards.
    summary: Record<SlowStatus, { variants: number; units: number; stockValue: string }>;
  };
}

export interface TurnoverRow {
  variant: VariantLine;
  openingOnHand: number; // rebuilt from the ledger at the window start
  closingOnHand: number;
  averageOnHand: number;
  unitsSold: number;
  cogs: string;
  stockValue: string;
  turnover: number | null;
  annualizedTurnover: number | null;
  daysOfInventory: number | null;
}

export interface TurnoverReport {
  data: TurnoverRow[];
  meta: ReportMeta & {
    days: number;
    totals: {
      variants: number;
      unitsSold: number;
      cogs: string;
      averageOnHand: number;
      stockValue: string;
      turnover: number | null;
      annualizedTurnover: number | null;
      daysOfInventory: number | null;
    };
  };
}

export interface HistoryMovement {
  id: string;
  createdAt: string;
  type: MovementType;
  direction: "IN" | "OUT" | "INTERNAL";
  quantity: number;
  change: number; // signed; 0 for reservations and rack moves
  balance: number; // running total after this movement
  onHandBefore: number;
  onHandAfter: number;
  unitCost: string | null;
  totalCost: string | null;
  warehouse: WarehouseRef;
  fromLocation: { id: string; code: string } | null;
  toLocation: { id: string; code: string } | null;
  referenceType: string | null;
  referenceId: string | null;
  note: string | null; // document notes start with their number (PO-…, ADJ-…, TRF-…)
  performedBy: { id: string; name: string } | null;
}

export interface StockHistoryReport {
  data: {
    variant: VariantLine;
    warehouseId: string | null;
    period: { from: string | null; to: string | null };
    openingOnHand: number;
    unitsIn: number;
    unitsOut: number;
    closingOnHand: number;
    currentOnHand: number;
    byType: { type: MovementType; direction: "IN" | "OUT" | "INTERNAL"; movements: number; units: number }[];
    reconciliation: { warehouse: WarehouseRef; ledgerOnHand: number; onHand: number; difference: number; ok: boolean }[];
    reconciled: boolean;
    movements: HistoryMovement[]; // oldest first
  };
  meta: ReportMeta;
}
