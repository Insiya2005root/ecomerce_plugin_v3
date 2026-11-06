import { useSyncExternalStore } from 'react';
import { notify } from './notify';

/**
 * The shopper's cart, kept in this browser (localStorage) and shared by every storefront block on the page
 * (and across tabs). Lines hold ids and quantities plus a display snapshot; prices are always recalculated
 * by the server (POST /cart/calculate), so a stored price is never trusted.
 */
export interface CartLine {
  productId: string;
  variantId?: string;
  quantity: number;
  name: string;
  variantLabel?: string;
  image?: string | null;
  slug?: string;
}

export interface CartState {
  lines: CartLine[];
  coupon: string;
}

const STORAGE_KEY = 'ecommerce-storefront-cart';
const EMPTY: CartState = { lines: [], coupon: '' };
const MAX_QTY = 99;

let state: CartState = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

function load(): CartState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw);
    const lines = Array.isArray(parsed?.lines)
      ? parsed.lines.filter((l: any) => l && typeof l.productId === 'string' && Number(l.quantity) > 0)
      : [];
    return { lines, coupon: typeof parsed?.coupon === 'string' ? parsed.coupon : '' };
  } catch {
    return EMPTY;
  }
}

function ensureLoaded() {
  if (loaded || typeof window === 'undefined') return;
  loaded = true;
  state = load();
  window.addEventListener('storage', (e) => {
    if (e.key !== STORAGE_KEY) return;
    state = load();
    listeners.forEach((l) => l());
  });
}

function commit(next: CartState) {
  state = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage unavailable (private mode): the cart lasts for this page only.
  }
  listeners.forEach((l) => l());
}

const sameLine = (a: { productId: string; variantId?: string }, b: { productId: string; variantId?: string }) =>
  a.productId === b.productId && (a.variantId || '') === (b.variantId || '');

export const cart = {
  get(): CartState {
    ensureLoaded();
    return state;
  },
  subscribe(cb: () => void) {
    ensureLoaded();
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
  add(line: CartLine) {
    ensureLoaded();
    const existing = state.lines.find((l) => sameLine(l, line));
    const lines = existing
      ? state.lines.map((l) => (l === existing ? { ...l, quantity: Math.min(MAX_QTY, l.quantity + line.quantity) } : l))
      : [...state.lines, { ...line, quantity: Math.min(MAX_QTY, line.quantity) }];
    commit({ ...state, lines });
  },
  setQuantity(target: { productId: string; variantId?: string }, quantity: number) {
    ensureLoaded();
    const q = Math.max(0, Math.min(MAX_QTY, Math.floor(quantity)));
    const lines = q === 0
      ? state.lines.filter((l) => !sameLine(l, target))
      : state.lines.map((l) => (sameLine(l, target) ? { ...l, quantity: q } : l));
    commit({ ...state, lines });
  },
  remove(target: { productId: string; variantId?: string }) {
    cart.setQuantity(target, 0);
  },
  setCoupon(code: string) {
    ensureLoaded();
    commit({ ...state, coupon: code.trim().toUpperCase() });
  },
  clear() {
    ensureLoaded();
    commit(EMPTY);
  },
  count(): number {
    return cart.get().lines.reduce((n, l) => n + l.quantity, 0);
  },
};

/**
 * The slide-out mini cart lives in the store header. Other blocks open it after "Add to cart";
 * when the page has no header (hostCount 0) they show their own inline confirmation instead.
 */
let drawerOpen = false;
let drawerHosts = 0;
const drawerListeners = new Set<() => void>();
export const cartDrawer = {
  isOpen: () => drawerOpen,
  hasHost: () => drawerHosts > 0,
  setOpen(open: boolean) {
    drawerOpen = open;
    drawerListeners.forEach((l) => l());
  },
  registerHost() {
    drawerHosts += 1;
    return () => {
      drawerHosts -= 1;
    };
  },
  subscribe(cb: () => void) {
    drawerListeners.add(cb);
    return () => drawerListeners.delete(cb);
  },
};
export const useCartDrawerOpen = () => useSyncExternalStore(cartDrawer.subscribe, cartDrawer.isOpen, () => false);

export function useCart(): CartState {
  return useSyncExternalStore(cart.subscribe, cart.get, () => EMPTY);
}

/**
 * "Add to cart" from a product tile: products with sizes/colours open their page to choose one; others go
 * straight in, then the mini cart opens (or, on pages without a cart button, a short notice shows).
 */
export function addProductToCart(product: { id: string; name: string; slug?: string; image?: string | null; variants: unknown[] }) {
  if (product.variants.length > 0) {
    window.location.href = `/product?slug=${encodeURIComponent(product.slug || product.id)}`;
    return;
  }
  cart.add({ productId: product.id, quantity: 1, name: product.name, image: product.image, slug: product.slug || product.id });
  if (cartDrawer.hasHost()) cartDrawer.setOpen(true);
  else notify(`${product.name} added to your cart.`, { label: 'View cart', href: '/cart' });
}
