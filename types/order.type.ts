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
  | "REFUNDED";

export type PaymentStatus =
  | "PENDING"
  | "PROCESSING"
  | "PAID"
  | "FAILED"
  | "CANCELLED"
  | "REFUNDED"
  | "PARTIALLY_REFUNDED";

// A row from GET /orders. Decimals (amounts) come back as strings.
// Customer details and item names are snapshots taken at checkout.
export interface Order {
  id: string;
  orderNumber: string;
  userId: string | null; // null = guest checkout
  customerEmail: string;
  customerName: string | null;
  customerPhone: string | null;
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
    unitPrice: string;
    totalAmount: string;
  }[];
  payments: {
    id: string;
    provider: "STRIPE" | "SSLCOMMERZ" | "BKASH" | "NAGAD" | "COD" | "OTHER";
    status: PaymentStatus;
    amount: string;
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
  createdAt: string;
  // Pathao parcels keep Pathao's last status and its delivery fee here.
  metadata?: { pathaoStatus?: string; pathaoStatusAt?: string; pathaoDeliveryFee?: number } | null;
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
  fullAddress: string; // one line, e.g. "House 123, Road 4, Sector 10, Uttara, Dhaka-1230"
  city: string;
  country: string | null;
  createdAt: string;
}

// What the admin sends; an edit sends only the changed fields.
export interface OrderAddressBody {
  fullName: string; // 1 – 200
  phone: string; // 1 – 30
  company?: string;
  fullAddress: string; // 10 – 255
  city: string;
  country?: string;
}

// "House 12, Road 5, Uttara · Dhaka · BD", leaving out what's missing.
export const formatAddress = (a: Pick<OrderAddress, "fullAddress" | "city" | "country">) => [a.fullAddress, a.city, a.country].filter(Boolean).join(" · ")

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
  statusLogs: { id: string; fromStatus: OrderStatus | null; toStatus: OrderStatus; note: string | null; createdAt: string }[];
  refundRequests: { id: string; status: "PENDING" | "APPROVED" | "REJECTED" | "PROCESSED"; reason: string; amount: string; adminNote: string | null; createdAt: string }[];
}
