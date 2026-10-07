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
  shipments: { id: string; status: string; carrier: string | null; trackingNumber: string | null }[];
}

export interface OrderAddress {
  id: string;
  type: "SHIPPING" | "BILLING";
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  company: string | null;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string | null;
  postalCode: string | null;
  country: string;
}

// GET /orders/:id: the list row plus addresses, discounts, history and refunds.
export interface OrderDetail extends Omit<Order, "items" | "payments" | "shipments"> {
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
    failureMessage: string | null;
    paidAt: string | null;
  })[];
  shipments: {
    id: string;
    status: string;
    carrier: string | null;
    service: string | null;
    trackingNumber: string | null;
    trackingUrl: string | null;
    shippedAt: string | null;
    deliveredAt: string | null;
    createdAt: string;
  }[];
  statusLogs: { id: string; fromStatus: OrderStatus | null; toStatus: OrderStatus; note: string | null; createdAt: string }[];
  refundRequests: { id: string; status: string; reason: string; amount: string; adminNote: string | null; createdAt: string }[];
}
