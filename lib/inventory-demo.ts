// Demo data for the inventory pages the API doesn't cover yet: purchase orders, transfers,
// adjustment approvals, batches, reservations, alerts, reorder rules, warehouses and suppliers.
// It uses the real warehouse codes and SKUs so it reads like the live data. Nothing is saved.
// Replace each list with an API call once its endpoint exists.

const DAY = 86_400_000
const at = (days: number, hour = 10) => {
  const d = new Date(Date.now() + days * DAY)
  d.setHours(hour, 0, 0, 0)
  return d.toISOString()
}

export type DemoItem = { sku: string; name: string; variant: string }

export const DEMO_ITEMS: DemoItem[] = [
  { sku: "APPLE-MACBOOK-PRO-14-INCH-SPACE-GREY-16GB", name: "Apple MacBook Pro 14 Inch Space Grey", variant: "16GB" },
  { sku: "NEW-DELL-XPS-13-9300-LAPTOP-16GB", name: "New DELL XPS 13 9300 Laptop", variant: "16GB" },
  { sku: "LENOVO-YOGA-920-32GB", name: "Lenovo Yoga 920", variant: "32GB" },
  { sku: "IPHONE-5S-128GB", name: "iPhone 5s", variant: "128GB" },
  { sku: "OPPO-F19-PRO-PLUS-128GB", name: "Oppo F19 Pro Plus", variant: "128GB" },
  { sku: "BLUE-FROCK-L", name: "Blue Frock", variant: "L" },
  { sku: "GRAY-DRESS-XS", name: "Gray Dress", variant: "XS" },
  { sku: "GIGABYTE-AORUS-MEN-TSHIRT-S", name: "Gigabyte Aorus Men Tshirt", variant: "S" },
  { sku: "MAN-SHORT-SLEEVE-SHIRT-M", name: "Man Short Sleeve Shirt", variant: "M" },
  { sku: "CALVIN-KLEIN-HEEL-SHOES-37", name: "Calvin Klein Heel Shoes", variant: "37" },
  { sku: "NIKE-BASEBALL-CLEATS-40", name: "Nike Baseball Cleats", variant: "40" },
  { sku: "PAMPI-SHOES-39", name: "Pampi Shoes", variant: "39" },
  { sku: "BLACK-BROWN-SLIPPER-39", name: "Black & Brown Slipper", variant: "39" },
]
const item = (sku: string) => DEMO_ITEMS.find((i) => i.sku === sku)!

export const DEMO_USERS = ["Nusrat Jahan", "Rafiq Ahmed", "Tania Sultana"]

/* ---------- Warehouses and suppliers ---------- */

export type WarehouseType = "PHYSICAL" | "STORE" | "VIRTUAL_DAMAGE" | "VIRTUAL_QC" | "VIRTUAL_RETURN"

export type DemoWarehouse = {
  id: string
  name: string
  code: string
  type: WarehouseType
  addressLine1: string
  addressLine2: string
  city: string
  state: string // division
  postalCode: string
  priority: number
  isDefault: boolean
  isActive: boolean
}

export const DEMO_WAREHOUSES: DemoWarehouse[] = [
  { id: "wh-main", name: "Main Warehouse", code: "MAIN", type: "PHYSICAL", addressLine1: "Plot 22, Tejgaon Industrial Area", addressLine2: "", city: "Dhaka", state: "Dhaka", postalCode: "1208", priority: 10, isDefault: true, isActive: true },
  { id: "wh-ctg", name: "Chattogram Store", code: "CTG-STORE", type: "STORE", addressLine1: "GEC Circle, O.R. Nizam Road", addressLine2: "", city: "Chattogram", state: "Chattogram", postalCode: "4000", priority: 5, isDefault: false, isActive: true },
  { id: "wh-dmg", name: "Damage hold", code: "DAMAGE", type: "VIRTUAL_DAMAGE", addressLine1: "", addressLine2: "", city: "Dhaka", state: "Dhaka", postalCode: "", priority: 0, isDefault: false, isActive: true },
  { id: "wh-ret", name: "Returns desk", code: "RETURNS", type: "VIRTUAL_RETURN", addressLine1: "", addressLine2: "", city: "Dhaka", state: "Dhaka", postalCode: "", priority: 0, isDefault: false, isActive: true },
]

