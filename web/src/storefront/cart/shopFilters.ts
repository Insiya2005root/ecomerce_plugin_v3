import { useSyncExternalStore } from 'react';

/**
 * Category / search / sort / price range chosen in the shop filter, shared with the product grid on the same
 * page and kept in the address (?category=&q=&sort=&price=) so a filtered shop link can be shared or reloaded.
 * The grid also reports how many products match, for the shop header and the filter's results bar.
 */
export type ShopSort = 'newest' | 'price_asc' | 'price_desc' | 'name_asc';
export interface ShopFilters {
  category: string;
  q: string;
  sort: ShopSort | '';
  /** "min-max" in rupees; either side may be empty ("2500-" = 2500 and up). */
  price: string;
  total: number | null;
}

const SORTS: ShopSort[] = ['newest', 'price_asc', 'price_desc', 'name_asc'];
const PRICE_RE = /^(\d{0,7})-(\d{0,7})$/;

/** Turns "500-1000" into bounds for the products API. */
export function priceBounds(price: string): { minPrice?: number; maxPrice?: number } {
  const m = PRICE_RE.exec(price || '');
  if (!m) return {};
  return { ...(m[1] ? { minPrice: Number(m[1]) } : {}), ...(m[2] ? { maxPrice: Number(m[2]) } : {}) };
}

function fromUrl(): ShopFilters {
  if (typeof window === 'undefined') return { category: '', q: '', sort: '', price: '', total: null };
  const p = new URLSearchParams(window.location.search);
  const sort = p.get('sort') as ShopSort;
  const price = p.get('price') || '';
  return {
    category: /^[a-f0-9]{24}$/i.test(p.get('category') || '') ? (p.get('category') as string) : '',
    q: (p.get('q') || '').slice(0, 100),
    sort: SORTS.includes(sort) ? sort : '',
    price: PRICE_RE.test(price) && price !== '-' ? price : '',
    total: null,
  };
}

let state: ShopFilters | null = null;
const listeners = new Set<() => void>();
const current = () => (state ??= fromUrl());

export const shopFilters = {
  get: current,
  subscribe(cb: () => void) {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
  set(patch: Partial<Omit<ShopFilters, 'total'>>) {
    state = { ...current(), ...patch };
    const p = new URLSearchParams(window.location.search);
    for (const key of ['category', 'q', 'sort', 'price'] as const) {
      const v = state[key];
      if (v) p.set(key, v);
      else p.delete(key);
    }
    const qs = p.toString();
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${qs ? `?${qs}` : ''}`);
    listeners.forEach((l) => l());
  },
  clear() {
    shopFilters.set({ category: '', q: '', price: '' });
  },
  setTotal(total: number) {
    if (current().total === total) return;
    state = { ...current(), total };
    listeners.forEach((l) => l());
  },
};

export const useShopFilters = () => useSyncExternalStore(shopFilters.subscribe, shopFilters.get, shopFilters.get);

/**
 * Price ranges for the filter, from the block setting "0-500, 500-1000, 1000-2500, 2500+".
 * Labels read "Under ₹500", "₹500 – ₹1,000", "₹2,500 & above".
 */
export function parsePriceRanges(spec: string): { value: string; label: string }[] {
  const money = (n: number) => `₹${n.toLocaleString('en-IN')}`;
  return String(spec || '')
    .split(',')
    .map((part) => part.trim())
    .flatMap((part) => {
      const plus = /^(\d{1,7})\s*\+$/.exec(part);
      if (plus) return [{ value: `${plus[1]}-`, label: `${money(Number(plus[1]))} & above` }];
      const range = /^(\d{1,7})\s*-\s*(\d{1,7})$/.exec(part);
      if (!range) return [];
      const [lo, hi] = [Number(range[1]), Number(range[2])];
      if (hi <= lo) return [];
      return [{ value: lo === 0 ? `-${hi}` : `${lo}-${hi}`, label: lo === 0 ? `Under ${money(hi)}` : `${money(lo)} – ${money(hi)}` }];
    })
    .slice(0, 8);
}
