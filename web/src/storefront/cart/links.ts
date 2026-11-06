/**
 * Addresses of the storefront pages the plugin creates in OpenExt Pages (see StorefrontBlueprintService).
 * OpenExt serves pages at one-level slugs only, so the product page takes the product in ?slug=.
 */
export const storefrontLinks = {
  shop: () => '/shop',
  product: (slug: string) => `/product?slug=${encodeURIComponent(slug)}`,
  cart: () => '/cart',
  checkout: () => '/checkout',
};

/** The ?slug= of the current product page, if any. */
export function currentProductSlug(): string {
  if (typeof window === 'undefined') return '';
  return new URLSearchParams(window.location.search).get('slug')?.trim() || '';
}

export function formatInr(amount: number | null | undefined): string {
  const n = Number(amount) || 0;
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
}
