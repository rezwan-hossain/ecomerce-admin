import orderData from "@/lib/data/orders.json"

// Demo data only — replace these with real API / database calls.

export type Order = (typeof orderData)[number]

export type OrderStatus =
  | "Pending"
  | "Processing"
  | "Shipped"
  | "Delivered"
  | "Cancelled"
  | "Refunded"

export const orders: Order[] = orderData

export function getOrder(id: string) {
  return orders.find((order) => order.order === `#${id}`)
}

export type ProductStatus = "Active" | "Draft" | "Archived"

export type Product = {
  id: string
  name: string
  description: string
  sku: string
  category: string
  brand: string
  price: number
  compareAtPrice?: number
  stock: number
  status: ProductStatus
  tags: string[]
}

export const products: Product[] = [
  {
    id: "wireless-headphones",
    name: "Wireless Headphones",
    description: "Over-ear noise cancelling headphones with 30h battery life.",
    sku: "EL-WH-001",
    category: "Electronics",
    brand: "Soundwave",
    price: 129.99,
    compareAtPrice: 159.99,
    stock: 84,
    status: "Active",
    tags: ["audio", "bluetooth"],
  },
  {
    id: "smart-watch",
    name: "Smart Watch",
    description: "Fitness tracking, heart-rate monitor and notifications.",
    sku: "EL-SW-002",
    category: "Electronics",
    brand: "Pulse",
    price: 249,
    stock: 32,
    status: "Active",
    tags: ["wearable", "fitness"],
  },
  {
    id: "running-shoes",
    name: "Running Shoes",
    description: "Lightweight breathable running shoes with foam sole.",
    sku: "AP-RS-003",
    category: "Apparel",
    brand: "Stride",
    price: 89.95,
    stock: 6,
    status: "Active",
    tags: ["shoes", "running"],
  },
  {
    id: "leather-backpack",
    name: "Leather Backpack",
    description: "Full-grain leather backpack with padded laptop sleeve.",
    sku: "AC-LB-004",
    category: "Accessories",
    brand: "Northfold",
    price: 119,
    stock: 21,
    status: "Active",
    tags: ["bags", "leather"],
  },
  {
    id: "cotton-t-shirt",
    name: "Cotton T-Shirt",
    description: "Organic cotton crew neck t-shirt.",
    sku: "AP-TS-005",
    category: "Apparel",
    brand: "Basics Co.",
    price: 24.5,
    stock: 240,
    status: "Active",
    tags: ["cotton", "basics"],
  },
  {
    id: "espresso-machine",
    name: "Espresso Machine",
    description: "15-bar pump espresso machine with milk frother.",
    sku: "HK-EM-006",
    category: "Home & Kitchen",
    brand: "Barista Pro",
    price: 349,
    compareAtPrice: 399,
    stock: 0,
    status: "Active",
    tags: ["coffee", "appliance"],
  },
  {
    id: "yoga-mat",
    name: "Yoga Mat",
    description: "Non-slip 6mm yoga mat with carry strap.",
    sku: "SP-YM-007",
    category: "Sports",
    brand: "Stride",
    price: 39.99,
    stock: 57,
    status: "Active",
    tags: ["yoga", "fitness"],
  },
  {
    id: "desk-lamp",
    name: "Desk Lamp",
    description: "Dimmable LED desk lamp with USB charging port.",
    sku: "HK-DL-008",
    category: "Home & Kitchen",
    brand: "Lumen",
    price: 45,
    stock: 14,
    status: "Draft",
    tags: ["lighting"],
  },
  {
    id: "sunglasses",
    name: "Sunglasses",
    description: "Polarized UV400 sunglasses.",
    sku: "AC-SG-009",
    category: "Accessories",
    brand: "Northfold",
    price: 79,
    stock: 45,
    status: "Active",
    tags: ["summer"],
  },
  {
    id: "bluetooth-speaker",
    name: "Bluetooth Speaker",
    description: "Waterproof portable speaker with 12h playtime.",
    sku: "EL-BS-010",
    category: "Electronics",
    brand: "Soundwave",
    price: 59.99,
    stock: 3,
    status: "Active",
    tags: ["audio", "bluetooth", "outdoor"],
  },
  {
    id: "denim-jacket",
    name: "Denim Jacket",
    description: "Classic fit denim jacket.",
    sku: "AP-DJ-011",
    category: "Apparel",
    brand: "Basics Co.",
    price: 98,
    stock: 18,
    status: "Archived",
    tags: ["denim", "outerwear"],
  },
  {
    id: "water-bottle",
    name: "Water Bottle",
    description: "Insulated stainless steel bottle, 750ml.",
    sku: "SP-WB-012",
    category: "Sports",
    brand: "Pulse",
    price: 19.99,
    stock: 132,
    status: "Draft",
    tags: ["hydration"],
  },
]

