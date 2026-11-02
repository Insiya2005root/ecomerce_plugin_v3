"use client";

import * as React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, Delete02Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { AffixInput, SelectField, TextInput, type SelectOption } from "@/components/admin/fields";
import { CategoryMultiSelect, ProductMultiSelect } from "@/components/discounts/TargetPickers";
import { CURRENCY_SYMBOL } from "@/lib/format";
import type { CustomAction, CustomCondition } from "@/lib/discounts/types";
import type { Category } from "@/lib/products/types";
import { cn } from "@/lib/utils";

// ---- Conditions ---------------------------------------------------------------------

const NUMERIC = ["CartTotal", "CartItemCount", "TotalCartQuantity", "ProductQuantity"];
const CONDITION_TYPES: SelectOption[] = [
  { value: "CartTotal", label: "Cart total" },
  { value: "CartItemCount", label: "Number of different items" },
  { value: "TotalCartQuantity", label: "Total quantity in cart" },
  { value: "ProductInCart", label: "Products in cart" },
  { value: "CategoryInCart", label: "Categories in cart" },
  { value: "ProductQuantity", label: "Quantity of a product" },
  { value: "DayOfWeek", label: "Day of the week" },
  { value: "Date", label: "Date" },
  { value: "DateRange", label: "Date range" },
  { value: "Time", label: "Time of day" },
  { value: "Location", label: "Shipping city" },
];
const OPERATORS: Record<string, string[]> = {
  numeric: ["=", ">", ">=", "<", "<=", "Between"],
  membership: ["Contains", "Does Not Contain", "Any Of", "All Of"],
  DayOfWeek: ["Is", "Is Not", "Any Of"],
  Date: ["On", "Before", "After"],
  Time: ["Before", "After", "Between"],
};
const OPERATOR_LABEL: Record<string, string> = {
  "=": "equals", ">": "is more than", ">=": "is at least", "<": "is less than", "<=": "is at most", Between: "is between",
  Contains: "contains", "Does Not Contain": "doesn’t contain", "Any Of": "is any of", "All Of": "contains all of",
  Is: "is", "Is Not": "is not", On: "is on", Before: "is before", After: "is after",
};
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function operatorsFor(type?: string): string[] {
  if (!type) return [];
  if (NUMERIC.includes(type)) return OPERATORS.numeric;
  if (type === "ProductInCart" || type === "CategoryInCart") return OPERATORS.membership;
  return OPERATORS[type] ?? [];
}

function defaultCondition(type = "CartTotal"): CustomCondition {
  switch (type) {
    case "ProductInCart":
    case "CategoryInCart":
      return { type, operator: "Contains", value: [] };
    case "ProductQuantity":
      return { type, operator: ">=", value: "", product: "" };
    case "DayOfWeek":
      return { type, operator: "Is", value: "Saturday" };
    case "Date":
      return { type, operator: "On", value: "" };
    case "DateRange":
      return { type, value: { start: "", end: "" } };
    case "Time":
      return { type, operator: "After", value: "" };
    case "Location":
      return { type, locationField: "City", value: "" };
    default:
      return { type, operator: ">=", value: "" };
  }
}

/** Shape of a condition's value for a given operator; switching shape resets the value. */
function valueShape(type: string | undefined, op: string | undefined): "pair" | "list" | "single" {
  if (op === "Between") return "pair";
  if (type === "DayOfWeek" && op === "Any Of") return "list";
  return "single";
}
const EMPTY_VALUE = { pair: ["", ""], list: [] as string[], single: "" };

const asArray = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);
const asPair = (v: unknown): [string, string] => (Array.isArray(v) ? [String(v[0] ?? ""), String(v[1] ?? "")] : [String(v ?? ""), ""]);

