import { apiRequest, sendJson } from "@/lib/request";
import type { Address } from "@/lib/orders/types";

// --- General ---
export type StoreSettings = {
  name: string;
  legalName: string;
  email: string;
  phone: string;
  gstin: string;
  address: Required<Address>;
  orderPrefix: string;
  lowStockThreshold: number;
};

export const getStore = () => apiRequest<{ store: StoreSettings; currency: { code: string; symbol: string } }>("/settings/store");
export const saveStore = async (store: Partial<StoreSettings>) => (await sendJson<{ store: StoreSettings }>("PUT", "/settings/store", store)).store;

// --- Profile ---
export type ProfileUser = { id: string; email: string; role: number | string | null; roleLabel: string | null };
export type Profile = { displayName: string; phone: string; jobTitle: string; dashboardDays: 7 | 30 | 90 };

export const getProfile = () => apiRequest<{ user: ProfileUser; profile: Profile }>("/profile");
export const saveProfile = async (profile: Partial<Profile>) => (await sendJson<{ profile: Profile }>("PUT", "/profile", profile)).profile;

// --- Tax & shipping (the shared settings document) ---
export type CoreSettings = {
  taxesEnabled: boolean;
  defaultTaxClassId?: string;
  pricesIncludeTax: boolean;
  taxShippingByDefault: boolean;
  displayTaxBreakdown: boolean;
  shippingMethod: "Flat" | "Distance";
  shippingRate: number;
  freeShippingThreshold: number;
  shippingRatePerKm: number;
  locationSelection: "Nearest" | "CustomerSelect";
  /** A store every distance is measured from; empty = nearest active store. */
  shipFromLocationId?: string;
  distanceRounding: "Exact" | "Nearest" | "Up";
  fallbackShippingCost: number;
};

export const getCoreSettings = async () => (await apiRequest<{ settings: CoreSettings }>("/settings")).settings;
export const saveCoreSettings = async (patch: Partial<CoreSettings>) => (await sendJson<{ settings: CoreSettings }>("POST", "/settings", patch)).settings;

export type ShippingTaxPolicy = "UseGlobal" | "Taxable" | "NonTaxable";
export type TaxClass = { _id: string; name: string; code: string; description?: string; status: "Active" | "Inactive"; shippingTaxPolicy: ShippingTaxPolicy };
export type TaxComponent = { label: string; rate: number };
export type TaxRule = {
  _id: string;
  name: string;
  taxClassId: string | TaxClass;
  country: string;
  state: string;
  postalScope: string;
  components: TaxComponent[];
  shippingTaxPolicy: ShippingTaxPolicy;
  priority: number;
  status: "Active" | "Inactive";
};
export type TaxRulePayload = Omit<TaxRule, "_id" | "taxClassId"> & { taxClassId: string };
export type TaxPreview = {
  taxesEnabled: boolean;
  taxClassId: string;
  pricesIncludeTax: boolean;
  rule: Pick<TaxRule, "_id" | "name" | "country" | "state" | "postalScope" | "components" | "priority"> | null;
  rate: number;
  amount: number;
  tax: number;
};

/** Seeds the Standard / Reduced / Zero-rated categories on first use and moves an old single tax rate into a rule. */
export const ensureTaxSetup = () => sendJson("POST", "/taxes/migrate");
export const listTaxClasses = () => apiRequest<{ classes: TaxClass[]; productCounts: Record<string, number> }>("/taxes/classes");
export const getTaxClass = async (id: string) => (await apiRequest<{ class: TaxClass }>(`/taxes/classes/${encodeURIComponent(id)}`)).class;
export const createTaxClass = async (body: Partial<TaxClass>) => (await sendJson<{ class: TaxClass }>("POST", "/taxes/classes", body)).class;
export const updateTaxClass = async (id: string, body: Partial<TaxClass>) => (await sendJson<{ class: TaxClass }>("PUT", `/taxes/classes/${encodeURIComponent(id)}`, body)).class;
export const listTaxRules = async () => (await apiRequest<{ rules: TaxRule[] }>("/taxes/rules")).rules;
export const createTaxRule = async (body: TaxRulePayload) => (await sendJson<{ rule: TaxRule }>("POST", "/taxes/rules", body)).rule;
export const updateTaxRule = async (id: string, body: TaxRulePayload) => (await sendJson<{ rule: TaxRule }>("PUT", `/taxes/rules/${encodeURIComponent(id)}`, body)).rule;
export const previewTax = async (body: { taxClassId: string; country?: string; state?: string; postalCode?: string; amount: number }) =>
  (await sendJson<{ preview: TaxPreview }>("POST", "/taxes/preview", body)).preview;