export function getProduct(id: string) {
  return products.find((product) => product.id === id)
}

export function getProductByName(name: string) {
  return products.find((product) => product.name === name)
}

export type Category = {
  id: string
  name: string
  slug: string
  description: string
}

export const categories: Category[] = [
  {
    id: "electronics",
    name: "Electronics",
    slug: "electronics",
    description: "Audio, wearables and gadgets",
  },
  {
    id: "apparel",
    name: "Apparel",
    slug: "apparel",
    description: "Clothing and footwear",
  },
  {
    id: "accessories",
    name: "Accessories",
    slug: "accessories",
    description: "Bags, eyewear and more",
  },
  {
    id: "home-kitchen",
    name: "Home & Kitchen",
    slug: "home-kitchen",
    description: "Appliances and home essentials",
  },
  {
    id: "sports",
    name: "Sports",
    slug: "sports",
    description: "Fitness and outdoor gear",
  },
]

// Mirrors the Prisma `Brand` model. DateTime fields are ISO strings once
// serialized; `_count` matches Prisma's `include: { _count: { select: { products: true } } }`.
export type Brand = {
  id: string
  name: string
  slug: string
  logoUrl: string | null
  createdAt: string
  updatedAt: string
  _count: { products: number }
}

const brandSeed: Omit<Brand, "_count">[] = [
  {
    id: "0190f1a2-3b4c-7d5e-8f60-1a2b3c4d5e01",
    name: "Soundwave",
    slug: "soundwave",
    logoUrl: "/brands/soundwave.svg",
    createdAt: "2024-01-08T09:12:00.000Z",
    updatedAt: "2024-06-02T14:30:00.000Z",
  },
  {
    id: "0190f1a2-3b4c-7d5e-8f60-1a2b3c4d5e02",
    name: "Pulse",
    slug: "pulse",
    logoUrl: "/brands/pulse.svg",
    createdAt: "2024-01-15T11:40:00.000Z",
    updatedAt: "2024-05-21T08:05:00.000Z",
  },
  {
    id: "0190f1a2-3b4c-7d5e-8f60-1a2b3c4d5e03",
    name: "Stride",
    slug: "stride",
    logoUrl: null,
    createdAt: "2024-02-03T16:22:00.000Z",
    updatedAt: "2024-02-03T16:22:00.000Z",
  },
  {
    id: "0190f1a2-3b4c-7d5e-8f60-1a2b3c4d5e04",
    name: "Northfold",
    slug: "northfold",
    logoUrl: "/brands/northfold.svg",
    createdAt: "2024-02-19T10:00:00.000Z",
    updatedAt: "2024-06-11T12:48:00.000Z",
  },
  {
    id: "0190f1a2-3b4c-7d5e-8f60-1a2b3c4d5e05",
    name: "Basics Co.",
    slug: "basics-co",
    logoUrl: null,
    createdAt: "2024-03-07T13:15:00.000Z",
    updatedAt: "2024-04-30T09:20:00.000Z",
  },
  {
    id: "0190f1a2-3b4c-7d5e-8f60-1a2b3c4d5e06",
    name: "Barista Pro",
    slug: "barista-pro",
    logoUrl: null,
    createdAt: "2024-03-28T07:55:00.000Z",
    updatedAt: "2024-03-28T07:55:00.000Z",
  },
  {
    id: "0190f1a2-3b4c-7d5e-8f60-1a2b3c4d5e07",
    name: "Lumen",
    slug: "lumen",
    logoUrl: "/brands/lumen.svg",
    createdAt: "2024-04-12T15:10:00.000Z",
    updatedAt: "2024-06-18T17:02:00.000Z",
  },
  {
    id: "0190f1a2-3b4c-7d5e-8f60-1a2b3c4d5e08",
    name: "Terra Outdoor",
    slug: "terra-outdoor",
    logoUrl: null,
    createdAt: "2024-06-20T10:30:00.000Z",
    updatedAt: "2024-06-20T10:30:00.000Z",
  },
]