export type DemoSupplier = {
  id: string
  name: string
  code: string
  contactName: string
  contactPhone: string
  contactEmail: string
  city: string
  paymentTerms: string
  leadTimeDays: number | null
  isActive: boolean
}

export const DEMO_SUPPLIERS: DemoSupplier[] = [
  { id: "sup-1", name: "Smart Technologies (BD) Ltd", code: "SUP-001", contactName: "Sabrina Akter", contactPhone: "+880 1819-445566", contactEmail: "orders@smartbd.example", city: "Dhaka", paymentTerms: "Net 15", leadTimeDays: 10, isActive: true },
  { id: "sup-2", name: "Apex Footwear Ltd", code: "SUP-002", contactName: "Mahbub Alam", contactPhone: "+880 1713-778899", contactEmail: "b2b@apex.example", city: "Gazipur", paymentTerms: "Net 45", leadTimeDays: 12, isActive: true },
  { id: "sup-3", name: "Aarong wholesale", code: "SUP-003", contactName: "Farhana Rahman", contactPhone: "+880 1730-112233", contactEmail: "wholesale@aarong.example", city: "Dhaka", paymentTerms: "Net 30", leadTimeDays: 21, isActive: true },
  { id: "sup-4", name: "Global Brand Distribution", code: "SUP-004", contactName: "Kamrul Islam", contactPhone: "+880 1678-990011", contactEmail: "dealer@gbd.example", city: "Chattogram", paymentTerms: "COD", leadTimeDays: 5, isActive: true },
]

/* ---------- Purchase orders ---------- */

export type PoStatus = "DRAFT" | "SUBMITTED" | "CONFIRMED" | "PARTIAL" | "RECEIVED" | "CANCELLED" | "CLOSED"

export type DemoPoItem = DemoItem & {
  id: string
  warehouse: string
  orderedQty: number
  receivedQty: number
  damagedQty: number
  unitCost: number
}

export type DemoPurchaseOrder = {
  id: string
  poNumber: string
  supplierId: string
  status: PoStatus
  items: DemoPoItem[]
  taxAmount: number
  shippingAmount: number
  orderedAt: string | null
  expectedAt: string | null
  note: string
  fromRule: boolean
  createdBy: string
  createdAt: string
}

const poItem = (id: string, sku: string, warehouse: string, orderedQty: number, unitCost: number, receivedQty = 0, damagedQty = 0): DemoPoItem => ({
  ...item(sku), id, warehouse, orderedQty, receivedQty, damagedQty, unitCost,
})

