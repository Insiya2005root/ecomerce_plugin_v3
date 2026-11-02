export const ORDER_STATUSES = ["Pending", "Processing", "Shipped", "Delivered", "Cancelled"] as const;
export const PAYMENT_STATUSES = ["Not paid", "Paid", "Partially refunded", "Refunded"] as const;
export const FULFILLMENT_STATUSES = ["Not fulfilled", "Fulfilled", "Shipped", "Delivered"] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export type FulfillmentStatus = (typeof FULFILLMENT_STATUSES)[number];

export type Address = {
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
};

/** A discount the DiscountEngine applied to the whole cart (also stored on the order). */
export type AppliedDiscount = {
  ruleId?: string;
  name?: string;
  ruleName?: string;
  type?: string;
  code?: string;
  amount?: number;
  isFreeGift?: boolean;
  rewardProductName?: string;
};

export type OrderItem = {
  _id?: string;
  productId: string;
  variantId?: string;
  sku?: string;
  name: string;
  price: number;
  originalPrice?: number;
  discountPercentage?: number;
  quantity: number;
  isFreeGift?: boolean;
  isAutoAddedGift?: boolean;
  appliedDiscounts?: { ruleId?: string; amount?: number }[];
};

export type TaxLine = { label?: string; rate?: number; taxAmount?: number };

export type Pricing = {
  subtotal: number;
  discount: number;
  shipping: number;
  tax: number;
  totalAmount: number;
  appliedDiscounts?: AppliedDiscount[];
  progressNotices?: string[];
  taxSnapshot?: { taxLines?: TaxLine[]; configurationErrors?: string[] } | null;
  shippingSnapshot?: {
    shippingMethod?: string;
    originName?: string;
    originAddress?: string;
    actualDistance?: number;
    billableDistance?: number;
    freeShippingApplied?: boolean;
    error?: string;
  } | null;
  availableLocations?: { locationId: string; name: string; address: string; distanceKm: number; shippingCost: number }[];
};

export type OrderEvent = { type: string; message: string; at: string };

export type Order = {
  _id: string;
  orderNumber: string;
  source: "admin_cart" | "storefront" | "manual";
  customerDetails: { name: string; email: string; phone?: string; address: string };
  shippingAddress?: Address;
  items: OrderItem[];
  pricing: Pricing;
  couponCode?: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  payment: { method?: string; reference?: string; capturedAmount: number; capturedAt?: string; refundedAmount: number };
  refunds: { amount: number; reason?: string; note?: string; at: string }[];
  fulfillmentStatus: FulfillmentStatus;
  fulfillment: { carrier?: string; trackingNumber?: string; fulfilledAt?: string; shippedAt?: string; deliveredAt?: string };
  canceledAt?: string;
  notes: { text: string; at: string }[];
  events: OrderEvent[];
  createdAt: string;
  updatedAt: string;
};

export type OrderListQuery = {
  search?: string;
  status?: string;
  paymentStatus?: string;
  fulfillmentStatus?: string;
  sort?: "createdAt" | "total";
  order?: "asc" | "desc";
  page: number;
  limit: number;
};

export type CartLine = { productId: string; variantId?: string; quantity: number };

export type CartCalculation = {
  items: OrderItem[];
  pricing: Pricing;
  stockIssues: { productId: string; variantId?: string; name: string; requested: number; available: number }[];
};
