import { ApiError } from "@/lib/products/api";
import type { Address, CartCalculation, CartLine, Order, OrderListQuery } from "./types";

const API_BASE = "/api/plugins/ecommerce-plugin";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      cache: "no-store",
      ...init,
      headers: init?.body ? { "Content-Type": "application/json", ...init.headers } : init?.headers,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new ApiError("Could not reach the server. Check your connection and try again.", 0);
  }
  let data: { success?: boolean; message?: string } & Record<string, unknown>;
  try {
    data = await res.json();
  } catch {
    throw new ApiError(`Unexpected response from the server (${res.status}).`, res.status);
  }
  if (!res.ok || data.success === false) throw new ApiError(data.message || `Request failed (${res.status}).`, res.status);
  return data as T;
}

const post = <T>(path: string, body: unknown, signal?: AbortSignal) =>
  request<T>(path, { method: "POST", body: JSON.stringify(body ?? {}), signal });

export async function listOrders(query: OrderListQuery, signal?: AbortSignal) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== "") params.set(k, String(v));
  return request<{ orders: Order[]; total: number; page: number; limit: number }>(`/orders?${params}`, { signal });
}

export async function getOrder(id: string): Promise<Order> {
  return (await request<{ order: Order }>(`/orders/${encodeURIComponent(id)}`)).order;
}

const action = async (id: string, path: string, body?: unknown) =>
  (await post<{ order: Order }>(`/orders/${encodeURIComponent(id)}/${path}`, body)).order;

export const orderActions = {
  capture: (id: string, input: { method: string; reference?: string }) => action(id, "payment", { action: "capture", ...input }),
  refund: (id: string, input: { amount: number; reason?: string; note?: string }) => action(id, "payment", { action: "refund", ...input }),
  fulfill: (id: string) => action(id, "fulfillment", { action: "fulfill" }),
  ship: (id: string, input: { carrier?: string; trackingNumber?: string }) => action(id, "fulfillment", { action: "ship", ...input }),
  deliver: (id: string) => action(id, "fulfillment", { action: "deliver" }),
  cancel: (id: string) => action(id, "cancel"),
  addNote: (id: string, text: string) => action(id, "notes", { text }),
};

/** Prices a cart with the shared pipeline (discounts → shipping → tax) without creating anything. */
export async function calculateCart(
  input: { items: CartLine[]; couponCode?: string; customerAddress: Address; selectedLocationId?: string },
  signal?: AbortSignal
): Promise<CartCalculation> {
  return post<CartCalculation>("/cart/calculate", input, signal);
}

export async function placeOrder(input: {
  items: CartLine[];
  couponCode?: string;
  customerDetails: { name: string; email: string; phone?: string };
  customerAddress: Address;
  selectedLocationId?: string;
}): Promise<{ orderId: string; orderNumber: string }> {
  return post("/checkout", { ...input, source: "admin_cart" });
}