export const DEMO_PURCHASE_ORDERS: DemoPurchaseOrder[] = [
  {
    id: "po-1", poNumber: "PO-2026-00001", supplierId: "sup-1", status: "RECEIVED", taxAmount: 0, shippingAmount: 1500,
    items: [poItem("pi-1", "APPLE-MACBOOK-PRO-14-INCH-SPACE-GREY-16GB", "MAIN", 10, 182000, 10), poItem("pi-2", "NEW-DELL-XPS-13-9300-LAPTOP-16GB", "MAIN", 20, 121000, 20)],
    orderedAt: at(-50), expectedAt: at(-40), note: "", fromRule: false, createdBy: "Nusrat Jahan", createdAt: at(-50, 9),
  },
  {
    id: "po-2", poNumber: "PO-2026-00002", supplierId: "sup-2", status: "PARTIAL", taxAmount: 0, shippingAmount: 0,
    items: [poItem("pi-3", "NIKE-BASEBALL-CLEATS-40", "MAIN", 24, 2550, 18, 1), poItem("pi-4", "PAMPI-SHOES-39", "MAIN", 24, 1800, 24), poItem("pi-5", "BLACK-BROWN-SLIPPER-39", "CTG-STORE", 12, 650)],
    orderedAt: at(-8), expectedAt: at(-2), note: "Second carton arrives with the next truck.", fromRule: false, createdBy: "Nusrat Jahan", createdAt: at(-8, 9),
  },
  {
    id: "po-3", poNumber: "PO-2026-00003", supplierId: "sup-1", status: "SUBMITTED", taxAmount: 0, shippingAmount: 2200,
    items: [poItem("pi-6", "OPPO-F19-PRO-PLUS-128GB", "CTG-STORE", 20, 26500), poItem("pi-7", "IPHONE-5S-128GB", "MAIN", 15, 18000)],
    orderedAt: at(-3), expectedAt: at(6), note: "", fromRule: false, createdBy: "Nusrat Jahan", createdAt: at(-3, 15),
  },
  {
    id: "po-4", poNumber: "PO-2026-00004", supplierId: "sup-3", status: "DRAFT", taxAmount: 0, shippingAmount: 0,
    items: [poItem("pi-8", "BLUE-FROCK-L", "MAIN", 30, 1450), poItem("pi-9", "GRAY-DRESS-XS", "MAIN", 20, 1600)],
    orderedAt: null, expectedAt: at(14), note: "Eid collection", fromRule: false, createdBy: "Tania Sultana", createdAt: at(-1, 11),
  },
  {
    id: "po-5", poNumber: "PO-2026-00005", supplierId: "sup-4", status: "DRAFT", taxAmount: 0, shippingAmount: 0,
    items: [poItem("pi-10", "LENOVO-YOGA-920-32GB", "MAIN", 8, 98000)],
    orderedAt: null, expectedAt: null, note: "Drafted by a reorder rule. Review before submitting.", fromRule: true, createdBy: "System", createdAt: at(-1, 14),
  },
]

/* ---------- Transfers ---------- */

export type TransferStatus = "DRAFT" | "PENDING" | "IN_TRANSIT" | "PARTIAL" | "COMPLETED" | "CANCELLED"

export type DemoTransferItem = DemoItem & { id: string; sentQty: number; receivedQty: number; damagedQty: number }

export type DemoTransfer = {
  id: string
  transferNumber: string
  from: string
  to: string
  status: TransferStatus
  items: DemoTransferItem[]
  shippedAt: string | null
  receivedAt: string | null
  note: string
  initiatedBy: string
  createdAt: string
}

const trfItem = (id: string, sku: string, sentQty: number, receivedQty = 0): DemoTransferItem => ({ ...item(sku), id, sentQty, receivedQty, damagedQty: 0 })

export const DEMO_TRANSFERS: DemoTransfer[] = [
  {
    id: "trf-1", transferNumber: "TRF-2026-00001", from: "MAIN", to: "CTG-STORE", status: "COMPLETED",
    items: [trfItem("ti-1", "NEW-DELL-XPS-13-9300-LAPTOP-16GB", 8, 8), trfItem("ti-2", "OPPO-F19-PRO-PLUS-128GB", 5, 5)],
    shippedAt: at(-38, 16), receivedAt: at(-35, 12), note: "Restock for Chattogram orders", initiatedBy: "Nusrat Jahan", createdAt: at(-38, 9),
  },
  {
    id: "trf-2", transferNumber: "TRF-2026-00002", from: "MAIN", to: "CTG-STORE", status: "IN_TRANSIT",
    items: [trfItem("ti-3", "BLUE-FROCK-L", 6), trfItem("ti-4", "CALVIN-KLEIN-HEEL-SHOES-37", 4), trfItem("ti-5", "GIGABYTE-AORUS-MEN-TSHIRT-S", 10)],
    shippedAt: at(-1, 9), receivedAt: null, note: "Weekend restock for the store", initiatedBy: "Nusrat Jahan", createdAt: at(-2, 10),
  },
  {
    id: "trf-3", transferNumber: "TRF-2026-00003", from: "CTG-STORE", to: "MAIN", status: "PENDING",
    items: [trfItem("ti-6", "MAN-SHORT-SLEEVE-SHIRT-M", 5)],
    shippedAt: null, receivedAt: null, note: "Main is short on size M", initiatedBy: "Rafiq Ahmed", createdAt: at(-1, 11),
  },
]

