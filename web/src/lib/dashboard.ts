import { ApiError } from "@/lib/products/api";
import type { FulfillmentStatus, PaymentStatus } from "@/lib/orders/types";

export type DashboardRange = 7 | 30 | 90;

type LeanProduct = { _id: string; name: string; sku?: string; price: number; status: string; createdAt: string; image: string | null; stock?: number };

export type DashboardStats = {
  range: { days: DashboardRange; since: string; until: string; timeZone: string };
  sales: {
    revenue: number;
    orders: number;
    averageOrderValue: number;
    discountGiven: number;
    itemsSold: number;
    previous: { revenue: number; orders: number; averageOrderValue: number; discountGiven: number };
  };
  series: { date: string; revenue: number; orders: number }[];
  topProducts: { productId: string; name: string; image: string | null; quantity: number; revenue: number; exists: boolean }[];
  salesByCategory: { categoryId: string | null; name: string; revenue: number }[];
  attention: { unpaid: number; toFulfill: number; toShip: number };
  recentOrders: {
    _id: string;
    orderNumber: string;
    createdAt: string;
    customerName?: string;
    total: number;
    status: string;
    paymentStatus: PaymentStatus;
    fulfillmentStatus: FulfillmentStatus;
  }[];
  catalog: { products: number; published: number; draft: number; archived: number; categories: number; collections: number; activePromotions: number };
  newestProducts: LeanProduct[];
  lowStock: LeanProduct[];
  lowStockThreshold: number;
  customers: { total: number; active: number; newCustomers: number; returning: number; top: { email: string; name: string; orders: number; spent: number }[] };
};

/** Without a range the server uses the signed-in admin's saved default (Settings → Profile). */
export async function getDashboardStats(days: DashboardRange | null, signal?: AbortSignal): Promise<DashboardStats> {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  let res: Response;
  try {
    res = await fetch(`/api/plugins/ecommerce-plugin/dashboard/stats?${days ? `days=${days}&` : ""}tz=${encodeURIComponent(tz)}`, { cache: "no-store", signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new ApiError("Could not reach the server. Check your connection and try again.", 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) throw new ApiError(data.message || `Request failed (${res.status}).`, res.status);
  return data.stats;
}
