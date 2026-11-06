import { adminUrl } from "@/lib/router";

// Each sidebar section is an OpenExt runtime page (/dashboard/plugins/runtime/ecommerce-plugin/<navId>);
// screens inside it are picked with ?view=…
export const productUrls = {
  list: (query?: string) => adminUrl("ecommerce-products", undefined, undefined, query),
  create: () => adminUrl("ecommerce-products", "add"),
  detail: (id: string) => adminUrl("ecommerce-products", "detail", { id }),
  edit: (id: string) => adminUrl("ecommerce-products", "edit", { id }),
};

export const collectionUrls = {
  list: () => adminUrl("ecommerce-collections"),
  detail: (id: string) => adminUrl("ecommerce-collections", "detail", { id }),
};

export const orderUrls = {
  list: () => adminUrl("ecommerce-orders"),
  detail: (id: string) => adminUrl("ecommerce-orders", "detail", { id }),
};

export const inventoryUrls = {
  list: (query?: string) => adminUrl("ecommerce-inventory", undefined, undefined, query),
  detail: (id: string) => adminUrl("ecommerce-inventory", "detail", { id }),
  stock: () => adminUrl("ecommerce-inventory", "stock"),
  reservations: () => adminUrl("ecommerce-inventory-reservations"),
};

export const customerUrls = {
  list: () => adminUrl("ecommerce-customers"),
  detail: (email: string) => adminUrl("ecommerce-customers", "detail", { email }),
};

export const settingsUrls = {
  overview: () => adminUrl("ecommerce-settings"),
  general: () => adminUrl("ecommerce-settings-general"),
  profile: () => adminUrl("ecommerce-settings-profile"),
  tax: () => adminUrl("ecommerce-settings-tax"),
  taxClass: (id: string) => adminUrl("ecommerce-settings-tax", "detail", { id }),
  shipping: () => adminUrl("ecommerce-settings-shipping"),
  locations: () => adminUrl("ecommerce-settings-locations"),
  location: (id: string) => adminUrl("ecommerce-settings-locations", "detail", { id }),
};

export const cartUrl = () => adminUrl("ecommerce-cart");

export const categoryUrls = {
  list: () => adminUrl("ecommerce-categories"),
  detail: (id: string) => adminUrl("ecommerce-categories", "detail", { id }),
};

/** Remembers the list filters so "Products" breadcrumbs return to the same view. */
const LIST_STATE_KEY = "ecommerce-products-list-query";

export function rememberListQuery(query: string) {
  try {
    sessionStorage.setItem(LIST_STATE_KEY, query);
  } catch {
    // Storage can be unavailable; filters simply reset.
  }
}

export function productListUrl(): string {
  try {
    return productUrls.list(sessionStorage.getItem(LIST_STATE_KEY) || undefined);
  } catch {
    return productUrls.list();
  }
}
