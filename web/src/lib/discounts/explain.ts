import { formatMoney } from "@/lib/format";
import type { CustomAction, CustomCondition } from "./types";

export type NameLookup = { product: (id: string) => string; category: (id: string) => string };

const list = (ids: unknown, name: (id: string) => string) =>
  Array.isArray(ids) && ids.length ? ids.map((i) => name(String(i))).join(", ") : "—";

const OP: Record<string, string> = {
  "=": "is", ">": "is more than", ">=": "is at least", "<": "is less than", "<=": "is at most",
  Contains: "contains", "Does Not Contain": "doesn’t contain", "Any Of": "contains any of", "All Of": "contains all of",
  Is: "is", "Is Not": "is not", On: "is", Before: "is before", After: "is after",
};

/** Plain-English text for one custom-rule condition. */
export function explainCondition(c: CustomCondition, names: NameLookup): string {
  const between = (fmt: (v: unknown) => string) => (Array.isArray(c.value) ? `between ${fmt(c.value[0])} and ${fmt(c.value[1])}` : `${OP[c.operator ?? ""] ?? c.operator} ${fmt(c.value)}`);
  const plain = (v: unknown) => String(v ?? "");
  switch (c.type) {
    case "CartTotal":
      return `Cart total ${c.operator === "Between" ? between((v) => formatMoney(Number(v))) : `${OP[c.operator ?? ""] ?? c.operator} ${formatMoney(Number(c.value))}`}`;
    case "CartItemCount":
      return `Different items in cart ${c.operator === "Between" ? between(plain) : `${OP[c.operator ?? ""] ?? c.operator} ${plain(c.value)}`}`;
    case "TotalCartQuantity":
      return `Total quantity ${c.operator === "Between" ? between(plain) : `${OP[c.operator ?? ""] ?? c.operator} ${plain(c.value)}`}`;
    case "ProductQuantity":
      return `Quantity of ${c.product ? names.product(c.product) : "a product"} ${c.operator === "Between" ? between(plain) : `${OP[c.operator ?? ""] ?? c.operator} ${plain(c.value)}`}`;
    case "ProductInCart":
      return `Cart ${OP[c.operator ?? ""] ?? c.operator} ${list(c.value, names.product)}`;
    case "CategoryInCart":
      return `Cart ${OP[c.operator ?? ""] ?? c.operator} products from ${list(c.value, names.category)}`;
    case "DayOfWeek":
      return Array.isArray(c.value) ? `Day is ${c.value.join(", ")}` : `Day ${OP[c.operator ?? ""] ?? c.operator} ${plain(c.value)}`;
    case "Date":
      return `Date ${OP[c.operator ?? ""] ?? c.operator} ${plain(c.value)}`;
    case "DateRange": {
      const r = (c.value ?? {}) as { start?: string; end?: string };
      return `Date is between ${r.start ?? "?"} and ${r.end ?? "?"}`;
    }
    case "Time":
      return `Time ${c.operator === "Between" ? between(plain) : `${OP[c.operator ?? ""] ?? c.operator} ${plain(c.value)}`}`;
    case "Location":
      return `Shipping city is ${plain(c.value)}`;
    default:
      return c.type ?? "Condition";
  }
}

/** Plain-English text for one custom-rule action. */
export function explainAction(a: CustomAction, names: NameLookup): string {
  const scope =
    a.applyTo === "Category" ? ` on ${list(a.categoryIds, names.category)}` : a.applyTo === "SpecificProduct" || a.applyTo === "MultipleProducts" ? ` on ${list(a.productIds, names.product)}` : " on the whole cart";
  switch (a.type) {
    case "PercentageOff":
      return `${a.percentage ?? 0}% off${scope}${a.maxDiscount ? ` (max ${formatMoney(Number(a.maxDiscount))})` : ""}`;
    case "FixedAmountOff":
      return `${formatMoney(Number(a.amount ?? 0))} off${scope}`;
    case "FreeShipping":
      return "Free shipping";
    case "SetProductPrice":
      return `Set ${list(a.productIds, names.product)} to ${formatMoney(Number(a.newPrice ?? 0))}`;
    case "FreeProduct":
      return `${a.quantity ?? 1}× ${a.rewardProductId ? names.product(a.rewardProductId) : "product"} free${a.autoAdd ? " (added automatically)" : ""}`;
    default:
      return a.type;
  }
}

/** Every product id referenced by a condition tree / action list (to look their names up). */
export function referencedProductIds(tree?: CustomCondition, actions?: CustomAction[]): string[] {
  const out: string[] = [];
  const walk = (n?: CustomCondition) => {
    if (!n) return;
    n.conditions?.forEach(walk);
    if (n.type === "ProductInCart" && Array.isArray(n.value)) out.push(...n.value.map(String));
    if (n.type === "ProductQuantity" && n.product) out.push(n.product);
  };
  walk(tree);
  for (const a of actions ?? []) {
    out.push(...(a.productIds ?? []));
    if (a.rewardProductId) out.push(a.rewardProductId);
  }
  return out;
}