function ConditionRow({
  node,
  onChange,
  onRemove,
  categories,
  path,
}: {
  node: CustomCondition;
  onChange: (n: CustomCondition) => void;
  onRemove: () => void;
  categories: Category[];
  path: string;
}) {
  const ops = operatorsFor(node.type);
  const id = `cond-${path}`;
  const setValue = (value: unknown) => onChange({ ...node, value });
  const isNumeric = NUMERIC.includes(node.type ?? "");
  const money = node.type === "CartTotal";

  let valueEditor: React.ReactNode = null;
  if (isNumeric) {
    valueEditor =
      node.operator === "Between" ? (
        <div className="flex items-center gap-1.5">
          <AffixInput id={`${id}-a`} aria-label="From" {...(money ? { prefix: CURRENCY_SYMBOL } : {})} value={asPair(node.value)[0]} onChange={(e) => setValue([e.target.value, asPair(node.value)[1]])} className="w-28" />
          <span className="text-xs text-muted-foreground">and</span>
          <AffixInput id={`${id}-b`} aria-label="To" {...(money ? { prefix: CURRENCY_SYMBOL } : {})} value={asPair(node.value)[1]} onChange={(e) => setValue([asPair(node.value)[0], e.target.value])} className="w-28" />
        </div>
      ) : (
        <AffixInput id={`${id}-value`} aria-label="Value" {...(money ? { prefix: CURRENCY_SYMBOL } : {})} value={String(node.value ?? "")} onChange={(e) => setValue(e.target.value)} className="w-32" />
      );
  } else if (node.type === "ProductInCart") {
    valueEditor = <ProductMultiSelect id={`${id}-value`} value={asArray(node.value)} onChange={setValue} />;
  } else if (node.type === "CategoryInCart") {
    valueEditor = <CategoryMultiSelect id={`${id}-value`} value={asArray(node.value)} onChange={setValue} categories={categories} />;
  } else if (node.type === "DayOfWeek") {
    valueEditor =
      node.operator === "Any Of" ? (
        <div className="flex flex-wrap gap-1">
          {DAYS.map((d) => {
            const on = asArray(node.value).includes(d);
            return (
              <button key={d} type="button" aria-pressed={on} onClick={() => setValue(on ? asArray(node.value).filter((x) => x !== d) : [...asArray(node.value), d])} className={cn("h-7 rounded-md border px-2 text-xs", on ? "border-foreground bg-foreground text-background" : "hover:bg-muted")}>
                {d.slice(0, 3)}
              </button>
            );
          })}
        </div>
      ) : (
        <SelectField id={`${id}-value`} value={typeof node.value === "string" ? node.value : "Saturday"} options={DAYS.map((d) => ({ value: d, label: d }))} onChange={setValue} className="w-36" />
      );
  } else if (node.type === "Date") {
    valueEditor = <TextInput id={`${id}-value`} type="date" aria-label="Date" value={String(node.value ?? "")} onChange={(e) => setValue(e.target.value)} className="w-40" />;
  } else if (node.type === "DateRange") {
    const range = (node.value ?? {}) as { start?: string; end?: string };
    valueEditor = (
      <div className="flex items-center gap-1.5">
        <TextInput id={`${id}-start`} type="date" aria-label="From" value={range.start ?? ""} onChange={(e) => setValue({ ...range, start: e.target.value })} className="w-40" />
        <span className="text-xs text-muted-foreground">to</span>
        <TextInput id={`${id}-end`} type="date" aria-label="To" value={range.end ?? ""} onChange={(e) => setValue({ ...range, end: e.target.value })} className="w-40" />
      </div>
    );
  } else if (node.type === "Time") {
    valueEditor =
      node.operator === "Between" ? (
        <div className="flex items-center gap-1.5">
          <TextInput id={`${id}-a`} type="time" aria-label="From" value={asPair(node.value)[0]} onChange={(e) => setValue([e.target.value, asPair(node.value)[1]])} className="w-28" />
          <span className="text-xs text-muted-foreground">and</span>
          <TextInput id={`${id}-b`} type="time" aria-label="To" value={asPair(node.value)[1]} onChange={(e) => setValue([asPair(node.value)[0], e.target.value])} className="w-28" />
        </div>
      ) : (
        <TextInput id={`${id}-value`} type="time" aria-label="Time" value={String(node.value ?? "")} onChange={(e) => setValue(e.target.value)} className="w-28" />
      );
  } else if (node.type === "Location") {
    valueEditor = <TextInput id={`${id}-value`} aria-label="City" placeholder="e.g. Surat" value={String(node.value ?? "")} onChange={(e) => onChange({ ...node, locationField: "City", value: e.target.value })} className="w-44" />;
  }

  return (
    <div className="flex flex-wrap items-start gap-2 rounded-md border bg-background p-2.5">
      <SelectField id={`${id}-type`} value={node.type ?? "CartTotal"} options={CONDITION_TYPES} onChange={(t) => onChange(defaultCondition(t))} className="w-52" />
      {node.type === "ProductQuantity" && (
        <div className="min-w-56 flex-1">
          <ProductMultiSelect id={`${id}-product`} value={node.product ? [node.product] : []} onChange={(ids) => onChange({ ...node, product: ids[0] ?? "" })} single placeholder="Choose the product…" />
        </div>
      )}
      {ops.length > 0 && (
        <SelectField
          id={`${id}-op`}
          value={node.operator ?? ops[0]}
          options={ops.map((o) => ({ value: o, label: OPERATOR_LABEL[o] ?? o }))}
          onChange={(op) => {
            const before = valueShape(node.type, node.operator);
            const after = valueShape(node.type, op);
            // Membership operators keep their product/category list; other shape changes start fresh.
            const keep = before === after || node.type === "ProductInCart" || node.type === "CategoryInCart";
            onChange({ ...node, operator: op, ...(keep ? {} : { value: EMPTY_VALUE[after] }) });
          }}
          className="w-40"
        />
      )}
      <div className={cn("min-w-0", (node.type === "ProductInCart" || node.type === "CategoryInCart") && "w-full sm:w-auto sm:flex-1")}>{valueEditor}</div>
      <Button type="button" variant="ghost" size="icon-sm" className="ml-auto rounded-md text-muted-foreground hover:text-destructive" aria-label="Remove condition" onClick={onRemove}>
        <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
      </Button>
    </div>
  );
}