export const classIdOf = (rule: TaxRule) => (typeof rule.taxClassId === "string" ? rule.taxClassId : rule.taxClassId?._id);
export const totalRate = (components: TaxComponent[]) => Math.round(components.reduce((s, c) => s + (Number(c.rate) || 0), 0) * 1000) / 1000;

/** "Gujarat, India · PIN 395007" style scope label; "*" means any. */
export function scopeLabel(rule: Pick<TaxRule, "country" | "state" | "postalScope">) {
  const any = (v: string) => !v || v === "*";
  if (any(rule.country) && any(rule.state) && any(rule.postalScope)) return "Everywhere";
  const place = [any(rule.state) ? "" : rule.state, any(rule.country) ? "Any country" : rule.country].filter(Boolean).join(", ");
  return any(rule.postalScope) ? place : `${place} · PIN ${rule.postalScope}`;
}

export const SHIPPING_TAX_LABEL: Record<ShippingTaxPolicy, string> = {
  UseGlobal: "Store default",
  Taxable: "Taxed",
  NonTaxable: "Not taxed",
};

// --- Locations ---
export type Location = {
  _id: string;
  name: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  latitude?: number | null;
  longitude?: number | null;
  status: "Active" | "Inactive";
  priority: number;
  createdAt?: string;
  updatedAt?: string;
};
export type LocationPayload = Omit<Location, "_id" | "createdAt" | "updatedAt">;

export const listLocations = async () => (await apiRequest<{ locations: Location[] }>("/locations")).locations;
export const getLocation = (id: string) =>
  apiRequest<{ location: Location; orderCount: number; stock?: { items: number; stocked: number; reserved: number; incoming: number } }>(`/locations/${encodeURIComponent(id)}`);
export const createLocation = async (body: Partial<LocationPayload>) => (await sendJson<{ location: Location }>("POST", "/locations", body)).location;
export const updateLocation = async (id: string, body: Partial<LocationPayload>) => (await sendJson<{ location: Location }>("PUT", `/locations/${encodeURIComponent(id)}`, body)).location;
export const deleteLocation = (id: string) => sendJson("DELETE", `/locations/${encodeURIComponent(id)}`);

export const hasCoordinates = (l: Pick<Location, "latitude" | "longitude">) =>
  typeof l.latitude === "number" && typeof l.longitude === "number" && Number.isFinite(l.latitude) && Number.isFinite(l.longitude);

// --- Overview ---
export type SettingsOverview = {
  store: { name: string; email: string; gstin: string; orderPrefix: string };
  profile: { email: string; displayName: string } | null;
  tax: { enabled: boolean; pricesIncludeTax: boolean; classes: number; rules: number };
  shipping: { method: "Flat" | "Distance"; rate: number; ratePerKm: number; freeShippingThreshold: number };
  locations: { total: number; active: number };
};
export const getSettingsOverview = async () => (await apiRequest<{ overview: SettingsOverview }>("/settings/overview")).overview;

export const INDIAN_STATES = [
  "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chandigarh", "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jammu and Kashmir",
  "Jharkhand", "Karnataka", "Kerala", "Ladakh", "Lakshadweep", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya",
  "Mizoram", "Nagaland", "Odisha", "Puducherry", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura",
  "Uttar Pradesh", "Uttarakhand", "West Bengal",
];
