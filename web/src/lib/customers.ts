import { apiRequest } from "@/lib/request";
import type { Address, FulfillmentStatus, OrderStatus, PaymentStatus } from "@/lib/orders/types";

export const CUSTOMER_SEGMENTS = ["Returning", "New", "One-time", "No purchases"] as const;
export type CustomerSegment = (typeof CUSTOMER_SEGMENTS)[number];

/** A customer as derived from orders: one per email address. */
export type Customer = {
  key: string;
  name: string;
  email: string;
  phone: string | null;
  city: string | null;
  orders: number;
  validOrders: number;
  cancelledOrders: number;
  totalSpent: number;
  averageOrderValue: number;
  firstOrderAt: string;
  lastOrderAt: string;
  segment: CustomerSegment;
};

export type CustomerDetail = Customer & {
  refunded: number;
  discountTotal: number;
  outstanding: number;
  otherNames: string[];
  addresses: (Address & { orders: number; lastUsedAt: string })[];
  topProducts: { productId: string; name: string; quantity: number; spent: number }[];
  discounts: { ruleId: string | null; name: string; code: string | null; uses: number; amount: number }[];
  recentOrders: {
    _id: string;
    orderNumber: string;
    createdAt: string;
    total: number;
    items: number;
    status: OrderStatus;
    paymentStatus: PaymentStatus;
    fulfillmentStatus: FulfillmentStatus;
    couponCode: string | null;
  }[];
};

export type CustomerListQuery = {
  search?: string;
  segment?: string;
  sort?: "lastOrderAt" | "totalSpent" | "orders" | "name" | "firstOrderAt";
  order?: "asc" | "desc";
  page: number;
  limit: number;
};

export type CustomerSummary = { customers: number; returning: number; newCustomers: number; newCustomerDays: number };

export async function listCustomers(query: CustomerListQuery, signal?: AbortSignal) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== "") params.set(k, String(v));
  return apiRequest<{ customers: Customer[]; total: number; page: number; limit: number; summary: CustomerSummary }>(`/customers?${params}`, { signal });
}

export async function getCustomer(email: string): Promise<CustomerDetail> {
  return (await apiRequest<{ customer: CustomerDetail }>(`/customers/lookup?email=${encodeURIComponent(email)}`)).customer;
}
