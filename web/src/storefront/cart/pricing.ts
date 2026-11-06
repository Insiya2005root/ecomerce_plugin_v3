import { useEffect, useState, useSyncExternalStore } from 'react';
import { useCart } from './cartStore';

const API_BASE = '/api/plugins/ecommerce-plugin';

export interface PricedItem {
  productId: string;
  variantId?: string;
  name: string;
  price: number;
  originalPrice?: number;
  quantity: number;
  isFreeGift?: boolean;
  isAutoAddedGift?: boolean;
}

export interface Pricing {
  subtotal: number;
  discount: number;
  shipping: number;
  tax: number;
  totalAmount: number;
  appliedDiscounts?: { name?: string; code?: string; amount?: number }[];
  progressNotices?: string[];
  shippingSnapshot?: { error?: string; freeShippingApplied?: boolean } | null;
}

export interface CartQuote {
  items: PricedItem[];
  pricing: Pricing;
  stockIssues: { productId: string; variantId?: string; name: string; requested: number; available: number }[];
}

export interface ShippingAddress {
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

/** Checkout page state shared by the form and summary blocks: the address (for shipping) and the placed order. */
export interface PlacedOrder {
  orderNumber: string;
  orderId: string;
  totalAmount: number;
  email: string;
  items: { name: string; quantity: number }[];
}
let checkout: { address?: ShippingAddress; placed?: PlacedOrder; placing?: boolean; step?: number } = {};
const checkoutListeners = new Set<() => void>();
export const checkoutState = {
  get: () => checkout,
  set(patch: Partial<typeof checkout>) {
    checkout = { ...checkout, ...patch };
    checkoutListeners.forEach((l) => l());
  },
  subscribe(cb: () => void) {
    checkoutListeners.add(cb);
    return () => checkoutListeners.delete(cb);
  },
};
export const useCheckoutState = () => useSyncExternalStore(checkoutState.subscribe, checkoutState.get, checkoutState.get);

// One request per distinct cart/coupon/address, shared by every block that asks for it.
const quotes = new Map<string, Promise<CartQuote>>();

function fetchQuote(key: string): Promise<CartQuote> {
  let pending = quotes.get(key);
  if (!pending) {
    pending = fetch(`${API_BASE}/cart/calculate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      credentials: 'same-origin',
      body: key,
    }).then(async (res) => {
      const body = await res.json().catch(() => null);
      if (!res.ok || !body || body.success === false) throw new Error(body?.message || 'Could not price the cart.');
      return { items: body.items || [], pricing: body.pricing, stockIssues: body.stockIssues || [] } as CartQuote;
    });
    pending.catch(() => quotes.delete(key));
    quotes.set(key, pending);
    if (quotes.size > 30) quotes.delete(quotes.keys().next().value as string);
  }
  return pending;
}

/** Server-calculated totals for the current cart (and the checkout address, when given). */
export function useCartQuote(address?: ShippingAddress) {
  const c = useCart();
  const hasAddress = Boolean(address?.postalCode || address?.city);
  const key = JSON.stringify({
    items: c.lines.map((l) => ({ productId: l.productId, variantId: l.variantId, quantity: l.quantity })),
    couponCode: c.coupon || undefined,
    customerAddress: hasAddress ? address : undefined,
  });
  const [result, setResult] = useState<{ key: string; quote?: CartQuote; error?: string } | null>(null);

  useEffect(() => {
    if (c.lines.length === 0) return;
    let live = true;
    fetchQuote(key).then(
      (quote) => live && setResult({ key, quote }),
      (err: Error) => live && setResult({ key, error: err.message })
    );
    return () => {
      live = false;
    };
  }, [key, c.lines.length]);

  if (c.lines.length === 0) return { empty: true as const, loading: false, quote: undefined, error: undefined };
  const current = result?.key === key ? result : undefined;
  // While a new quote loads, keep showing the previous numbers instead of flashing a spinner.
  return {
    empty: false as const,
    loading: !current,
    quote: current?.quote ?? result?.quote,
    error: current?.error,
  };
}

export async function placeStorefrontOrder(payload: unknown): Promise<{ orderId: string; orderNumber: string; totalAmount: number }> {
  const res = await fetch(`${API_BASE}/storefront/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body || body.success === false) throw new Error(body?.message || 'Could not place the order. Please try again.');
  return body;
}

export async function lookupPin(pin: string): Promise<{ city?: string; state?: string } | null> {
  const res = await fetch(`${API_BASE}/storefront/pincode?pin=${encodeURIComponent(pin)}`, { credentials: 'same-origin' });
  if (!res.ok) return null;
  const body = await res.json().catch(() => null);
  return body?.place ?? null;
}
