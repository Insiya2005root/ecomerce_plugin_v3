// Admin pages are separate static-export HTML files served by OpenExt inside its iframe.
const ADMIN_BASE = "/plugins/ecommerce-plugin/ui/admin";

export const productUrls = {
  list: (query?: string) => `${ADMIN_BASE}/products/index.html${query ? `?${query}` : ""}`,
  create: () => `${ADMIN_BASE}/products/add/index.html`,
  detail: (id: string) => `${ADMIN_BASE}/products/detail/index.html?id=${encodeURIComponent(id)}`,
  edit: (id: string) => `${ADMIN_BASE}/products/edit/index.html?id=${encodeURIComponent(id)}`,
};

export const collectionUrls = {
  list: () => `${ADMIN_BASE}/collections/index.html`,
  detail: (id: string) => `${ADMIN_BASE}/collections/detail/index.html?id=${encodeURIComponent(id)}`,
};

export const orderUrls = {
  list: () => `${ADMIN_BASE}/orders/index.html`,
  detail: (id: string) => `${ADMIN_BASE}/orders/detail/index.html?id=${encodeURIComponent(id)}`,
};

export const inventoryUrls = {
  list: (query?: string) => `${ADMIN_BASE}/inventory/index.html${query ? `?${query}` : ""}`,
  detail: (id: string) => `${ADMIN_BASE}/inventory/detail/index.html?id=${encodeURIComponent(id)}`,
  stock: () => `${ADMIN_BASE}/inventory/stock/index.html`,
  reservations: () => `${ADMIN_BASE}/inventory/reservations/index.html`,
};

export const customerUrls = {
  list: () => `${ADMIN_BASE}/customers/index.html`,
  detail: (email: string) => `${ADMIN_BASE}/customers/detail/index.html?email=${encodeURIComponent(email)}`,
};

export const settingsUrls = {
  overview: () => `${ADMIN_BASE}/settings/index.html`,
  general: () => `${ADMIN_BASE}/settings/general/index.html`,
  profile: () => `${ADMIN_BASE}/settings/profile/index.html`,
  tax: () => `${ADMIN_BASE}/settings/tax/index.html`,
  taxClass: (id: string) => `${ADMIN_BASE}/settings/tax/detail/index.html?id=${encodeURIComponent(id)}`,
  shipping: () => `${ADMIN_BASE}/settings/shipping/index.html`,
  locations: () => `${ADMIN_BASE}/settings/locations/index.html`,
  location: (id: string) => `${ADMIN_BASE}/settings/locations/detail/index.html?id=${encodeURIComponent(id)}`,
};

export const cartUrl = () => `${ADMIN_BASE}/cart/index.html`;

export const categoryUrls = {
  list: () => `${ADMIN_BASE}/categories/index.html`,
  detail: (id: string) => `${ADMIN_BASE}/categories/detail/index.html?id=${encodeURIComponent(id)}`,
};

/** Remembers the list filters so "Products" breadcrumbs return to the same view. */
const LIST_STATE_KEY = "ecommerce-products-list-query";

export function rememberListQuery(query: string) {
  try {
    sessionStorage.setItem(LIST_STATE_KEY, query);
  } catch {
    // Storage can be unavailable in sandboxed iframes; filters simply reset.
  }
}

export function productListUrl(): string {
  try {
    return productUrls.list(sessionStorage.getItem(LIST_STATE_KEY) || undefined);
  } catch {
    return productUrls.list();
  }
}
