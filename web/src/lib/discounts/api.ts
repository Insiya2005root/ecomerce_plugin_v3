import { ApiError } from "@/lib/products/api";
import type { DiscountPayload, DiscountRule, DiscountUsage } from "./types";

const API_BASE = "/api/plugins/ecommerce-plugin";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      cache: "no-store",
      ...init,
      headers: init?.body ? { "Content-Type": "application/json", ...init.headers } : init?.headers,
    });
  } catch {
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

/** All non-archived rules (the backend has no server-side filtering; lists filter in the browser). */
export async function listDiscounts(): Promise<DiscountRule[]> {
  return (await request<{ rules: DiscountRule[] }>("/discounts")).rules ?? [];
}

export async function getDiscount(id: string): Promise<DiscountRule> {
  return (await request<{ rule: DiscountRule }>(`/discounts/${encodeURIComponent(id)}`)).rule;
}

export async function createDiscount(payload: DiscountPayload): Promise<DiscountRule> {
  return (await request<{ rule: DiscountRule }>("/discounts", { method: "POST", body: JSON.stringify(payload) })).rule;
}

export async function updateDiscount(id: string, payload: DiscountPayload): Promise<DiscountRule> {
  return (await request<{ rule: DiscountRule }>(`/discounts/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(payload) })).rule;
}

/** Rules used by past orders are archived instead of deleted (backend decides). */
export async function deleteDiscount(id: string): Promise<{ archived: boolean; message?: string }> {
  return request<{ archived: boolean; message?: string }>(`/discounts/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function getDiscountUsage(id: string): Promise<DiscountUsage> {
  return (await request<{ usage: DiscountUsage }>(`/discounts/${encodeURIComponent(id)}/usage`)).usage;
}

/** Copies a rule as a Draft. Coupon codes must be unique, so the copy gets a new suffixed code. */
export async function duplicateDiscount(rule: DiscountRule): Promise<DiscountRule> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { _id, createdAt, updatedAt, usedCount, ...rest } = rule as DiscountRule & { __v?: number };
  delete (rest as { __v?: number }).__v;
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return createDiscount({
    ...rest,
    name: `${rule.name} (copy)`,
    status: "Draft",
    ...(rule.code ? { code: `${rule.code}-${suffix}` } : {}),
  });
}
