"use client";

import * as React from "react";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { GiftIcon, PercentIcon, ShoppingBag01Icon, Tag01Icon } from "@hugeicons/core-free-icons";
import { AffixInput, Field, SelectField, TextInput, type SelectOption } from "@/components/admin/fields";
import { SectionCard } from "@/components/admin/SectionCard";
import { InlineError } from "@/components/admin/StateViews";
import { toast } from "@/components/admin/toast";
import { CodeChip, DiscountStatusBadge } from "@/components/discounts/PromotionBits";
import { FormFooter, ScheduleFields, StackingFields, StatusSwitch, useDirtyGuard } from "@/components/discounts/RuleSettingsFields";
import { CategoryMultiSelect, ProductMultiSelect } from "@/components/discounts/TargetPickers";
import { useProductReferenceData } from "@/components/products/useProductReferenceData";
import { focusFirstError } from "@/components/products/ProductForm";
import { CURRENCY_SYMBOL } from "@/lib/format";
import { ApiError } from "@/lib/products/api";
import { createDiscount, updateDiscount } from "@/lib/discounts/api";
import { describeRule, promotionUrls, scheduleLabel } from "@/lib/discounts/describe";
import { discountToPayload, validateDiscount, type DiscountFormValues, type FormErrors, type OfferType } from "@/lib/discounts/form";
import type { DiscountRule, TargetType } from "@/lib/discounts/types";
import { cn } from "@/lib/utils";

const TYPE_CARDS: { type: OfferType; title: string; text: string; icon: IconSvgElement; accent: string }[] = [
  { type: "percentage", title: "Percentage off", text: "e.g. 10% off the order or selected products", icon: PercentIcon, accent: "text-sky-600 bg-sky-50 dark:bg-sky-500/10 dark:text-sky-400" },
  { type: "fixed_amount", title: "Amount off", text: "e.g. ₹200 off the order", icon: Tag01Icon, accent: "text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-400" },
  { type: "buy_x_get_y", title: "Buy X get Y", text: "e.g. buy 2 shirts, get a mug free", icon: GiftIcon, accent: "text-violet-600 bg-violet-50 dark:bg-violet-500/10 dark:text-violet-400" },
  { type: "spend_x_get_y", title: "Spend X get Y", text: "e.g. spend ₹5,000, get ₹500 off", icon: ShoppingBag01Icon, accent: "text-amber-600 bg-amber-50 dark:bg-amber-500/10 dark:text-amber-400" },
];

const BUY_TARGETS: SelectOption[] = [
  { value: "SpecificProduct", label: "A specific product" },
  { value: "MultipleProducts", label: "Any of several products" },
  { value: "Category", label: "Products in categories" },
  { value: "EntireStore", label: "Anything in the store" },
];
const REWARD_TARGETS = BUY_TARGETS.filter((t) => t.value !== "EntireStore");
const BOGO_REWARDS: SelectOption[] = [
  { value: "Free", label: "Free" },
  { value: "PercentageOff", label: "Percentage off" },
  { value: "FixedAmountOff", label: "Amount off" },
];
const SPEND_REWARDS: SelectOption[] = [
  { value: "FixedAmount", label: "Amount off" },
  { value: "Percentage", label: "Percentage off" },
  { value: "FreeProduct", label: "A free product" },
];

function Targets({
  id,
  type,
  ids,
  onChange,
  error,
  categories,
}: {
  id: string;
  type: TargetType;
  ids: string[];
  onChange: (ids: string[]) => void;
  error?: string;
  categories: Parameters<typeof CategoryMultiSelect>[0]["categories"];
}) {
  if (type === "EntireStore") return null;
  return (
    <Field id={id} label={type === "Category" ? "Categories" : type === "SpecificProduct" ? "Product" : "Products"} error={error}>
      {type === "Category" ? (
        <CategoryMultiSelect id={id} value={ids} onChange={onChange} categories={categories} invalid={Boolean(error)} />
      ) : (
        <ProductMultiSelect id={id} value={ids} onChange={onChange} single={type === "SpecificProduct"} invalid={Boolean(error)} />
      )}
    </Field>
  );
}