/* ---------- Adjustments ---------- */

export type AdjustmentType = "INCREASE" | "DECREASE" | "CYCLE_COUNT"
export type AdjustmentReason = "CYCLE_COUNT" | "DAMAGE" | "THEFT" | "LOSS" | "EXPIRY" | "CORRECTION" | "OPENING_STOCK" | "PROMOTIONAL" | "OTHER"
export type AdjustmentStatus = "PENDING" | "APPROVED" | "APPLIED" | "REJECTED" | "CANCELLED"

// `quantity` is the signed change: counted minus expected for a cycle count.
export type DemoAdjustmentItem = DemoItem & { id: string; warehouse: string; rack: string | null; expected: number | null; counted: number | null; quantity: number }

export type DemoAdjustment = {
  id: string
  adjustmentNumber: string
  type: AdjustmentType
  reason: AdjustmentReason
  status: AdjustmentStatus
  items: DemoAdjustmentItem[]
  note: string
  createdBy: string
  approvedBy: string | null
  createdAt: string
}

export const DEMO_ADJUSTMENTS: DemoAdjustment[] = [
  {
    id: "adj-1", adjustmentNumber: "ADJ-2026-00001", type: "CYCLE_COUNT", reason: "CYCLE_COUNT", status: "APPLIED",
    items: [{ ...item("GRAY-DRESS-XS"), id: "ai-1", warehouse: "MAIN", rack: "B-01", expected: 15, counted: 13, quantity: -2 }],
    note: "Monthly count, zone B", createdBy: "Rafiq Ahmed", approvedBy: "Nusrat Jahan", createdAt: at(-20, 17),
  },
  {
    id: "adj-2", adjustmentNumber: "ADJ-2026-00002", type: "DECREASE", reason: "DAMAGE", status: "APPLIED",
    items: [{ ...item("APPLE-MACBOOK-PRO-14-INCH-SPACE-GREY-16GB"), id: "ai-2", warehouse: "MAIN", rack: "A-02", expected: null, counted: null, quantity: -1 }],
    note: "Carton crushed by a forklift", createdBy: "Rafiq Ahmed", approvedBy: "Nusrat Jahan", createdAt: at(-15, 12),
  },
  {
    id: "adj-3", adjustmentNumber: "ADJ-2026-00003", type: "DECREASE", reason: "THEFT", status: "PENDING",
    items: [{ ...item("CALVIN-KLEIN-HEEL-SHOES-37"), id: "ai-3", warehouse: "CTG-STORE", rack: null, expected: null, counted: null, quantity: -1 }],
    note: "Missing after the Friday rush. CCTV request filed.", createdBy: "Tania Sultana", approvedBy: null, createdAt: at(-1, 12),
  },
  {
    id: "adj-4", adjustmentNumber: "ADJ-2026-00004", type: "CYCLE_COUNT", reason: "CYCLE_COUNT", status: "APPROVED",
    items: [{ ...item("PAMPI-SHOES-39"), id: "ai-4", warehouse: "MAIN", rack: "B-03", expected: 9, counted: 10, quantity: 1 }],
    note: "Found one pair behind the rack", createdBy: "Rafiq Ahmed", approvedBy: "Nusrat Jahan", createdAt: at(-1, 13),
  },
]

/* ---------- Batches ---------- */

export type BatchStatus = "AVAILABLE" | "DEPLETED" | "EXPIRED" | "QUARANTINED" | "RECALLED"

export type DemoBatch = DemoItem & {
  id: string
  batchNumber: string
  warehouse: string
  quantity: number
  initialQty: number
  expiresAt: string | null
  supplierId: string | null
  status: BatchStatus
}

