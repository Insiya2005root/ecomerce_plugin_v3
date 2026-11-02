import { apiRequest, sendJson } from "@/lib/request";
import type { ProductStatus } from "@/lib/products/types";

/** Stock that waited for a location; moves to the first location added. */
export const UNASSIGNED_LOCATION = "default";

export type InventoryItemRow = {
  levels?: { locationId: string; stocked: number; reserved: number; incoming: number }[];
  _id: string;
  productId: string;
  variantId: string;
  title: string;
  sku?: string;
  trackInventory: boolean;
  allowBackorder: boolean;
  requiresShipping: boolean;
  stocked: number;
  reserved: number;
  incoming: number;
  available: number;
  locations: number;
  productName: string;
  productStatus: ProductStatus | null;
  image: string | null;
  variantLabel: string | null;
  productExists: boolean;
  updatedAt: string;
};

export type InventoryLevel = {
  _id: string;
  itemId: string;
  locationId: string;
  locationName: string;
  stocked: number;
  reserved: number;
  incoming: number;
  available: number;
};

export type Reservation = {
  _id: string;
  itemId: string;
  locationId: string;
  locationName: string;
  quantity: number;
  orderId?: string;
  orderNumber?: string | null;
  description?: string;
  createdBy?: string;
  createdAt: string;
  itemTitle?: string;
  sku?: string | null;
};

export type Movement = {
  _id: string;
  type: string;
  locationId?: string;
  locationName?: string | null;
  stockedDelta: number;
  reservedDelta: number;
  stockedAfter?: number;
  reservedAfter?: number;
  reason?: string;
  note?: string;
  orderId?: string;
  orderNumber?: string | null;
  by?: string;
  createdAt: string;
};

export type ItemAttributes = {
  weight?: number;
  length?: number;
  width?: number;
  height?: number;
  hsCode?: string;
  midCode?: string;
  originCountry?: string;
  material?: string;
  unit?: string;
};

export type InventoryItemDetail = Omit<InventoryItemRow, "levels"> &
  ItemAttributes & {
    levels: InventoryLevel[];
    reservations: Reservation[];
    movements: Movement[];
  };

export type InventorySummary = { items: number; outOfStock: number; lowStock: number; reservedUnits: number; stockedUnits: number };

export type InventoryQuery = {
  search?: string;
  locationId?: string;
  stock?: "in" | "low" | "out" | "reserved" | "";
  productId?: string;
  sort?: "title" | "stocked" | "available" | "reserved" | "updatedAt";
  order?: "asc" | "desc";
  page: number;
  limit: number;
  /** Adds each location's numbers to every row (for the bulk stock editor). */
  includeLevels?: "1";
};

const qs = (q: Record<string, unknown>) => {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== "" && v !== null) params.set(k, String(v));
  return params.toString();
};

export const listInventory = (q: InventoryQuery, signal?: AbortSignal) =>
  apiRequest<{ items: InventoryItemRow[]; total: number; page: number; limit: number; summary: InventorySummary; lowStockThreshold: number }>(`/inventory?${qs(q)}`, { signal });
export const getInventoryItem = async (id: string) => (await apiRequest<{ item: InventoryItemDetail }>(`/inventory/${encodeURIComponent(id)}`)).item;
export const updateInventoryItem = (id: string, body: Partial<ItemAttributes & { requiresShipping: boolean; trackInventory: boolean; allowBackorder: boolean }> | Record<string, unknown>) =>
  sendJson("PUT", `/inventory/${encodeURIComponent(id)}`, body);
export const adjustStock = (id: string, body: { locationId: string; stocked?: number; delta?: number; incoming?: number; reason?: string; note?: string }) =>
  sendJson("POST", `/inventory/${encodeURIComponent(id)}/adjust`, body);
export const setItemLocations = (id: string, locationIds: string[]) => sendJson("PUT", `/inventory/${encodeURIComponent(id)}/locations`, { locationIds });
export const bulkUpdateStock = (updates: { itemId: string; locationId: string; stocked: number; incoming?: number }[]) =>
  sendJson<{ updated: number; errors: { itemId: string; locationId: string; message: string }[] }>("POST", "/inventory/bulk", { updates });

export const listReservations = (q: { search?: string; locationId?: string; kind?: "order" | "manual" | ""; page: number; limit: number }, signal?: AbortSignal) =>
  apiRequest<{ reservations: Reservation[]; total: number; page: number; limit: number }>(`/reservations?${qs(q)}`, { signal });
export const createReservation = (body: { itemId: string; locationId: string; quantity: number; description?: string }) => sendJson("POST", "/reservations", body);
export const updateReservation = (id: string, body: { quantity?: number; description?: string }) => sendJson("PUT", `/reservations/${encodeURIComponent(id)}`, body);
export const deleteReservation = (id: string) => sendJson("DELETE", `/reservations/${encodeURIComponent(id)}`);

export const MOVEMENT_LABEL: Record<string, string> = {
  adjustment: "Adjusted",
  received: "Received",
  product_edit: "Edited on product",
  migration: "Inventory created",
  order_reserved: "Reserved for order",
  order_fulfilled: "Fulfilled order",
  order_released: "Order cancelled",
  order_restocked: "Returned to shelf",
  reservation: "Manual reservation",
};

export const ADJUST_REASONS = ["Received", "Correction", "Damaged", "Lost", "Returned", "Stock count"];
