import type { StatusTone } from "@/components/admin/StatusBadge";
import { formatMoney } from "@/lib/format";
import type { CustomCondition, DiscountRule } from "./types";

const ADMIN_BASE = "/plugins/ecommerce-plugin/ui/admin";

/** The four Promotions tabs. Rules are split by type/automatic flag exactly as the original pages did. */
export type PromotionTab = "automatic" | "coupons" | "campaigns" | "custom";

export function tabOf(rule: Pick<DiscountRule, "type" | "isAutomatic">): PromotionTab {
  if (rule.type === "campaign") return "campaigns";
  if (rule.type === "custom") return "custom";
  return rule.isAutomatic ? "automatic" : "coupons";
}

const TAB_DIR: Record<PromotionTab, string> = { automatic: "all", coupons: "coupons", campaigns: "campaigns", custom: "custom" };

export const TAB_META: Record<PromotionTab, { label: string; singular: string; description: string }> = {
  automatic: { label: "Automatic discounts", singular: "automatic discount", description: "Offers that apply on their own when a cart qualifies." },
  coupons: { label: "Coupons", singular: "coupon", description: "Codes customers enter at checkout." },
  campaigns: { label: "Campaigns", singular: "campaign", description: "Group discounts into a sale with storefront messaging." },
  custom: { label: "Custom rules", singular: "custom rule", description: "Condition-based rules: cart totals, days, times, cities and more." },
};

export const promotionUrls = {
  overview: () => `${ADMIN_BASE}/discounts/index.html`,
  list: (tab: PromotionTab) => `${ADMIN_BASE}/discounts/${TAB_DIR[tab]}/index.html`,
  create: (tab: PromotionTab) => `${ADMIN_BASE}/discounts/${TAB_DIR[tab]}/add/index.html`,
  edit: (rule: Pick<DiscountRule, "_id" | "type" | "isAutomatic">) => `${ADMIN_BASE}/discounts/${TAB_DIR[tabOf(rule)]}/edit/index.html?id=${encodeURIComponent(rule._id)}`,
  detail: (id: string) => `${ADMIN_BASE}/discounts/detail/index.html?id=${encodeURIComponent(id)}`,
};

export type LiveStatus = "Active" | "Scheduled" | "Expired" | "Limit reached" | "Paused" | "Draft" | "Archived";

/** What the rule is doing right now, combining its saved status with its dates and usage limit. */
export function liveStatus(rule: DiscountRule, now = new Date()): LiveStatus {
  if (rule.status !== "Active") return rule.status;
  if (rule.startDate && new Date(rule.startDate) > now) return "Scheduled";
  if (rule.endDate && new Date(rule.endDate) < now) return "Expired";
  if (rule.usageLimit && (rule.usedCount ?? 0) >= rule.usageLimit) return "Limit reached";
  return "Active";
}

export const LIVE_STATUS_TONE: Record<LiveStatus, StatusTone> = {
  Active: "green",
  Scheduled: "blue",
  Expired: "grey",
  "Limit reached": "orange",
  Paused: "orange",
  Draft: "grey",
  Archived: "grey",
};

export const TYPE_LABEL: Record<string, string> = {
  percentage: "Percentage off",
  fixed_amount: "Amount off",
  buy_x_get_y: "Buy X get Y",
  spend_x_get_y: "Spend X get Y",
  free_gift: "Free gift",
  campaign: "Campaign",
  custom: "Custom rule",
};

const target = (type: string | undefined, ids: string[] | undefined, names?: (ids: string[], type?: string) => string) => {
  const n = ids?.length ?? 0;
  if (!type || type === "EntireStore") return "any product";
  if (names && n) return names(ids!, type);
  if (type === "Category") return n === 1 ? "1 category" : `${n} categories`;
  return n === 1 ? "1 product" : `${n} products`;
};

/** One-line, human-readable summary of what a rule gives. */
export function describeRule(rule: DiscountRule, names?: (ids: string[], type?: string) => string): string {
  switch (rule.type) {
    case "percentage":
      return `${rule.value ?? 0}% off${rule.targetProductIds?.length ? ` ${target("MultipleProducts", rule.targetProductIds, names)}` : " the order"}`;
    case "fixed_amount":
      return `${formatMoney(rule.value ?? 0)} off${rule.targetProductIds?.length ? ` ${target("MultipleProducts", rule.targetProductIds, names)}` : " the order"}`;
    case "buy_x_get_y": {
      const b = rule.buyXGetY ?? {};
      const reward =
        b.rewardType === "PercentageOff" ? `${b.rewardValue ?? 0}% off` : b.rewardType === "FixedAmountOff" ? `${formatMoney(b.rewardValue ?? 0)} off` : "free";
      return `Buy ${b.buyQuantity ?? 1} from ${target(b.buyTargetType, b.buyTargetIds, names)}, get ${b.rewardQuantity ?? 1} from ${target(b.rewardTargetType, b.rewardTargetIds, names)} ${reward}${b.repeat ? " (repeats)" : ""}`;
    }
    case "spend_x_get_y": {
      const s = rule.spendXGetY ?? {};
      const reward =
        s.rewardType === "Percentage" ? `${s.rewardValue ?? 0}% off` : s.rewardType === "FreeProduct" ? `a free ${target("MultipleProducts", s.rewardTargetIds, names)}` : `${formatMoney(s.rewardValue ?? 0)} off`;
      return `Spend ${formatMoney(s.minSpend ?? 0)}, get ${reward}${s.maxDiscount ? ` (max ${formatMoney(s.maxDiscount)})` : ""}${s.repeat ? ", repeats" : ""}`;
    }
    case "campaign": {
      const n = rule.campaign?.childRuleIds?.length ?? 0;
      return `${n} discount${n === 1 ? "" : "s"}${rule.campaign?.marketingHeading ? ` · “${rule.campaign.marketingHeading}”` : ""}`;
    }
    case "custom": {
      const conds = countConditions(rule.customConfig?.conditionTree);
      const acts = rule.customConfig?.actions?.length ?? 0;
      return `${conds} condition${conds === 1 ? "" : "s"} · ${acts} action${acts === 1 ? "" : "s"}`;
    }
    default:
      return TYPE_LABEL[rule.type] ?? rule.type;
  }
}

function countConditions(node: CustomCondition | undefined): number {
  if (!node) return 0;
  if (Array.isArray(node.conditions)) return node.conditions.reduce((n, c) => n + countConditions(c), 0);
  return node.type ? 1 : 0;
}

const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });

export function scheduleLabel(rule: Pick<DiscountRule, "startDate" | "endDate">): string {
  const start = rule.startDate ? dateFmt.format(new Date(rule.startDate)) : null;
  const end = rule.endDate ? dateFmt.format(new Date(rule.endDate)) : null;
  if (start && end) return `${start} – ${end}`;
  if (end) return `Until ${end}`;
  if (start) return `From ${start}`;
  return "Always on";
}