export const brands: Brand[] = brandSeed.map((brand) => ({
  ...brand,
  _count: {
    products: products.filter((p) => p.brand === brand.name).length,
  },
}))

export type Attribute = {
  id: string
  name: string
  values: string[]
}

export const attributes: Attribute[] = [
  { id: "size", name: "Size", values: ["XS", "S", "M", "L", "XL"] },
  {
    id: "color",
    name: "Color",
    values: ["Black", "White", "Navy", "Olive", "Red"],
  },
  { id: "material", name: "Material", values: ["Cotton", "Leather", "Denim"] },
  { id: "capacity", name: "Capacity", values: ["500ml", "750ml", "1L"] },
]

export type ReturnRequest = {
  id: string
  order: string
  customer: string
  product: string
  reason: string
  amount: number
  status: "Requested" | "Approved" | "Refunded" | "Rejected"
  date: string
}

export const returns: ReturnRequest[] = [
  {
    id: "RMA-1042",
    order: "#3204",
    customer: "Olivia Martin",
    product: "Running Shoes",
    reason: "Wrong size",
    amount: 89.95,
    status: "Requested",
    date: "2024-06-28",
  },
  {
    id: "RMA-1041",
    order: "#3198",
    customer: "Liam Johnson",
    product: "Bluetooth Speaker",
    reason: "Defective item",
    amount: 59.99,
    status: "Approved",
    date: "2024-06-26",
  },
  {
    id: "RMA-1040",
    order: "#3190",
    customer: "Ava Garcia",
    product: "Denim Jacket",
    reason: "Not as described",
    amount: 98,
    status: "Refunded",
    date: "2024-06-22",
  },
  {
    id: "RMA-1039",
    order: "#3185",
    customer: "Noah Wilson",
    product: "Smart Watch",
    reason: "Changed mind",
    amount: 249,
    status: "Rejected",
    date: "2024-06-19",
  },
  {
    id: "RMA-1038",
    order: "#3179",
    customer: "Emma Brown",
    product: "Cotton T-Shirt",
    reason: "Wrong size",
    amount: 49,
    status: "Refunded",
    date: "2024-06-15",
  },
  {
    id: "RMA-1037",
    order: "#3172",
    customer: "Harper Clark",
    product: "Espresso Machine",
    reason: "Arrived damaged",
    amount: 349,
    status: "Requested",
    date: "2024-06-12",
  },
]

export type AbandonedCart = {
  id: string
  customer: string
  email: string
  items: string[]
  value: number
  lastActive: string
  reminderSent: boolean
}

export const abandonedCarts: AbandonedCart[] = [
  {
    id: "cart-1",
    customer: "Mia Anderson",
    email: "mia.anderson@example.com",
    items: ["Smart Watch", "Water Bottle"],
    value: 268.99,
    lastActive: "2 hours ago",
    reminderSent: false,
  },
  {
    id: "cart-2",
    customer: "Ethan Thomas",
    email: "ethan.thomas@example.com",
    items: ["Espresso Machine"],
    value: 349,
    lastActive: "5 hours ago",
    reminderSent: true,
  },
  {
    id: "cart-3",
    customer: "Guest",
    email: "guest-8841@example.com",
    items: ["Yoga Mat", "Running Shoes", "Water Bottle"],
    value: 149.93,
    lastActive: "Yesterday",
    reminderSent: false,
  },
  {
    id: "cart-4",
    customer: "Sofia Davis",
    email: "sofia.davis@example.com",
    items: ["Leather Backpack"],
    value: 119,
    lastActive: "2 days ago",
    reminderSent: true,
  },
  {
    id: "cart-5",
    customer: "James Taylor",
    email: "james.taylor@example.com",
    items: ["Wireless Headphones", "Bluetooth Speaker"],
    value: 189.98,
    lastActive: "3 days ago",
    reminderSent: false,
  },
]

export const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
})

export function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}