export const DEMO_BATCHES: DemoBatch[] = [
  { ...item("GIGABYTE-AORUS-MEN-TSHIRT-S"), id: "b-1", batchNumber: "GAT-2511-A", warehouse: "MAIN", quantity: 14, initialQty: 40, expiresAt: null, supplierId: "sup-4", status: "AVAILABLE" },
  { ...item("BLUE-FROCK-L"), id: "b-2", batchNumber: "AAR-2604-C", warehouse: "MAIN", quantity: 13, initialQty: 20, expiresAt: null, supplierId: "sup-3", status: "AVAILABLE" },
  { ...item("OPPO-F19-PRO-PLUS-128GB"), id: "b-3", batchNumber: "OPF-2603-B", warehouse: "CTG-STORE", quantity: 5, initialQty: 5, expiresAt: at(22), supplierId: "sup-1", status: "AVAILABLE" },
  { ...item("IPHONE-5S-128GB"), id: "b-4", batchNumber: "IP5-2509-Q", warehouse: "MAIN", quantity: 3, initialQty: 12, expiresAt: null, supplierId: "sup-1", status: "QUARANTINED" },
  { ...item("BLACK-BROWN-SLIPPER-39"), id: "b-5", batchNumber: "BBS-2505-D", warehouse: "MAIN", quantity: 0, initialQty: 30, expiresAt: null, supplierId: "sup-2", status: "DEPLETED" },
]

/* ---------- Reservations ---------- */

export type ReservationStatus = "ACTIVE" | "COMMITTED" | "RELEASED" | "EXPIRED"

export type DemoReservation = DemoItem & {
  id: string
  orderNumber: string
  warehouse: string
  quantity: number
  status: ReservationStatus
  reservedAt: string
  expiresAt: string
}

export const DEMO_RESERVATIONS: DemoReservation[] = [
  { ...item("NEW-DELL-XPS-13-9300-LAPTOP-16GB"), id: "r-1", orderNumber: "ORD-10284", warehouse: "MAIN", quantity: 2, status: "ACTIVE", reservedAt: at(0, 7), expiresAt: at(1, 7) },
  { ...item("GRAY-DRESS-XS"), id: "r-2", orderNumber: "ORD-10285", warehouse: "MAIN", quantity: 1, status: "ACTIVE", reservedAt: at(0, 8), expiresAt: at(1, 8) },
  { ...item("OPPO-F19-PRO-PLUS-128GB"), id: "r-3", orderNumber: "ORD-10279", warehouse: "CTG-STORE", quantity: 1, status: "ACTIVE", reservedAt: at(-2, 15), expiresAt: at(-1, 15) },
  { ...item("PAMPI-SHOES-39"), id: "r-4", orderNumber: "ORD-10270", warehouse: "MAIN", quantity: 1, status: "COMMITTED", reservedAt: at(-3, 11), expiresAt: at(-2, 11) },
  { ...item("BLUE-FROCK-L"), id: "r-5", orderNumber: "ORD-10266", warehouse: "MAIN", quantity: 1, status: "EXPIRED", reservedAt: at(-4, 13), expiresAt: at(-4, 14) },
  { ...item("CALVIN-KLEIN-HEEL-SHOES-37"), id: "r-6", orderNumber: "ORD-10261", warehouse: "CTG-STORE", quantity: 2, status: "RELEASED", reservedAt: at(-5, 10), expiresAt: at(-4, 10) },
]

/* ---------- Alerts and reorder rules ---------- */

export type AlertType = "LOW_STOCK" | "OUT_OF_STOCK" | "OVERSTOCK" | "EXPIRING_SOON" | "NEGATIVE_STOCK" | "REORDER_TRIGGERED"
export type AlertStatus = "ACTIVE" | "ACKNOWLEDGED" | "RESOLVED" | "DISMISSED"

export type DemoAlert = {
  id: string
  type: AlertType
  status: AlertStatus
  title: string
  message: string
  warehouse: string | null
  currentStock: number
  threshold: number | null
  acknowledgedBy: string | null
  createdAt: string
}

