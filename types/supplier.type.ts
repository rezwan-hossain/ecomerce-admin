export interface Supplier {
  id: string;
  code: string; // e.g. "SUP-003": uppercase letters, digits and hyphens
  name: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  company: string | null;
  website: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  paymentTerms: string | null; // e.g. "Net 30"
  leadTimeDays: number | null;
  isActive: boolean; // no DELETE: a supplier is retired with isActive: false
  note: string | null;
  createdAt: string;
  updatedAt: string;
  _count: { batches: number; purchaseOrders: number }; // deliveries and orders that point at this supplier
}

// Fields left out are untouched; the API rejects "" for contactEmail and website, so blanks are sent as undefined.
export type SupplierDto = Partial<Omit<Supplier, "id" | "createdAt" | "updatedAt" | "_count">>;