/** Create / edit form for automatic discounts and coupons (same engine options; coupons add a code). */
export function DiscountForm({ mode, rule, initial, coupon }: { mode: "create" | "edit"; rule?: DiscountRule; initial: DiscountFormValues; coupon: boolean }) {
  const { categories } = useProductReferenceData();
  const [values, setValues] = React.useState(initial);
  const [errors, setErrors] = React.useState<FormErrors>({});
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [dirty, setDirty] = React.useState(false);
  const allowLeave = useDirtyGuard(dirty);

  const set = (patch: Partial<DiscountFormValues>) => {
    setValues((v) => ({ ...v, ...patch }));
    setDirty(true);
    setErrors({});
  };
  const setBogo = (patch: Partial<DiscountFormValues["bogo"]>) => set({ bogo: { ...values.bogo, ...patch } });
  const setSpend = (patch: Partial<DiscountFormValues["spend"]>) => set({ spend: { ...values.spend, ...patch } });

  // Live summary of what will be saved (half-typed numbers read as 0 until valid).
  const preview = { ...(rule ?? {}), ...discountToPayload(values, coupon), _id: rule?._id ?? "preview", usedCount: rule?.usedCount ?? 0 } as DiscountRule;
  const listTab = coupon ? "coupons" : "automatic";
  const cancelHref = rule ? promotionUrls.detail(rule._id) : promotionUrls.list(listTab);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const found = validateDiscount(values, coupon);
    setErrors(found);
    if (Object.keys(found).length) {
      setSubmitError("Fix the highlighted fields to continue.");
      focusFirstError(found);
      return;
    }
    setSaving(true);
    setSubmitError(null);
    try {
      const payload = discountToPayload(values, coupon);
      const saved = mode === "create" ? await createDiscount(payload) : await updateDiscount(rule!._id, payload);
      allowLeave();
      toast.flash(mode === "create" ? "Discount created" : "Discount saved", saved.name);
      window.location.href = promotionUrls.detail(saved._id);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not save.";
      if (err instanceof ApiError && err.status === 409) setErrors({ code: message });
      setSubmitError(message);
      setSaving(false);
    }
  };

  const showTargets = values.type !== "buy_x_get_y";

  return (
    <form onSubmit={submit} noValidate className="space-y-4 pb-20">
      {submitError && <InlineError message={submitError} />}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-4">
          <SectionCard title="Type" bodyClassName="grid gap-2 p-5 sm:grid-cols-2">
            {TYPE_CARDS.map((c) => (
              <button
                key={c.type}
                type="button"
                onClick={() => set({ type: c.type })}
                aria-pressed={values.type === c.type}
                className={cn(
                  "flex items-start gap-3 rounded-lg border p-3 text-left transition-all",
                  values.type === c.type ? "border-foreground/60 ring-1 ring-foreground/20" : "hover:border-foreground/30 hover:bg-muted/30"
                )}
              >
                <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-md", c.accent)}>
                  <HugeiconsIcon icon={c.icon} strokeWidth={1.75} className="size-4" />
                </span>
                <span>
                  <span className="block text-[13px] font-medium">{c.title}</span>
                  <span className="block text-xs text-muted-foreground">{c.text}</span>
                </span>
              </button>
            ))}
          </SectionCard>

          <SectionCard title="Details" bodyClassName="grid gap-4 p-5 sm:grid-cols-2">
            <Field id="name" label="Name" error={errors.name} hint="Shown on orders and in reports." className={coupon ? "" : "sm:col-span-2"}>
              <TextInput id="name" value={values.name} error={errors.name} placeholder="e.g. Summer sale" onChange={(e) => set({ name: e.target.value })} />
            </Field>
            {coupon && (
              <Field id="code" label="Code" error={errors.code} hint="What customers type at checkout (not case sensitive).">
                <TextInput id="code" value={values.code} error={errors.code} placeholder="SUMMER20" className="font-mono uppercase" onChange={(e) => set({ code: e.target.value.replace(/\s/g, "") })} />
              </Field>
            )}
            <div className="sm:col-span-2">
              <p className="mb-1.5 text-[13px] font-medium">Status</p>
              <StatusSwitch values={values} onChange={set} />
            </div>
          </SectionCard>

          <SectionCard title="Offer" bodyClassName="space-y-4 p-5">
            {(values.type === "percentage" || values.type === "fixed_amount") && (
              <Field id="value" label={values.type === "percentage" ? "Percentage off" : "Amount off"} error={errors.value}>
                {/* Width goes on the wrapper so the % / ₹ sign stays inside the box. */}
                <div className="max-w-48">
                  <AffixInput
                    id="value"
                    {...(values.type === "percentage" ? { suffix: "%" } : { prefix: CURRENCY_SYMBOL })}
                    value={values.value}
                    error={errors.value}
                    onChange={(e) => set({ value: e.target.value })}
                  />
                </div>
              </Field>
            )}

            {values.type === "buy_x_get_y" && (
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
                  <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Customer buys</p>
                  <div className="grid grid-cols-[1fr_6rem] gap-3">
                    <Field id="buyTargetType" label="From">
                      <SelectField id="buyTargetType" value={values.bogo.buyTargetType} options={BUY_TARGETS} onChange={(v) => setBogo({ buyTargetType: v as TargetType, buyTargetIds: [] })} />
                    </Field>
                    <Field id="bogo.buyQuantity" label="Quantity" error={errors["bogo.buyQuantity"]}>
                      <TextInput id="bogo.buyQuantity" inputMode="numeric" value={values.bogo.buyQuantity} error={errors["bogo.buyQuantity"]} onChange={(e) => setBogo({ buyQuantity: e.target.value })} />
                    </Field>
                  </div>
                  <Targets id="bogo.buyTargetIds" type={values.bogo.buyTargetType} ids={values.bogo.buyTargetIds} onChange={(ids) => setBogo({ buyTargetIds: ids })} error={errors["bogo.buyTargetIds"]} categories={categories} />
                </div>
                <div className="space-y-3 rounded-lg border bg-violet-50/40 p-4 dark:bg-violet-500/5">
                  <p className="text-xs font-semibold tracking-wide text-violet-700 uppercase dark:text-violet-300">Customer gets</p>
                  <div className="grid grid-cols-[1fr_6rem] gap-3">
                    <Field id="rewardTargetType" label="From">
                      <SelectField id="rewardTargetType" value={values.bogo.rewardTargetType} options={REWARD_TARGETS} onChange={(v) => setBogo({ rewardTargetType: v as DiscountFormValues["bogo"]["rewardTargetType"], rewardTargetIds: [] })} />
                    </Field>
                    <Field id="bogo.rewardQuantity" label="Quantity" error={errors["bogo.rewardQuantity"]}>
                      <TextInput id="bogo.rewardQuantity" inputMode="numeric" value={values.bogo.rewardQuantity} error={errors["bogo.rewardQuantity"]} onChange={(e) => setBogo({ rewardQuantity: e.target.value })} />
                    </Field>
                  </div>
                  <Targets id="bogo.rewardTargetIds" type={values.bogo.rewardTargetType} ids={values.bogo.rewardTargetIds} onChange={(ids) => setBogo({ rewardTargetIds: ids })} error={errors["bogo.rewardTargetIds"]} categories={categories} />
                  <div className="grid grid-cols-2 gap-3">
                    <Field id="bogoRewardType" label="At">
                      <SelectField id="bogoRewardType" value={values.bogo.rewardType} options={BOGO_REWARDS} onChange={(v) => setBogo({ rewardType: v as DiscountFormValues["bogo"]["rewardType"] })} />
                    </Field>
                    {values.bogo.rewardType !== "Free" && (
                      <Field id="bogo.rewardValue" label={values.bogo.rewardType === "PercentageOff" ? "Percent" : "Amount"} error={errors["bogo.rewardValue"]}>
                        <AffixInput id="bogo.rewardValue" {...(values.bogo.rewardType === "PercentageOff" ? { suffix: "%" } : { prefix: CURRENCY_SYMBOL })} value={values.bogo.rewardValue} error={errors["bogo.rewardValue"]} onChange={(e) => setBogo({ rewardValue: e.target.value })} />
                      </Field>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">If the reward product isn’t in the cart, it’s added automatically when in stock.</p>
                </div>
                <label className="flex items-center gap-2 text-[13px] lg:col-span-2">
                  <input type="checkbox" className="accent-foreground" checked={values.bogo.repeat} onChange={(e) => setBogo({ repeat: e.target.checked })} />
                  Repeat for every qualifying set (buy 4 get 2, instead of buy 4 get 1)
                </label>
              </div>
            )}

            {values.type === "spend_x_get_y" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="spend.minSpend" label="When the customer spends" error={errors["spend.minSpend"]}>
                  <AffixInput id="spend.minSpend" prefix={CURRENCY_SYMBOL} value={values.spend.minSpend} error={errors["spend.minSpend"]} onChange={(e) => setSpend({ minSpend: e.target.value })} />
                </Field>
                <Field id="spendRewardType" label="They get">
                  <SelectField id="spendRewardType" value={values.spend.rewardType} options={SPEND_REWARDS} onChange={(v) => setSpend({ rewardType: v as DiscountFormValues["spend"]["rewardType"] })} />
                </Field>
                {values.spend.rewardType === "FreeProduct" ? (
                  <Field id="spend.rewardTargetIds" label="Free product" error={errors["spend.rewardTargetIds"]} className="sm:col-span-2">
                    <ProductMultiSelect id="spend.rewardTargetIds" value={values.spend.rewardTargetIds} onChange={(ids) => setSpend({ rewardTargetIds: ids })} single invalid={Boolean(errors["spend.rewardTargetIds"])} />
                  </Field>
                ) : (
                  <Field id="spend.rewardValue" label={values.spend.rewardType === "Percentage" ? "Percent off" : "Amount off"} error={errors["spend.rewardValue"]}>
                    <AffixInput id="spend.rewardValue" {...(values.spend.rewardType === "Percentage" ? { suffix: "%" } : { prefix: CURRENCY_SYMBOL })} value={values.spend.rewardValue} error={errors["spend.rewardValue"]} onChange={(e) => setSpend({ rewardValue: e.target.value })} />
                  </Field>
                )}
                <Field id="spend.maxDiscount" label="Cap this reward at" optional error={errors["spend.maxDiscount"]}>
                  <AffixInput id="spend.maxDiscount" prefix={CURRENCY_SYMBOL} value={values.spend.maxDiscount} error={errors["spend.maxDiscount"]} placeholder="No cap" onChange={(e) => setSpend({ maxDiscount: e.target.value })} />
                </Field>
                {values.spend.rewardType !== "Percentage" && (
                  <label className="flex items-center gap-2 text-[13px] sm:col-span-2">
                    <input type="checkbox" className="accent-foreground" checked={values.spend.repeat} onChange={(e) => setSpend({ repeat: e.target.checked })} />
                    Repeat for each multiple (spend ₹10,000 → 2× the reward)
                  </label>
                )}
              </div>
            )}
          </SectionCard>

          {showTargets && (
            <SectionCard title="Applies to" description="Leave empty to apply to the whole order." bodyClassName="p-5">
              <ProductMultiSelect id="targetProductIds" value={values.targetProductIds} onChange={(ids) => set({ targetProductIds: ids })} />
            </SectionCard>
          )}

          <SectionCard title="Schedule & limits" bodyClassName="p-5">
            <ScheduleFields values={values} onChange={set} errors={errors} />
          </SectionCard>

          <SectionCard title="Stacking & priority" bodyClassName="p-5">
            <StackingFields values={values} onChange={set} errors={errors} />
          </SectionCard>
        </div>

        <div className="min-w-0">
          <div className="space-y-4 lg:sticky lg:top-4">
            <SectionCard title="Summary">
              <div className="space-y-3 px-5 py-4 text-[13px]">
                <div className="flex flex-wrap items-center gap-2">
                  <DiscountStatusBadge rule={preview} />
                  {coupon && values.code.trim() && <CodeChip code={values.code.trim()} />}
                </div>
                <p className="font-medium">{values.name.trim() || "Untitled discount"}</p>
                <p className="text-muted-foreground">{describeRule(preview)}</p>
                <dl className="space-y-1 border-t pt-3 text-xs">
                  <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Schedule</dt><dd>{scheduleLabel(preview)}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Uses</dt><dd>{preview.usageLimit ? `Up to ${preview.usageLimit}` : "Unlimited"}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Stacking</dt><dd>{values.exclusive ? "Exclusive" : "Combines with others"}</dd></div>
                </dl>
              </div>
            </SectionCard>
          </div>
        </div>
      </div>
      <FormFooter saving={saving} submitLabel={mode === "create" ? `Create ${coupon ? "coupon" : "discount"}` : "Save changes"} cancelHref={cancelHref} dirty={dirty} />
    </form>
  );
}
