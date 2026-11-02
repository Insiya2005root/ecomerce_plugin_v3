import type { BuyXGetY, DiscountPayload, DiscountRule, SpendXGetY, TargetType } from "./types";

export type FormErrors = Partial<Record<string, string>>;
export type SavedStatus = "Active" | "Draft" | "Paused";

/** `<input type="datetime-local">` value (local time) for a stored ISO date. */
export function toLocalInput(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

const blank = (v: string) => v.trim() === "";
const num = (v: string) => Number(v.trim());
const optionalNumber = (v: string) => (blank(v) ? null : num(v));
const isNumber = (v: string) => !blank(v) && Number.isFinite(num(v));

/** Schedule, limits and stacking settings shared by every rule form. */
export type RuleSettings = {
  status: SavedStatus;
  startDate: string;
  endDate: string;
  usageLimit: string;
  minSubtotal: string;
  maxDiscountAmount: string;
  priority: string;
  exclusive: boolean;
};

export function settingsFromRule(rule?: Partial<DiscountRule>): RuleSettings {
  const status = rule?.status === "Draft" || rule?.status === "Paused" ? rule.status : "Active";
  return {
    status,
    startDate: toLocalInput(rule?.startDate),
    endDate: toLocalInput(rule?.endDate),
    usageLimit: rule?.usageLimit ? String(rule.usageLimit) : "",
    minSubtotal: rule?.minSubtotal ? String(rule.minSubtotal) : "",
    maxDiscountAmount: rule?.maxDiscountAmount ? String(rule.maxDiscountAmount) : "",
    priority: rule?.priority ? String(rule.priority) : "0",
    exclusive: rule?.stackingPolicy === "exclusive",
  };
}

export function validateSettings(s: RuleSettings, errors: FormErrors) {
  if (s.startDate && s.endDate && new Date(s.endDate) <= new Date(s.startDate)) errors.endDate = "End must be after the start.";
  if (!blank(s.usageLimit) && !(Number.isInteger(num(s.usageLimit)) && num(s.usageLimit) >= 1)) errors.usageLimit = "Whole number, 1 or more.";
  if (!blank(s.minSubtotal) && !(isNumber(s.minSubtotal) && num(s.minSubtotal) >= 0)) errors.minSubtotal = "Enter 0 or more.";
  if (!blank(s.maxDiscountAmount) && !(isNumber(s.maxDiscountAmount) && num(s.maxDiscountAmount) > 0)) errors.maxDiscountAmount = "Enter an amount above 0.";
  if (!Number.isInteger(num(s.priority || "0"))) errors.priority = "Whole number (higher applies first).";
}

export function settingsToPayload(s: RuleSettings): DiscountPayload {
  return {
    status: s.status,
    startDate: fromLocalInput(s.startDate),
    endDate: fromLocalInput(s.endDate),
    usageLimit: optionalNumber(s.usageLimit),
    minSubtotal: optionalNumber(s.minSubtotal),
    maxDiscountAmount: optionalNumber(s.maxDiscountAmount),
    priority: blank(s.priority) ? 0 : num(s.priority),
    stackingPolicy: s.exclusive ? "exclusive" : "allow",
  };
}

// ---- Automatic discounts and coupons ------------------------------------------------

export type OfferType = "percentage" | "fixed_amount" | "buy_x_get_y" | "spend_x_get_y";
export const OFFER_TYPES: OfferType[] = ["percentage", "fixed_amount", "buy_x_get_y", "spend_x_get_y"];

export type DiscountFormValues = RuleSettings & {
  name: string;
  code: string;
  type: OfferType;
  value: string;
  targetProductIds: string[];
  bogo: {
    buyTargetType: TargetType;
    buyTargetIds: string[];
    buyQuantity: string;
    rewardTargetType: Exclude<TargetType, "EntireStore">;
    rewardTargetIds: string[];
    rewardQuantity: string;
    rewardType: NonNullable<BuyXGetY["rewardType"]>;
    rewardValue: string;
    repeat: boolean;
  };
  spend: {
    minSpend: string;
    rewardType: NonNullable<SpendXGetY["rewardType"]>;
    rewardValue: string;
    rewardTargetIds: string[];
    maxDiscount: string;
    repeat: boolean;
  };
};

export function discountFromRule(rule?: DiscountRule): DiscountFormValues {
  // Legacy BOGO rules had no buyXGetY block: the engine treated targetProductIds as both the buy and reward products.
  const legacyBogo = rule?.type === "buy_x_get_y" && !rule.buyXGetY && (rule.targetProductIds?.length ?? 0) > 0;
  const b: BuyXGetY = legacyBogo
    ? { buyTargetType: "SpecificProduct", buyTargetIds: rule!.targetProductIds, rewardTargetType: "SpecificProduct", rewardTargetIds: rule!.targetProductIds }
    : rule?.buyXGetY ?? {};
  const s = rule?.spendXGetY ?? {};
  const type = (OFFER_TYPES as string[]).includes(rule?.type ?? "") ? (rule!.type as OfferType) : "percentage";
  return {
    ...settingsFromRule(rule),
    name: rule?.name ?? "",
    code: rule?.code ?? "",
    type,
    value: rule?.value !== undefined && rule?.value !== null ? String(rule.value) : "",
    targetProductIds: (rule?.targetProductIds ?? []).map(String),
    bogo: {
      buyTargetType: b.buyTargetType ?? "SpecificProduct",
      buyTargetIds: (b.buyTargetIds ?? []).map(String),
      buyQuantity: String(b.buyQuantity ?? 1),
      rewardTargetType: b.rewardTargetType ?? "SpecificProduct",
      rewardTargetIds: (b.rewardTargetIds ?? []).map(String),
      rewardQuantity: String(b.rewardQuantity ?? 1),
      rewardType: b.rewardType ?? "Free",
      rewardValue: String(b.rewardValue ?? 100),
      repeat: Boolean(b.repeat),
    },
    spend: {
      minSpend: s.minSpend !== undefined ? String(s.minSpend) : "",
      rewardType: s.rewardType ?? "FixedAmount",
      rewardValue: s.rewardValue !== undefined ? String(s.rewardValue) : "",
      rewardTargetIds: (s.rewardTargetIds ?? []).map(String),
      maxDiscount: s.maxDiscount ? String(s.maxDiscount) : "",
      repeat: Boolean(s.repeat),
    },
  };
}

export function validateDiscount(v: DiscountFormValues, coupon: boolean): FormErrors {
  const e: FormErrors = {};
  if (blank(v.name)) e.name = "Give the discount a name.";
  if (coupon) {
    if (blank(v.code)) e.code = "Enter the code customers will type.";
    else if (!/^[A-Za-z0-9_-]+$/.test(v.code.trim())) e.code = "Letters, numbers, - and _ only (no spaces).";
  }
  if (v.type === "percentage" && !(isNumber(v.value) && num(v.value) > 0 && num(v.value) <= 100)) e.value = "Enter a percentage between 0 and 100.";
  if (v.type === "fixed_amount" && !(isNumber(v.value) && num(v.value) > 0)) e.value = "Enter an amount above 0.";
  if (v.type === "buy_x_get_y") {
    const b = v.bogo;
    if (!(Number.isInteger(num(b.buyQuantity)) && num(b.buyQuantity) >= 1)) e["bogo.buyQuantity"] = "Whole number, 1 or more.";
    if (!(Number.isInteger(num(b.rewardQuantity)) && num(b.rewardQuantity) >= 1)) e["bogo.rewardQuantity"] = "Whole number, 1 or more.";
    if (b.buyTargetType !== "EntireStore" && b.buyTargetIds.length === 0) e["bogo.buyTargetIds"] = "Choose what the customer must buy.";
    if (b.rewardTargetIds.length === 0) e["bogo.rewardTargetIds"] = "Choose what the customer gets.";
    if (b.rewardType === "PercentageOff" && !(isNumber(b.rewardValue) && num(b.rewardValue) > 0 && num(b.rewardValue) <= 100)) e["bogo.rewardValue"] = "Between 0 and 100.";
    if (b.rewardType === "FixedAmountOff" && !(isNumber(b.rewardValue) && num(b.rewardValue) > 0)) e["bogo.rewardValue"] = "Enter an amount above 0.";
  }
  if (v.type === "spend_x_get_y") {
    const s = v.spend;
    if (!(isNumber(s.minSpend) && num(s.minSpend) > 0)) e["spend.minSpend"] = "Enter the minimum spend.";
    if (s.rewardType === "FreeProduct" && s.rewardTargetIds.length === 0) e["spend.rewardTargetIds"] = "Choose the free product.";
    if (s.rewardType === "Percentage" && !(isNumber(s.rewardValue) && num(s.rewardValue) > 0 && num(s.rewardValue) <= 100)) e["spend.rewardValue"] = "Between 0 and 100.";
    if (s.rewardType === "FixedAmount" && !(isNumber(s.rewardValue) && num(s.rewardValue) > 0)) e["spend.rewardValue"] = "Enter an amount above 0.";
    if (!blank(s.maxDiscount) && !(isNumber(s.maxDiscount) && num(s.maxDiscount) > 0)) e["spend.maxDiscount"] = "Enter an amount above 0.";
  }
  validateSettings(v, e);
  return e;
}

export function discountToPayload(v: DiscountFormValues, coupon: boolean): DiscountPayload {
  const payload: DiscountPayload = {
    ...settingsToPayload(v),
    name: v.name.trim(),
    type: v.type,
    isAutomatic: !coupon,
    ...(coupon ? { code: v.code.trim() } : {}),
    // Store-wide targeting is shown for percentage, amount and spend offers; Buy X Get Y has its own targets.
    targetProductIds: v.type === "buy_x_get_y" ? [] : v.targetProductIds,
  };
  if (v.type === "percentage" || v.type === "fixed_amount") payload.value = num(v.value);
  if (v.type === "buy_x_get_y") {
    const b = v.bogo;
    payload.buyXGetY = {
      buyTargetType: b.buyTargetType,
      buyTargetIds: b.buyTargetType === "EntireStore" ? [] : b.buyTargetIds,
      buyQuantity: num(b.buyQuantity),
      rewardTargetType: b.rewardTargetType,
      rewardTargetIds: b.rewardTargetIds,
      rewardQuantity: num(b.rewardQuantity),
      rewardType: b.rewardType,
      rewardValue: b.rewardType === "Free" ? 100 : num(b.rewardValue),
      repeat: b.repeat,
    };
  }
  if (v.type === "spend_x_get_y") {
    const s = v.spend;
    payload.spendXGetY = {
      minSpend: num(s.minSpend),
      rewardType: s.rewardType,
      rewardValue: s.rewardType === "FreeProduct" ? 0 : num(s.rewardValue),
      rewardTargetIds: s.rewardType === "FreeProduct" ? s.rewardTargetIds : [],
      maxDiscount: optionalNumber(s.maxDiscount),
      repeat: s.rewardType === "Percentage" ? false : s.repeat,
    };
  }
  return payload;
}
