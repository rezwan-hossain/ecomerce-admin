export type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "PROCESSING"
  | "READY_TO_SHIP"
  | "SHIPPED"
  | "DELIVERED"
  | "COMPLETED"
  | "CANCELLED"
  | "FAILED"
  | "REFUNDED"
  | "RETURNED" // every item is back in stock, or the courier is bringing the whole parcel back
  | "PARTIALLY_RETURNED"; // some items are back in stock, the customer kept the rest

export type PaymentStatus =
  | "PENDING"
  | "PROCESSING"
  | "PAID"
  | "FAILED"
  | "CANCELLED"
  | "REFUNDED"
  | "PARTIALLY_REFUNDED"
  | "PARTIALLY_PAID"; // COD partial delivery: the customer kept and paid for only some items

// Who made a change. The server decides it from the endpoint called; the admin never sends it.
export type ChangeSource = "MANUAL" | "COURIER_WEBHOOK" | "COURIER_SYNC" | "CHECKOUT" | "SYSTEM";

// A row from GET /orders. Decimals (amounts) come back as strings.
// Customer details and item names are snapshots taken at checkout.
export interface Order {
  id: string;
  orderNumber: string;
  userId: string | null; // null = guest checkout
  customerEmail: string;
  customerName: string | null;
  customerPhone: string | null;
  customerNote: string | null; // the list rows carry it too
  status: OrderStatus;
  currency: string;
  subtotalAmount: string;
  discountAmount: string;
  shippingAmount: string;
  totalAmount: string;
  placedAt: string | null;
  createdAt: string;
  items: {
    id: string;
    productId: string | null;
    variantId: string | null;
    productName: string;
    variantName: string | null;
    sku: string;
    quantity: number;
    returnedQuantity: number; // units already received back into stock
    unitPrice: string;
    totalAmount: string;
  }[];
  payments: {
    id: string;
    provider: "STRIPE" | "SSLCOMMERZ" | "BKASH" | "NAGAD" | "COD" | "OTHER";
    status: PaymentStatus;
    amount: string; // PARTIALLY_PAID: the cash actually collected
    failureMessage?: string | null; // "Returned by courier" on a returned COD
    metadata?: {
      orderedAmount?: string; // PARTIALLY_PAID: what should have been collected
      collectedAmount?: string; // PARTIALLY_PAID: the cash collected
      settledBy?: ChangeSource; // who changed the payment status last (missing on older payments)
      settledByCourier?: CourierCarrier;
      settledAt?: string;
      settledByUserId?: string;
    } | null;
    createdAt: string;
  }[];
  shipments: Shipment[];
}

export type CourierCarrier = "PATHAO" | "REDX" | "STEADFAST" | "CARRYBEE";

export type ShipmentStatus =
  | "PENDING"
  | "PROCESSING"
  | "SHIPPED"
  | "IN_TRANSIT"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "FAILED"
  | "RETURNED"
  | "CANCELLED";

// One parcel booked with a courier; an order can have several.
export interface Shipment {
  id: string;
  status: ShipmentStatus;
  carrier: CourierCarrier;
  service: string | null;
  merchantOrderId: string | null; // our reference sent to the courier
  consignmentId: string | null; // the courier's id
  trackingNumber: string | null;
  trackingUrl: string | null;
  shippingAmount: string;
  codAmount: string | null; // what the courier collects on delivery
  shippedAt: string | null;
  deliveredAt: string | null;
  updatedAt: string;
  createdAt: string;
  // Pathao parcels keep Pathao's last status and its delivery fee here.
  metadata?: {
    pathaoStatus?: string;
    pathaoStatusAt?: string;
    pathaoDeliveryFee?: number;
    // The last status change and who made it (missing on older shipments).
    lastChange?: { status: ShipmentStatus; source: ChangeSource; courier?: CourierCarrier; at: string; userId?: string };
  } | null;
}

export interface ShipmentDto {
  carrier: CourierCarrier;
  service?: string;
  consignmentId?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  shippingAmount?: number;
  codAmount?: number;
}

export interface OrderAddress {
  id: string;
  orderId: string;
  type: "SHIPPING" | "BILLING";
  fullName: string;
  phone: string;
  company: string | null;
  fullAddress: string; // one line, e.g. "House 32, Road 8, Block H, Mirpur 2, Dhaka-1216"
  thana: string; // e.g. "Mirpur 6"; "" on orders placed before thana existed
  city: string; // the district, e.g. "Dhaka"
  country: string | null;
  createdAt: string;
}

// What the admin sends; an edit sends only the changed fields.
export interface OrderAddressBody {
  fullName: string; // 1 – 200
  phone: string; // 1 – 30
  company?: string;
  fullAddress: string; // 10 – 255
  thana: string; // 1 – 100
  city: string; // district, 1 – 100
  country?: string;
}

// POST /orders/:id/returns. Can be sent again for a later trip; returnedQuantity adds up.
export interface ReceiveReturnedItemsBody {
  items: { orderItemId: string; quantity: number; damaged?: boolean }[]; // damaged → damage section, not sellable
  note?: string; // max 500
}

// "House 12, Road 5 · Mirpur 6 · Dhaka · BD", leaving out what's missing (old orders have no thana).
export const formatAddress = (a: Pick<OrderAddress, "fullAddress" | "thana" | "city" | "country">) =>
  [a.fullAddress, a.thana, a.city, a.country].filter(Boolean).join(" · ")

// The one line Pathao receives (backend pathao-recipient.ts): the full address, then the thana and
// city unless the address already mentions them. Pathao finds the delivery area from this text.
export const pathaoAddress = (a: Pick<OrderAddress, "fullAddress" | "thana" | "city">) => {
  const street = a.fullAddress.trim()
  const missing = [a.thana, a.city].map((p) => p.trim()).filter((p) => p && !street.toLowerCase().includes(p.toLowerCase()))
  return [street, ...missing].filter(Boolean).join(", ")
}

// GET /orders/:id: the list row plus addresses, discounts, history and refunds.
export interface OrderDetail extends Omit<Order, "items" | "payments"> {
  userId: string | null;
  customerNote: string | null;
  cancelledAt: string | null;
  completedAt: string | null;
  updatedAt: string;
  items: (Order["items"][number] & {
    subtotalAmount: string;
    discountAmount: string;
    metadata: { appliedPromotion?: { id: string; name: string; type: string } } | null;
  })[];
  addresses: OrderAddress[];
  discounts: { id: string; promotionId: string | null; promotionName: string; promotionType: string; amount: string }[];
  payments: (Order["payments"][number] & {
    method: string;
    transactionId: string | null;
    providerReference: string | null;
    failureMessage: string | null;
    paidAt: string | null;
  })[];
  statusLogs: {
    id: string;
    fromStatus: OrderStatus | null;
    toStatus: OrderStatus;
    note: string | null;
    source: ChangeSource; // SYSTEM on rows from before sources were tracked
    courier: CourierCarrier | null;
    createdAt: string;
  }[];
  refundRequests: { id: string; status: "PENDING" | "APPROVED" | "REJECTED" | "PROCESSED"; reason: string; amount: string; adminNote: string | null; createdAt: string }[];
}