export const DEMO_ALERTS: DemoAlert[] = [
  { id: "al-1", type: "OUT_OF_STOCK", status: "ACTIVE", title: "Out of stock: Lenovo Yoga 920, 32GB", message: "Nothing available at Main Warehouse. 8 on a draft order.", warehouse: "MAIN", currentStock: 0, threshold: 0, acknowledgedBy: null, createdAt: at(-1, 14) },
  { id: "al-2", type: "REORDER_TRIGGERED", status: "ACTIVE", title: "Reorder Lenovo Yoga 920, 32GB", message: "0 available and 0 incoming, reorder point is 3. Added to draft PO-2026-00005.", warehouse: "MAIN", currentStock: 0, threshold: 3, acknowledgedBy: null, createdAt: at(-1, 14) },
  { id: "al-3", type: "LOW_STOCK", status: "ACTIVE", title: "Low stock: Black & Brown Slipper, 39", message: "1 available at Main Warehouse, alert at 5. 12 on the way.", warehouse: "MAIN", currentStock: 1, threshold: 5, acknowledgedBy: null, createdAt: at(-2, 9) },
  { id: "al-4", type: "EXPIRING_SOON", status: "ACTIVE", title: "Expiring soon: Oppo F19 Pro Plus, 128GB", message: "Batch OPF-2603-B at Chattogram Store expires in 22 days with 5 units left.", warehouse: "CTG-STORE", currentStock: 5, threshold: 30, acknowledgedBy: null, createdAt: at(-1, 8) },
  { id: "al-5", type: "LOW_STOCK", status: "ACKNOWLEDGED", title: "Low stock: Man Short Sleeve Shirt, M", message: "1 available at Main Warehouse, alert at 5. Transfer TRF-2026-00003 is pending.", warehouse: "MAIN", currentStock: 1, threshold: 5, acknowledgedBy: "Nusrat Jahan", createdAt: at(-3, 10) },
  { id: "al-6", type: "OVERSTOCK", status: "RESOLVED", title: "Overstock: New DELL XPS 13 9300 Laptop, 16GB", message: "46 on hand at Main Warehouse, ceiling is 40.", warehouse: "MAIN", currentStock: 46, threshold: 40, acknowledgedBy: null, createdAt: at(-9, 10) },
]

export type DemoRule = DemoItem & {
  id: string
  warehouse: string
  reorderPoint: number
  reorderQty: number
  safetyStock: number
  maxStock: number | null
  supplierId: string | null // null = replenish by transfer
  autoReorder: boolean
  isActive: boolean
  lastTriggeredAt: string | null
}

export const DEMO_RULES: DemoRule[] = [
  { ...item("NEW-DELL-XPS-13-9300-LAPTOP-16GB"), id: "ru-1", warehouse: "MAIN", reorderPoint: 10, reorderQty: 20, safetyStock: 4, maxStock: 40, supplierId: "sup-1", autoReorder: false, isActive: true, lastTriggeredAt: at(-9) },
  { ...item("LENOVO-YOGA-920-32GB"), id: "ru-2", warehouse: "MAIN", reorderPoint: 3, reorderQty: 8, safetyStock: 1, maxStock: null, supplierId: "sup-4", autoReorder: true, isActive: true, lastTriggeredAt: at(-1, 14) },
  { ...item("OPPO-F19-PRO-PLUS-128GB"), id: "ru-3", warehouse: "CTG-STORE", reorderPoint: 4, reorderQty: 10, safetyStock: 0, maxStock: null, supplierId: null, autoReorder: false, isActive: true, lastTriggeredAt: null },
  { ...item("PAMPI-SHOES-39"), id: "ru-4", warehouse: "MAIN", reorderPoint: 6, reorderQty: 24, safetyStock: 2, maxStock: 60, supplierId: "sup-2", autoReorder: true, isActive: false, lastTriggeredAt: null },
]
