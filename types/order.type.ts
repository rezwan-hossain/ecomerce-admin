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