/** Nested ALL/ANY condition groups, stored as { operator: 'AND' | 'OR', conditions: [...] }. */
export function ConditionGroup({
  node,
  onChange,
  onRemove,
  categories,
  depth = 0,
  path = "0",
}: {
  node: CustomCondition;
  onChange: (n: CustomCondition) => void;
  onRemove?: () => void;
  categories: Category[];
  depth?: number;
  path?: string;
}) {
  const children = node.conditions ?? [];
  const update = (i: number, child: CustomCondition) => onChange({ ...node, conditions: children.map((c, j) => (j === i ? child : c)) });
  const remove = (i: number) => onChange({ ...node, conditions: children.filter((_, j) => j !== i) });
  return (
    <div className={cn("space-y-2 rounded-lg border p-3", depth % 2 === 0 ? "bg-muted/30" : "bg-background")}>
      <div className="flex flex-wrap items-center gap-2 text-[13px]">
        <span>Match</span>
        <div role="radiogroup" aria-label="Match" className="inline-flex rounded-md border bg-background p-0.5">
          {(["AND", "OR"] as const).map((op) => (
            <button key={op} type="button" role="radio" aria-checked={node.operator === op} onClick={() => onChange({ ...node, operator: op })} className={cn("h-6 rounded px-2.5 text-xs font-medium", node.operator === op ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>
              {op === "AND" ? "All" : "Any"}
            </button>
          ))}
        </div>
        <span className="text-muted-foreground">of these conditions{children.length === 0 ? " (none means always)" : ""}</span>
        {onRemove && (
          <Button type="button" variant="ghost" size="sm" className="ml-auto h-7 rounded-md text-muted-foreground hover:text-destructive" onClick={onRemove}>
            Remove group
          </Button>
        )}
      </div>
      {children.map((child, i) =>
        child.operator === "AND" || child.operator === "OR" ? (
          <ConditionGroup key={i} node={child} onChange={(c) => update(i, c)} onRemove={() => remove(i)} categories={categories} depth={depth + 1} path={`${path}-${i}`} />
        ) : (
          <ConditionRow key={i} node={child} onChange={(c) => update(i, c)} onRemove={() => remove(i)} categories={categories} path={`${path}-${i}`} />
        )
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" className="h-7 rounded-md" onClick={() => onChange({ ...node, conditions: [...children, defaultCondition()] })}>
          <HugeiconsIcon icon={Add01Icon} strokeWidth={2} data-icon="inline-start" />
          Add condition
        </Button>
        {depth < 2 && (
          <Button type="button" variant="ghost" size="sm" className="h-7 rounded-md" onClick={() => onChange({ ...node, conditions: [...children, { operator: "OR", conditions: [] }] })}>
            Add group
          </Button>
        )}
      </div>
    </div>
  );
}

// ---- Actions ------------------------------------------------------------------------

const ACTION_TYPES: SelectOption[] = [
  { value: "PercentageOff", label: "Percentage off" },
  { value: "FixedAmountOff", label: "Amount off" },
  { value: "FreeShipping", label: "Free shipping" },
  { value: "SetProductPrice", label: "Set a product’s price" },
  { value: "FreeProduct", label: "Free product" },
];
const APPLY_TO: SelectOption[] = [
  { value: "EntireCart", label: "the whole cart" },
  { value: "MultipleProducts", label: "selected products" },
  { value: "Category", label: "products in categories" },
];

export function defaultAction(type: CustomAction["type"] = "PercentageOff"): CustomAction {
  switch (type) {
    case "PercentageOff":
      return { type, percentage: 10, applyTo: "EntireCart" };
    case "FixedAmountOff":
      return { type, amount: 100, applyTo: "EntireCart" };
    case "SetProductPrice":
      return { type, productIds: [], newPrice: 0 };
    case "FreeProduct":
      return { type, rewardProductId: "", quantity: 1, autoAdd: true };
    default:
      return { type };
  }
}

export function ActionRow({
  action,
  onChange,
  onRemove,
  categories,
  index,
  errors,
}: {
  action: CustomAction;
  onChange: (a: CustomAction) => void;
  onRemove: () => void;
  categories: Category[];
  index: number;
  errors: Partial<Record<string, string>>;
}) {
  const id = `action-${index}`;
  const numberInput = (field: "percentage" | "amount" | "newPrice" | "quantity" | "maxDiscount", props: { prefix?: string; suffix?: string; label: string; placeholder?: string }) => (
    <AffixInput
      id={`${id}-${field}`}
      aria-label={props.label}
      prefix={props.prefix}
      suffix={props.suffix}
      placeholder={props.placeholder}
      value={action[field] === undefined || action[field] === null ? "" : String(action[field])}
      onChange={(e) => onChange({ ...action, [field]: e.target.value === "" ? undefined : (e.target.value as unknown as number) })}
      className="w-28"
    />
  );
  const scope = (action.applyTo === "SpecificProduct" ? "MultipleProducts" : action.applyTo) ?? "EntireCart";
  return (
    <div className="space-y-2 rounded-md border bg-background p-3">
      <div className="flex flex-wrap items-center gap-2 text-[13px]">
        <SelectField id={`${id}-type`} value={action.type} options={ACTION_TYPES} onChange={(t) => onChange(defaultAction(t as CustomAction["type"]))} className="w-48" />
        {action.type === "PercentageOff" && numberInput("percentage", { suffix: "%", label: "Percentage" })}
        {action.type === "FixedAmountOff" && numberInput("amount", { prefix: CURRENCY_SYMBOL, label: "Amount" })}
        {(action.type === "PercentageOff" || action.type === "FixedAmountOff") && (
          <>
            <span className="text-muted-foreground">on</span>
            <SelectField id={`${id}-scope`} value={scope} options={APPLY_TO} onChange={(v) => onChange({ ...action, applyTo: v as CustomAction["applyTo"], productIds: [], categoryIds: [] })} className="w-48" />
          </>
        )}
        {action.type === "SetProductPrice" && (
          <>
            <span className="text-muted-foreground">to</span>
            {numberInput("newPrice", { prefix: CURRENCY_SYMBOL, label: "New price" })}
          </>
        )}
        {action.type === "FreeProduct" && (
          <>
            {numberInput("quantity", { label: "Quantity" })}
            <label className="flex items-center gap-1.5 text-xs">
              <input type="checkbox" className="accent-foreground" checked={Boolean(action.autoAdd)} onChange={(e) => onChange({ ...action, autoAdd: e.target.checked })} />
              Add to cart automatically
            </label>
          </>
        )}
        <Button type="button" variant="ghost" size="icon-sm" className="ml-auto rounded-md text-muted-foreground hover:text-destructive" aria-label="Remove action" onClick={onRemove}>
          <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
        </Button>
      </div>
      {(action.type === "PercentageOff" || action.type === "FixedAmountOff") && scope === "MultipleProducts" && (
        <ProductMultiSelect id={`${id}-products`} value={action.productIds ?? []} onChange={(ids) => onChange({ ...action, productIds: ids })} />
      )}
      {(action.type === "PercentageOff" || action.type === "FixedAmountOff") && scope === "Category" && (
        <CategoryMultiSelect id={`${id}-categories`} value={action.categoryIds ?? []} onChange={(ids) => onChange({ ...action, categoryIds: ids })} categories={categories} />
      )}
      {action.type === "PercentageOff" && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          Cap this action at {numberInput("maxDiscount", { prefix: CURRENCY_SYMBOL, label: "Action cap", placeholder: "No cap" })}
        </div>
      )}
      {action.type === "SetProductPrice" && <ProductMultiSelect id={`${id}-products`} value={action.productIds ?? []} onChange={(ids) => onChange({ ...action, productIds: ids })} placeholder="Products to reprice…" />}
      {action.type === "FreeProduct" && (
        <ProductMultiSelect id={`${id}-reward`} value={action.rewardProductId ? [action.rewardProductId] : []} onChange={(ids) => onChange({ ...action, rewardProductId: ids[0] ?? "" })} single placeholder="Choose the free product…" />
      )}
      {action.type === "FreeShipping" && <p className="text-xs text-muted-foreground">Shipping is charged at ₹0 when this rule applies.</p>}
      {errors[id] && <p className="text-xs text-destructive">{errors[id]}</p>}
    </div>
  );
}
